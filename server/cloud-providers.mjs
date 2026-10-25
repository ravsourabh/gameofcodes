import { request } from 'node:https';

const err = (msg, status = 502) => Object.assign(new Error(msg), { status });

function post(hostname, path, headers, body, timeout = 90_000) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname, path, method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { reject(err(`${hostname} returned unparseable response (${res.statusCode})`)); }
      });
    });
    req.on('error', () => reject(err(`${hostname} connection failed`)));
    req.setTimeout(timeout, () => { req.destroy(); reject(err(`${hostname} timed out`, 504)); });
    req.end(body);
  });
}

function extractText(res) {
  // OpenAI/Llama-compatible response shape
  const choice = res.body?.choices?.[0];
  if (choice) {
    const content = choice.message?.content ?? choice.text ?? '';
    return content.trim();
  }
  // Anthropic shape
  const block = res.body?.content?.[0];
  if (block?.type === 'text') return block.text.trim();
  throw err('Unexpected API response shape');
}

function parseJson(text, providerName) {
  // Strip markdown code fences if present
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(clean); }
  catch { throw err(`${providerName} did not return valid JSON. Response: ${clean.slice(0, 300)}`, 502); }
}

function buildPrompt(input, schema) {
  const sysMsg = input.find(m => m.role === 'system')?.content ?? '';
  const userMsg = input.find(m => m.role === 'user')?.content ?? '';
  const instruction = `${sysMsg}\n\nReturn ONLY valid JSON matching this schema — no markdown, no commentary:\n${JSON.stringify(schema)}`;
  return { system: instruction, user: userMsg };
}

export async function claudeGenerate(input, schema) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw err('ANTHROPIC_API_KEY not set', 503);
  const { system, user } = buildPrompt(input, schema);
  const res = await post('api.anthropic.com', '/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Accept': 'application/json' },
    JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4096, system, messages: [{ role: 'user', content: user }] })
  );
  if (res.status !== 200) throw err(`Anthropic API error ${res.status}: ${res.body?.error?.message ?? JSON.stringify(res.body).slice(0, 200)}`, res.status >= 500 ? 502 : res.status);
  return parseJson(extractText(res), 'Claude');
}

export async function openaiGenerate(input, schema) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw err('OPENAI_API_KEY not set', 503);
  const { system, user } = buildPrompt(input, schema);
  const res = await post('api.openai.com', '/v1/chat/completions',
    { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' },
    JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' } })
  );
  if (res.status !== 200) throw err(`OpenAI API error ${res.status}: ${res.body?.error?.message ?? JSON.stringify(res.body).slice(0, 200)}`, res.status >= 500 ? 502 : res.status);
  return parseJson(extractText(res), 'ChatGPT');
}

export async function llamaGenerate(input, schema) {
  const key = process.env.META_LLAMA_API_KEY;
  if (!key) throw err('META_LLAMA_API_KEY not set', 503);
  const { system, user } = buildPrompt(input, schema);
  const res = await post('api.llama.com', '/compat/v1/chat/completions',
    { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' },
    JSON.stringify({ model: 'Llama-4-Scout-17B-16E-Instruct', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' } })
  );
  if (res.status !== 200) throw err(`Meta Llama API error ${res.status}: ${res.body?.error?.message ?? JSON.stringify(res.body).slice(0, 200)}`, res.status >= 500 ? 502 : res.status);
  return parseJson(extractText(res), 'Muse');
}

// Image generation — Gemini multimodal first, DALL-E 3 fallback
export async function generateImage(prompt) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      });
      const imgPath = `/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`;
      const res = await post('generativelanguage.googleapis.com', imgPath, { 'Accept': 'application/json' }, body, 45_000);
      if (res.status === 200) {
        const parts = res.body?.candidates?.[0]?.content?.parts ?? [];
        const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
        if (imgPart) return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
      }
    } catch { /* fall through to DALL-E */ }
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw err('No image generation API key available (GEMINI_API_KEY or OPENAI_API_KEY required).', 503);
  const res = await post('api.openai.com', '/v1/images/generations',
    { 'Authorization': `Bearer ${openaiKey}`, 'Accept': 'application/json' },
    JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
    60_000
  );
  if (res.status !== 200) throw err(`Image generation failed: ${res.body?.error?.message ?? res.status}`, 502);
  const b64 = res.body?.data?.[0]?.b64_json;
  if (!b64) throw err('Image generation returned no data', 502);
  return `data:image/png;base64,${b64}`;
}

// Gemini — primary cloud brain for all providers
// Flash Lite for conversation (fast, cheap); Flash for builds (code quality matters)
export async function geminiGenerate(input, schema, { isBuild = false, transport = post } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw err('GEMINI_API_KEY not set', 503);
  const model = isBuild ? (process.env.GEMINI_BUILD_MODEL || 'gemini-3.8-flash') : 'gemini-flash-lite-latest';
  const { system, user } = buildPrompt(input, schema);
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: isBuild ? `${system}\nKeep the implementation compact and complete. Prefer straightforward HTML, CSS and JavaScript. Avoid long decorative SVG paths or repeated boilerplate. Finish every JSON string and the entire JSON object.` : system }] },
    contents: [{ parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: isBuild ? 16384 : 2048, responseMimeType: 'application/json', ...(isBuild ? { responseJsonSchema: schema, thinkingConfig: { thinkingLevel: 'LOW' } } : {}) },
  });
  const path = `/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await transport('generativelanguage.googleapis.com', path, { 'Accept': 'application/json' }, body, isBuild ? 180_000 : 90_000);
  if (res.status !== 200) throw err(`Gemini API error ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`, res.status >= 500 ? 502 : res.status);
  const candidate=res.body?.candidates?.[0];
  if(candidate?.finishReason==='MAX_TOKENS')throw err('The build exceeded the model output limit. Ask for a smaller first version and try again.',502);
  const text = (candidate?.content?.parts||[]).filter(part=>!part.thought&&typeof part.text==='string').map(part=>part.text).join('').trim();
  if (!text) throw err('Gemini returned an empty response', 502);
  return parseJson(text, 'Gemini');
}
