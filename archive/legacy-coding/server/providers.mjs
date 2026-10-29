import { spawn } from 'node:child_process';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { claudeGenerate, openaiGenerate, geminiGenerate } from './cloud-providers.mjs';

const CLOUD_MODE = process.env.SOVEREIGN_MODE === 'cloud';
const SESSION_LIMIT = CLOUD_MODE ? 300 : 30;

export const PROVIDERS = [
  { id: 'muse',   name: 'Muse Code',      command: 'muse',   loginCommand: 'muse',             installUrl: 'https://dev.meta.ai/docs/muse-code',          description: 'Use your Meta account through Muse Code. (Cloud API pending verification.)' },
  { id: 'codex',  name: 'ChatGPT · Codex',command: 'codex',  loginCommand: 'codex login',       installUrl: 'https://learn.chatgpt.com/docs/cli',          description: 'Use your ChatGPT account through the Codex CLI.' },
  { id: 'claude', name: 'Claude Code',    command: 'claude', loginCommand: 'claude auth login', installUrl: 'https://code.claude.com/docs/en/quickstart',  description: 'Use your Claude account through Claude Code.' },
  { id: 'gemini', name: 'Gemini',         command: 'gemini', loginCommand: '',                  installUrl: 'https://ai.google.dev/',                      description: 'Google Gemini via API — cloud mode only. No local CLI required.' },
];
const providerError = (message, status = 503) => Object.assign(new Error(message), { status });

export function executableFor(provider, env = process.env) {
  const override = env[`SOVEREIGN_${provider.id.toUpperCase()}_PATH`];
  const candidates = override ? [override] : (env.PATH || env.Path || '').split(path.delimiter).flatMap(folder =>
    (process.platform === 'win32' ? [`${provider.command}.exe`] : [provider.command]).map(name => path.join(folder.replace(/^"|"$/g, ''), name)));
  if (!override && process.platform === 'win32' && provider.id === 'muse' && env.LOCALAPPDATA) {
    const folder = path.join(env.LOCALAPPDATA, 'Programs', 'muse');
    candidates.push(path.join(folder, 'muse.exe'));
    try { const version = readFileSync(path.join(folder, '.muse-version'), 'utf8').trim(); if (/^\d+\.\d+\.\d+-R\d+(?:\.\d+)?$/.test(version)) candidates.push(path.join(folder, `muse-bin-${version}.exe`)); } catch {}
  }
  return candidates.find(file => path.isAbsolute(file) && existsSync(file) && statSync(file).isFile()) || null;
}

// Prompts go through stdin (or a private prompt file), never a shell command.
// Official CLIs own account login and credential refresh. Do not pass API keys
// through from the web server or silently switch a subscription run to API billing.
export function accountEnvironment(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) =>
    !/^(OPENAI_API_KEY|CODEX_API_KEY|ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|META_API_KEY|MODEL_API_KEY|MUSE_API_KEY|META_MODEL_API_KEY|ANTHROPIC_BASE_URL|OPENAI_BASE_URL|CLAUDE_CODE_USE_BEDROCK|CLAUDE_CODE_USE_VERTEX|CLAUDE_CODE_USE_FOUNDRY|CLAUDECODE|CLAUDE_CODE_ENTRYPOINT)$/i.test(name)));
}

