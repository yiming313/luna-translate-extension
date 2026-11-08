import { loadSettings } from './lib/storage.js';
import { PROVIDERS } from './lib/providers.js';
import { MODES } from './lib/prompts.js';

const $ = (id) => document.getElementById(id);
const input = $('input');
const output = $('output');
const notice = $('notice');
const runButton = $('run');
let mode = 'translate';
let busy = false;

function setMode(next) {
  mode = next;
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  runButton.textContent = MODES[mode].label;
  chrome.storage.local.set({ popupMode: mode }).catch(() => {});
}

function showNotice(text) {
  notice.textContent = text;
  notice.classList.toggle('hidden', !text);
}

async function run() {
  if (busy) return;
  const text = input.value.trim();
  if (!text) { showNotice('请输入需要处理的文本。'); return; }
  busy = true;
  runButton.disabled = true;
  runButton.textContent = '处理中…';
  showNotice('');
  output.replaceChildren();
  try {
    const response = await chrome.runtime.sendMessage({ type: 'luna-run', mode, text });
    if (!response?.ok) throw new Error(response?.error || '请求失败');
    window.LunaRender.render(output, response.result, [{
      label: '复制',
      onClick: async (block, button) => {
        try { await navigator.clipboard.writeText(block); button.textContent = '已复制'; } catch { button.textContent = '复制失败'; }
      },
    }]);
  } catch (error) {
    showNotice(error.message);
  } finally {
    busy = false;
    runButton.disabled = false;
    runButton.textContent = MODES[mode].label;
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
  const settings = await loadSettings();
  const spec = PROVIDERS[settings.provider];
  $('providerPill').textContent = spec ? spec.label : '';
  if (!settings.apiKeys?.[settings.provider]) {
    showNotice('还没有设置 API Key。点击右上角 ⚙ 添加 OpenRouter / OpenAI / Anthropic / Gemini 的 Key。');
  }
  const stored = await chrome.storage.local.get('popupMode');
  setMode(MODES[stored.popupMode] ? stored.popupMode : 'translate');
  // Pre-fill with the page selection when the popup opens (activeTab is granted by the click).
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && /^https?:/.test(tab.url || '')) {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => String(window.getSelection() || '') });
      if (result && result.trim()) { input.value = result.trim().slice(0, 8000); input.dispatchEvent(new Event('input')); }
    }
  } catch { /* restricted page */ }
  input.focus();
})();
