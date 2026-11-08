// Offline checks: mocks fetch and verifies each provider's request shape and reply parsing.
import assert from 'node:assert/strict';
import { callAI, PROVIDERS } from '../lib/providers.js';
import { buildRequest } from '../lib/prompts.js';

const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, init, body: JSON.parse(init.body) });
  const u = String(url);
  let payload;
  if (u.includes('anthropic.com')) payload = { content: [{ type: 'text', text: ' hi ' }] };
  else if (u.includes('googleapis.com')) payload = { candidates: [{ content: { parts: [{ text: ' hi ' }] } }] };
  else payload = { choices: [{ message: { content: ' hi ' } }] };
  return new Response(JSON.stringify(payload), { status: 200 });
};

for (const provider of Object.keys(PROVIDERS)) {
  calls.length = 0;
  const out = await callAI({ provider, apiKey: 'k' }, 'sys', 'usr');
  assert.equal(out, 'hi', provider);
  const { url, init, body } = calls[0];
  assert.ok(String(url).startsWith(PROVIDERS[provider].baseUrl), `${provider} url`);
  if (provider === 'anthropic') {
    assert.equal(init.headers['x-api-key'], 'k');
    assert.equal(init.headers['anthropic-dangerous-direct-browser-access'], 'true');
    assert.equal(body.system, 'sys');
  } else if (provider === 'gemini') {
    assert.equal(init.headers['x-goog-api-key'], 'k');
    assert.ok(!String(url).includes('key='), 'key must not be in the URL');
    assert.equal(body.systemInstruction.parts[0].text, 'sys');
  } else {
    assert.equal(init.headers.Authorization, 'Bearer k');
    assert.equal(body.messages[0].role, 'system');
  }
}

// Error handling
globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 });
await assert.rejects(callAI({ provider: 'openai', apiKey: 'k' }, 's', 'u'), /401: bad key/);
await assert.rejects(callAI({ provider: 'openai', apiKey: '' }, 's', 'u'), /No API key/);

// Prompts: defaults are the website's Translate prompt, untouched unless a language is chosen
const site = buildRequest('translate', 'x', { targetLanguage: 'auto' }).system;
assert.match(site, /^You are an excellent English teacher\./);
assert.match(site, /Casual Tone/);
assert.equal(buildRequest('polish', 'x', {}).system, site);
assert.match(buildRequest('translate', 'x', { targetLanguage: '日本語' }).system, /日本語\.$/);
assert.ok(buildRequest('translate', 'x', { targetLanguage: 'auto', translatePrompt: 'custom' }).system.startsWith('custom'));
console.log('all checks passed');
