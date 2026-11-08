import { loadSettings } from './lib/storage.js';
import { PROVIDERS } from './lib/providers.js';
import { MODES } from './lib/prompts.js';
import { t, applyI18n } from './lib/i18n.js';

const $ = (id) => document.getElementById(id);
const input = $('input');
const output = $('output');
const notice = $('notice');
const runButton = $('run');
const runLabel = $('runLabel');
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const modKey = isMac ? '⌘' : 'Ctrl';
let mode = 'translate';
let busy = false;

function setMode(next) {
  mode = next;
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  runLabel.textContent = t(MODES[mode].labelKey);
  chrome.storage.local.set({ popupMode: mode }).catch(() => {});
}

function showNotice(text) {
  notice.textContent = text;
  notice.classList.toggle('hidden', !text);
}

async function run() {
  if (busy) return;
  const text = input.value.trim();
  if (!text) { showNotice(t('errNoText')); return; }
  busy = true;
  runButton.disabled = true;
  runLabel.textContent = t('working');
  showNotice('');
  output.replaceChildren();
  try {
    const response = await chrome.runtime.sendMessage({ type: 'luna-run', mode, text });
    if (!response?.ok) throw new Error(response?.error || t('errRequestFailed'));
    window.LunaRender.render(output, response.result, [{
      label: t('copy'),
      onClick: async (block, button) => {
        try { await navigator.clipboard.writeText(block); button.textContent = t('copied'); } catch { button.textContent = t('copyFailed'); }
      },
    }]);
  } catch (error) {
    showNotice(error.message);
  } finally {
    busy = false;
    runButton.disabled = false;
    runLabel.textContent = t(MODES[mode].labelKey);
  }
}

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
runButton.addEventListener('click', run);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); run(); }
});
input.addEventListener('input', () => { $('counter').textContent = `${input.value.length} / 8000`; });
$('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

(async function init() {
  applyI18n();
  $('runKey').textContent = `${modKey}↵`;
  runButton.title = t('runShortcutTitle', modKey);
  const settings = await loadSettings();
  const spec = PROVIDERS[settings.provider];
  $('providerPill').textContent = spec ? spec.label : '';
  if (!settings.apiKeys?.[settings.provider]) {
    showNotice(t('popupNoKey'));
  }
  const stored = await chrome.storage.local.get('popupMode');
  setMode(MODES[stored.popupMode] ? stored.popupMode : 'translate');
  input.focus();
})();