export function runProcess(command, args, { cwd, input = '', timeout = 120_000, env = accountEnvironment(), maxOutput = 4_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', bytes = 0, finished = false;
    const finish = (error, result) => { if (finished) return; finished = true; clearTimeout(timer); error ? reject(error) : resolve(result); };
    const stop = error => {
      // Windows' taskkill addresses only this owned child's process tree.
      if (process.platform === 'win32' && child.pid) spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', shell: false }).on('error', () => {});
      else child.kill('SIGTERM');
      finish(error);
    };
    const timer = setTimeout(() => stop(providerError('The local assistant timed out. Your project is preserved; try a shorter instruction.', 504)), timeout);
    const collect = target => chunk => { bytes += chunk.length; if (bytes > maxOutput) return stop(providerError('The local assistant returned too much output. Please try a smaller request.', 502)); if (target === 'out') stdout += chunk; else stderr += chunk; };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8'); child.stdout.on('data', collect('out')); child.stderr.on('data', collect('err'));
    child.on('error', () => finish(providerError('The local assistant could not start. Check its installation and restart Game of Codes.')));
    child.on('close', code => finish(null, { code, stdout, stderr }));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}

export function parseAssistantOutput(provider, stdout, finalText = '') {
  const parse = text => { try { return JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')); } catch { return null; } };
  if (finalText.trim()) { const result = parse(finalText); if (result && typeof result === 'object') return result; }
  const entire = parse(stdout);
  if (entire?.is_error) throw providerError('The local assistant could not complete the request. Check your account sign-in and usage limits.', 502);
  if (entire?.structured_output) return entire.structured_output;
  if (typeof entire?.result === 'string') { const result = parse(entire.result); if (result) return result; }
  if (entire && !entire.type && !entire.result && !entire.payload_type) return entire;
  const events = stdout.split(/\r?\n/).map(parse).filter(Boolean);
  let answer = '';
  for (const event of events) {
    if (provider.id === 'muse' && event.payload_type?.startsWith('run.terminal.') && event.payload?.kind === 'run_terminal') {
      if (event.payload_type !== 'run.terminal.completed' || event.payload.terminal !== 'completed') throw providerError('Muse Code reported a failed request. Check its sign-in and usage limits.', 502);
      answer = typeof event.payload.text === 'string' ? event.payload.text : '';
    }
    if (event.type === 'turn.failed' || event.type === 'error' || event.is_error) throw providerError('The local assistant reported a failed request. Check its sign-in and usage limits.', 502);
    if (event.structured_output) return event.structured_output;
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') answer = event.item.text;
    if (event.type === 'result' && typeof event.result === 'string') answer = event.result;
    const message = event.message || event;
    if ((event.type === 'assistant' || event.type === 'message' || event.type === 'assistant_message') && (message.role === 'assistant' || event.type === 'assistant' || event.type === 'assistant_message')) {
      answer = Array.isArray(message.content) ? message.content.filter(item => item.type === 'text' || item.type === 'output_text').map(item => item.text).join('\n') : String(message.content || message.text || '');
    }
    // Muse versions also emit message-shaped Responses events.
    if (event.type === 'response.completed') answer = (event.response?.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n');
    if (event.type === 'agent_message' && typeof event.text === 'string') answer = event.text;
  }
  const result = parse(answer);
  if (!result || typeof result !== 'object') throw providerError(`${provider.name} did not return the required application reply. No changes were applied; please try again.`, 502);
  return result;
}

export function invocationFor(id, folder, schema) {
  if (id === 'codex') return {
    args: ['exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--disable', 'shell_tool', '--disable', 'apps', '--disable', 'hooks', '--disable', 'multi_agent', '--disable', 'skill_search', '-c', 'approval_policy="never"', '--json', '--output-schema', path.join(folder, 'schema.json'), '--output-last-message', path.join(folder, 'reply.json'), '-'],
  };
  if (id === 'claude') return {
    args: ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(schema), '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--settings', '{"disableAllHooks":true}', '--no-session-persistence', '--permission-mode', 'dontAsk'],
  };
  return {
    args: ['exec', '--json', '--preset', 'empty', '--disable-shell', '--disable-write', '--disable-web-tools', '--disable-reminders', '--disable-request-user-input', '--no-foreign-personal-context', '--no-parallel-tool-calls', '--no-session-log', '--workspace', folder, '--prompt-file', path.join(folder, 'prompt.txt'), '--output-schema', path.join(folder, 'schema.json'), '--max-model-steps', '3', '--approval-mode', 'untrusted', '--approval-judge', 'off', '--sandbox-network', 'restricted'],
  };
}

export function createProviderBridge({ root, execute = runProcess, locate = executableFor } = {}) {
  const directory = path.join(root, '.sovereign'), preferenceFile = path.join(directory, 'connection.json');
  let selected = CLOUD_MODE ? 'gemini' : 'muse', loaded = false, busy = false, selecting = false;
  const health = new Map();
  async function loadPreference() { if (loaded) return; loaded = true; try { const data = JSON.parse(await readFile(preferenceFile, 'utf8')); if (PROVIDERS.some(item => item.id === data.provider)) selected = data.provider; } catch {} }
  async function status() {
    await loadPreference();
    const providers = PROVIDERS.map(provider => {
      if (CLOUD_MODE) {
        const keyMap = { muse: 'META_LLAMA_API_KEY', codex: 'OPENAI_API_KEY', claude: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' };
        if (provider.id === 'muse') return { ...provider, installed: false, state: 'disabled', message: 'Muse (Meta Llama API) is pending key verification. Use Gemini, Claude, or ChatGPT instead.' };
        const hasKey = !!process.env[keyMap[provider.id]];
        const checked = health.get(provider.id);
        const state = checked?.state || (hasKey ? 'not-checked' : 'not-installed');
        return { ...provider, installed: hasKey, state, message: checked?.message || (hasKey ? 'API key set. Ready to use.' : 'API key not set in environment.') };
      }
      if(provider.id==='gemini')return {...provider,installed:false,state:'disabled',message:'Gemini is available through cloud mode. Choose an installed local CLI here.'};
      const installed = !!locate(provider), checked = health.get(provider.id);
      return { ...provider, installed, state: !installed ? 'not-installed' : checked?.state || 'not-checked', message: !installed ? 'Install the official CLI on this computer, then restart Game of Codes.' : checked?.message || 'Installed. Sign in through its CLI, then check the connection.' };
    });
    const current = providers.find(item => item.id === selected);
    return { mode: CLOUD_MODE ? 'cloud' : 'local', selectedProvider: selected, provider: current.name, configured: current.installed && !['disabled', 'error'].includes(current.state), providers, running: busy };
  }
  async function select(id) {
    if (!PROVIDERS.some(item => item.id === id)) throw providerError('Choose Muse Code, ChatGPT, or Claude Code.', 400);
    if (busy || selecting) throw providerError('Wait for the current instruction to finish before switching assistants.', 409);
    selecting = true;
    try { await loadPreference();
      const provider = (await status()).providers.find(item => item.id === id);
      if (provider.state === 'disabled') throw providerError(`${provider.name} is disabled in cloud mode. Choose Gemini, Claude, or ChatGPT.`);
      await mkdir(directory, { recursive: true });
      await writeFile(`${preferenceFile}.tmp`, JSON.stringify({ provider: id })); await rename(`${preferenceFile}.tmp`, preferenceFile); selected = id;
      return status();
    } finally { selecting = false; }
  }
  async function cloudGenerate(input, { schema, providerId } = {}) {
    await loadPreference();
    const id = providerId || selected;
    if (!PROVIDERS.some(provider => provider.id === id)) throw providerError('Choose a supported cloud assistant.', 400);
    const isBuild = schema && 'html' in (schema.properties || {});
    if (id === 'muse') throw providerError('Muse (Meta Llama API) is unavailable in cloud mode — API key pending verification. Switch this brain to Gemini, Claude, or ChatGPT.', 503);
    const fn = id === 'claude' ? claudeGenerate
      : id === 'codex' ? openaiGenerate
      : (i, s) => geminiGenerate(i, s, { isBuild });
    if (busy || selecting) throw providerError('Your court is finishing the previous instruction. Please wait.', 409);
    busy = true;
    try {
      const reply = await fn(input, schema);
      health.set(id, { state: 'connected', message: 'Verified by a successful cloud API reply.' });
      return reply;
    } catch (error) {
      health.set(id, { state: 'error', message: error.message });
      throw error.status ? error : providerError(`Cloud assistant did not finish. Check your API keys and try again.`, 502);
    } finally { busy = false; }
  }
  async function generate(input, { schema, timeout = 120_000, providerId } = {}) {
    if (CLOUD_MODE) return cloudGenerate(input, { schema, providerId });
    await loadPreference();
    const provider = PROVIDERS.find(item => item.id === (providerId || selected));
    if (!provider) throw providerError('Choose a local assistant first.', 400);
    const command = locate(provider);
    if (!command) throw providerError(`${provider.name} is not installed. Open Connect assistant on desktop for installation and sign-in steps.`);
    if (busy || selecting) throw providerError('Your local assistant is finishing another instruction. Please wait.', 409);
    busy = true;
    let folder;
    try {
      const runs = path.join(directory, 'agent-runs'); await mkdir(runs, { recursive: true }); folder = await mkdtemp(path.join(runs, 'turn-'));
      if (provider.id !== 'muse') {
        const auth = await execute(command, provider.id === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json'], { cwd: folder, timeout: 12_000, maxOutput: 64_000 });
        let signedIn = auth.code === 0 && /chatgpt/i.test(`${auth.stdout} ${auth.stderr}`);
        if (provider.id === 'claude') { try { const info = JSON.parse(auth.stdout); signedIn = auth.code === 0 && info.loggedIn === true && /claude\.ai|oauth/i.test(info.authMethod || ''); } catch { signedIn = false; } }
        if (!signedIn) throw providerError(`Sign in with your account using ${provider.loginCommand} in your terminal. Game of Codes does not use an API-key login for ${provider.name}.`);
      }
      const prompt = `Game of Codes local application request. Return ONLY JSON matching the supplied schema. All necessary information is below. Do not use tools, read host files, run commands, contact other agents, or change files. The application will apply approved source itself.\nSchema: ${JSON.stringify(schema)}\n${input.map(item => `${item.role.toUpperCase()}:\n${item.content}`).join('\n\n')}`;
      await Promise.all([writeFile(path.join(folder, 'schema.json'), JSON.stringify(schema)), writeFile(path.join(folder, 'prompt.txt'), prompt)]);
      const invocation = invocationFor(provider.id, folder, schema);
      const result = await execute(command, invocation.args, { cwd: folder, input: provider.id === 'muse' ? '' : prompt, timeout });
      if (result.code !== 0) {
        const diagnostic = `${result.stdout}\n${result.stderr}`;
        const message = /auth|log.?in|sign.?in|credential|401|403/i.test(diagnostic)
          ? `${provider.name} needs account access. Run ${provider.loginCommand} in your terminal, complete sign-in, then check the connection again.`
          : /quota|limit|credit|billing|429|402/i.test(diagnostic) ? `${provider.name} has reached an account or usage limit. Check your plan in its official app.`
          : `${provider.name} could not complete this request. Run its CLI in your terminal to check sign-in, installation, or plan access.`;
        throw providerError(message, 502);
      }
      const finalText = provider.id === 'codex' ? await readFile(path.join(folder, 'reply.json'), 'utf8').catch(() => '') : '';
      const reply = parseAssistantOutput(provider, result.stdout, finalText);
      health.set(provider.id, { state: 'connected', message: 'Verified by a successful reply from the local CLI.' });
      return reply;
    } catch (error) {
      health.set(provider.id, { state: 'error', message: error.status ? error.message : `${provider.name} did not finish. Check the local CLI and try again.` });
      throw error.status ? error : providerError(`${provider.name} did not finish. Check the local CLI and try again.`, 502);
    } finally {
      busy = false;
      if (folder && path.dirname(path.resolve(folder)) === path.resolve(directory, 'agent-runs') && path.basename(folder).startsWith('turn-')) await rm(folder, { recursive: true, force: true }).catch(() => {});
    }
  }
  async function check(id) {
    if (!PROVIDERS.some(item => item.id === id)) throw providerError('Choose a local assistant.', 400);
    const result = await generate([{ role: 'user', content: 'Connection check only. Return {"connected":true}.' }], { providerId: id, schema: { type: 'object', properties: { connected: { type: 'boolean', const: true } }, required: ['connected'], additionalProperties: false }, timeout: 90_000 });
    if (result.connected !== true) { health.set(id, { state: 'error', message: 'The assistant did not confirm the connection check.' }); throw providerError('The assistant did not confirm the connection check.', 502); }
    return status();
  }
  return { status, select, check, generate };
}
