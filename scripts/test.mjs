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

// Prompts: language-agnostic defaults, language rules appended from settings
const auto = buildRequest('translate', 'x', { targetLanguage: 'auto', primaryLanguage: '日本語' }).system;
assert.match(auto, /Target language: 日本語\. If the text is already in 日本語, translate it into English/);
assert.match(auto, /fluent in every language/);
assert.doesNotMatch(auto, /English teacher/);
assert.match(buildRequest('translate', 'x', { targetLanguage: 'Français' }).system, /Target language: Français\.$/);
assert.match(buildRequest('translate', 'x', { primaryLanguage: '简体中文' }).system, /Target language: 简体中文/);
const pol = buildRequest('polish', 'x', {}).system;
assert.match(pol, /same language as the original/);
assert.doesNotMatch(pol, /Target language/);
assert.match(buildRequest('polish', 'x', { polishLanguage: 'Deutsch' }).system, /in Deutsch\.$/);
assert.ok(buildRequest('translate', 'x', { translatePrompt: 'custom' }).system.startsWith('custom'));
assert.match(buildRequest('translate', 'x', { targetLanguage: 'auto', primaryLanguage: 'English', secondaryLanguage: '日本語' }).system, /Target language: English\. If the text is already in English, translate it into 日本語/);
assert.match(buildRequest('translate', 'x', { primaryLanguage: 'English' }).system, /into Español instead/);

// Locales: every locale has the same keys and every used key exists
import fs from 'node:fs';
const load = (l) => JSON.parse(fs.readFileSync(new URL(`../_locales/${l}/messages.json`, import.meta.url)));
const en = load('en');
for (const l of ['zh_CN', 'zh_TW']) assert.deepEqual(Object.keys(load(l)).sort(), Object.keys(en).sort(), l);
const src = ['background.js', 'content.js', 'popup.js', 'options.js', 'popup.html', 'options.html', 'lib/prompts.js']
  .map((f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
const used = new Set([...src.matchAll(/(?:\bt|getMessage)\(\s*'(\w+)'/g)].map((m) => m[1]));
for (const m of src.matchAll(/(?:data-i18n(?:-placeholder|-label)?|labelKey|loadingKey)[=:]\s*["']?(\w+)/g)) used.add(m[1]);
for (const m of fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8').matchAll(/__MSG_(\w+)__/g)) used.add(m[1]);
for (const key of used) if (!['i18n','label','placeholder'].includes(key)) assert.ok(en[key], `missing message: ${key}`);
console.log('all checks passed');
