import { PROVIDERS, callAI } from './lib/providers.js';
import { TARGET_LANGUAGES } from './lib/prompts.js';
import { loadSettings, saveSettings } from './lib/storage.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
let settings;
let provider;

function say(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? 'var(--danger)' : '';
}

function stashCurrent() {
  // Copy the form fields for the visible provider into the in-memory settings.
  settings.apiKeys = { ...settings.apiKeys, [provider]: $('apiKey').value.trim() };
  settings.models = { ...settings.models, [provider]: $('model').value.trim() };
  settings.baseUrls = { ...settings.baseUrls, [provider]: $('baseUrl').value.trim() };
}

function showProvider(next) {
  provider = next;
  const spec = PROVIDERS[provider];
  document.querySelectorAll('.provider-option').forEach((node) => {
    const on = node.dataset.provider === provider;
    node.classList.toggle('is-active', on);
    node.setAttribute('aria-checked', String(on));
  });
  $('apiKey').value = settings.apiKeys?.[provider] || '';
  $('apiKey').placeholder = spec.keyHint;
  $('model').value = settings.models?.[provider] || '';
  $('model').placeholder = spec.defaultModel;
  $('baseUrl').value = settings.baseUrls?.[provider] || '';
  $('keyLink').href = spec.keyUrl;
  $('modelList').replaceChildren(...spec.models.map((name) => new Option(name, name)));
  say('');
}

function currentConfig() {
  return {
    provider,
    apiKey: $('apiKey').value.trim(),
    model: $('model').value.trim(),
    baseUrl: $('baseUrl').value.trim(),
  };
}

async function ensureHostPermission(baseUrl) {
  if (!baseUrl) return true;
  let origin;
  try {
    const url = new URL(baseUrl);
    if (!/^https?:$/.test(url.protocol)) throw new Error('bad protocol');
    origin = `${url.origin}/*`;
  } catch {
    throw new Error('自定义接口地址格式不正确。');
  }
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

async function save() {
  stashCurrent();
  settings.provider = provider;
  settings.targetLanguage = $('targetLanguage').value;
  settings.polishLanguage = $('polishLanguage').value;
  settings.translatePrompt = $('translatePrompt').value;
  settings.polishPrompt = $('polishPrompt').value;
  try {
    if (!(await ensureHostPermission(settings.baseUrls[provider]))) throw new Error('未授予访问该接口地址的权限。');
    await saveSettings(settings);
    say('已保存。');
  } catch (error) {
    say(error.message, true);
  }
}

async function test() {
  const config = currentConfig();
  say('测试中…');
  try {
    if (!(await ensureHostPermission(config.baseUrl))) throw new Error('未授予访问该接口地址的权限。');
    const reply = await callAI(config, 'Reply with the single word: ok', 'ping');
    say(`连接成功（${reply.slice(0, 40)}）`);
  } catch (error) {
    say(`连接失败：${error.message}`, true);
  }
}

(async function init() {
  settings = await loadSettings();
  const box = $('providers');
  for (const [id, spec] of Object.entries(PROVIDERS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'provider-option';
    button.dataset.provider = id;
    button.setAttribute('role', 'radio');
    button.textContent = spec.label;
    button.addEventListener('click', () => { stashCurrent(); showProvider(id); });
    box.append(button);
  }
  for (const [value, label] of TARGET_LANGUAGES) $('targetLanguage').append(new Option(label, value));
  $('polishLanguage').append(new Option('与原文相同', 'same'));
  for (const [value, label] of TARGET_LANGUAGES.slice(1)) $('polishLanguage').append(new Option(label, value));
  $('targetLanguage').value = settings.targetLanguage;
  $('polishLanguage').value = settings.polishLanguage;
  $('translatePrompt').value = settings.translatePrompt;
  $('polishPrompt').value = settings.polishPrompt;
  showProvider(PROVIDERS[settings.provider] ? settings.provider : 'openrouter');
  $('save').addEventListener('click', save);
  $('test').addEventListener('click', test);
})();
