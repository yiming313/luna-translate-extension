import { callAI } from './lib/providers.js';
import { buildRequest, MODES } from './lib/prompts.js';
import { loadSettings, activeConfig } from './lib/storage.js';

const MAX_INPUT_CHARS = 8000;

/** Runs one translate/polish request with the user's saved provider. Returns { ok, result | error }. */
async function runAI(mode, text) {
  try {
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error('请先选中或输入文本。');
    if (trimmed.length > MAX_INPUT_CHARS) throw new Error(`文本过长（上限 ${MAX_INPUT_CHARS} 字符）。`);
    const settings = await loadSettings();
    const config = activeConfig(settings);
    if (!config.apiKey) throw new Error('还没有设置 API Key，请先打开扩展设置。');
    const { system, user } = buildRequest(mode, trimmed, settings);
    const result = await callAI(config, system, user);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'luna-translate', title: 'Luna：翻译“%s”', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'luna-polish', title: 'Luna：润色“%s”', contexts: ['selection'] });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  createMenus();
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(createMenus);

async function showInTab(tabId, payload) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/render.js', 'content.js'] });
  await chrome.tabs.sendMessage(tabId, { type: 'luna-show', ...payload });
}

async function handleSelection(tabId, mode, text) {
  const label = MODES[mode].label;
  try {
    await showInTab(tabId, { mode, label, text, status: 'loading' });
  } catch {
    // Pages such as chrome:// or the Web Store cannot be scripted.
    return;
  }
  const outcome = await runAI(mode, text);
  await chrome.tabs.sendMessage(tabId, { type: 'luna-show', mode, label, text, status: outcome.ok ? 'done' : 'error', ...outcome }).catch(() => {});
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || !info.selectionText) return;
  const mode = info.menuItemId === 'luna-polish' ? 'polish' : info.menuItemId === 'luna-translate' ? 'translate' : null;
  if (mode) handleSelection(tab.id, mode, info.selectionText);
});

chrome.commands.onCommand.addListener(async (command) => {
  const mode = command === 'polish-selection' ? 'polish' : command === 'translate-selection' ? 'translate' : null;
  if (!mode) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const active = document.activeElement;
        if (active && typeof active.selectionStart === 'number' && active.selectionEnd > active.selectionStart) {
          return active.value.slice(active.selectionStart, active.selectionEnd);
        }
        return String(window.getSelection() || '');
      },
    });
    if (result && result.trim()) handleSelection(tab.id, mode, result);
  } catch {
    /* page cannot be scripted */
  }
});

// Popup and options talk to the worker through messages, so API keys never reach web pages.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || sender.tab) return false; // only extension pages, not content scripts
  if (message?.type === 'luna-run') {
    runAI(message.mode, message.text).then(sendResponse);
    return true;
  }
  return false;
});
