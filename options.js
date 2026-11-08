import { PROVIDERS, callAI, listModels } from './lib/providers.js';
import { LANGUAGES } from './lib/prompts.js';
import { loadSettings, saveSettings, loadModelCache, saveModelCache } from './lib/storage.js';
import { t, applyI18n } from './lib/i18n.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
let settings;
let provider;
let modelCache = {};
const CUSTOM = '__custom__';

/** The model chosen in the form: '' means "use the provider default". */
function chosenModel() {
  return $('modelSelect').value === CUSTOM ? $('model').value.trim() : $('modelSelect').value;
}

function fillModels(selected) {
  const spec = PROVIDERS[provider];
  const ids = modelCache[provider]?.ids?.length ? modelCache[provider].ids : spec.models;
  const select = $('modelSelect');
  select.replaceChildren(new Option(t('optModelDefault', spec.defaultModel), ''));
  for (const id of ids) select.append(new Option(id, id));
  select.append(new Option(t('optModelCustom'), CUSTOM));
  const known = selected === '' || ids.includes(selected);
  select.value = known ? selected : CUSTOM;
  $('model').value = known ? '' : selected;
  $('model').classList.toggle('hidden', known);
}

function say(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? 'var(--danger)' : '';
}

function stashCurrent() {
  // Copy the form fields for the visible provider into the in-memory settings.
  settings.apiKeys = { ...settings.apiKeys, [provider]: $('apiKey').value.trim() };
  settings.models = { ...settings.models, [provider]: chosenModel() };
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
  fillModels(settings.models?.[provider] || '');
  $('baseUrl').value = settings.baseUrls?.[provider] || '';
  $('keyLink').href = spec.keyUrl;
  say('');
}

function currentConfig() {
  return {
    provider,
    apiKey: $('apiKey').value.trim(),
    model: chosenModel(),
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
    throw new Error(t('optBadUrl'));
  }
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

async function refreshModels() {
  const config = currentConfig();
  if (provider !== 'openrouter' && !config.apiKey) { say(t('optModelsNeedKey'), true); return; }
  say(t('optTesting'));
  try {
    if (!(await ensureHostPermission(config.baseUrl))) throw new Error(t('optPermDenied'));
    const ids = await listModels(config);
    modelCache = { ...modelCache, [provider]: { ids, at: Date.now() } };
    await saveModelCache(modelCache);
    fillModels(chosenModel());
    say(t('optModelsLoaded', ids.length));
  } catch (error) {
    say(t('optModelsFailed', error.message), true);
  }
}

async function save() {
  stashCurrent();
  settings.provider = provider;
  settings.primaryLanguage = $('primaryLanguage').value;
  settings.secondaryLanguage = $('secondaryLanguage').value;
  settings.targetLanguage = $('targetLanguage').value;
  settings.polishLanguage = $('polishLanguage').value;
  settings.translatePrompt = $('translatePrompt').value;
  settings.polishPrompt = $('polishPrompt').value;
  try {
    if (!(await ensureHostPermission(settings.baseUrls[provider]))) throw new Error(t('optPermDenied'));
    await saveSettings(settings);
    say(t('optSaved'));
  } catch (error) {
    say(error.message, true);
  }
}

async function test() {
  const config = currentConfig();
  say(t('optTesting'));
  try {
    if (!(await ensureHostPermission(config.baseUrl))) throw new Error(t('optPermDenied'));
    const reply = await callAI(config, 'Reply with the single word: ok', 'ping');
    say(t('optTestOk', reply.slice(0, 40)));
  } catch (error) {
    say(t('optTestFail', error.message), true);
  }
}

(async function init() {
  applyI18n();
  settings = await loadSettings();
  modelCache = await loadModelCache();
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
  for (const [value, label] of LANGUAGES) {
    $('primaryLanguage').append(new Option(label, value));
    $('secondaryLanguage').append(new Option(label, value));
  }
  $('targetLanguage').append(new Option(t('optTargetAuto'), 'auto'));
  for (const [value, label] of LANGUAGES) $('targetLanguage').append(new Option(label, value));
  $('polishLanguage').append(new Option(t('optPolishSame'), 'same'));
  for (const [value, label] of LANGUAGES) $('polishLanguage').append(new Option(label, value));
  $('primaryLanguage').value = settings.primaryLanguage;
  $('secondaryLanguage').value = settings.secondaryLanguage;
  $('targetLanguage').value = settings.targetLanguage;
  $('polishLanguage').value = settings.polishLanguage;
  $('translatePrompt').value = settings.translatePrompt;
  $('polishPrompt').value = settings.polishPrompt;
  showProvider(PROVIDERS[settings.provider] ? settings.provider : 'openrouter');
  $('save').addEventListener('click', () => save());
  // Language dropdowns and prompts save on change, so a forgotten Save click cannot lose them.
  for (const id of ['primaryLanguage', 'secondaryLanguage', 'targetLanguage', 'polishLanguage', 'translatePrompt', 'polishPrompt']) {
    $(id).addEventListener('change', () => save());
  }
  $('test').addEventListener('click', test);
  $('refreshModels').addEventListener('click', refreshModels);
  $('modelSelect').addEventListener('change', () => {
    $('model').classList.toggle('hidden', $('modelSelect').value !== CUSTOM);
    if ($('modelSelect').value === CUSTOM) $('model').focus(); else save();
  });
  $('model').addEventListener('change', save);
})();
