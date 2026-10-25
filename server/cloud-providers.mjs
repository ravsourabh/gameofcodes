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

// Gemini — primary cloud brain for all providers
// Flash Lite for conversation (fast, cheap); Flash for builds (code quality matters)
export async function geminiGenerate(input, schema, { isBuild = false } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw err('GEMINI_API_KEY not set', 503);
  const model = isBuild ? 'gemini-flash-latest' : 'gemini-flash-lite-latest';
  const { system, user } = buildPrompt(input, schema);
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: system }] },
    contents: [{ parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: isBuild ? 8192 : 2048, responseMimeType: 'application/json' },
  });
  const path = `/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await post('generativelanguage.googleapis.com', path, { 'Accept': 'application/json' }, body);
  if (res.status !== 200) throw err(`Gemini API error ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`, res.status >= 500 ? 502 : res.status);
  const text = res.body?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!text) throw err('Gemini returned an empty response', 502);
  return parseJson(text, 'Gemini');
}
