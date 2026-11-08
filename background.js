import { callAI } from './lib/providers.js';
import { buildRequest, MODES } from './lib/prompts.js';
import { loadSettings, activeConfig } from './lib/storage.js';
import { t } from './lib/i18n.js';

const MAX_INPUT_CHARS = 8000;

/** Runs one translate/polish request with the user's saved provider. Returns { ok, result | error }. */
async function runAI(mode, text) {
  try {
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error(t('errNoText'));
    if (trimmed.length > MAX_INPUT_CHARS) throw new Error(t('errTooLong', MAX_INPUT_CHARS));
    const settings = await loadSettings();
    const config = activeConfig(settings);
    if (!config.apiKey) throw new Error(t('errNoKey'));
    const { system, user } = buildRequest(mode, trimmed, settings);
    const result = await callAI(config, system, user);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'luna-translate', title: t('menuTranslate'), contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'luna-polish', title: t('menuPolish'), contexts: ['selection'] });
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
  const label = t(MODES[mode].labelKey);
  const loading = t(MODES[mode].loadingKey);
  try {
    await showInTab(tabId, { mode, label, loading, text, status: 'loading' });
  } catch {
    // Pages such as chrome:// or the Web Store cannot be scripted.
    return;
  }
  const outcome = await runAI(mode, text);
  await chrome.tabs.sendMessage(tabId, { type: 'luna-show', mode, label, loading, text, status: outcome.ok ? 'done' : 'error', ...outcome }).catch(() => {});
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
