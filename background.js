import { callAI } from './lib/providers.js';
import { buildRequest } from './lib/prompts.js';
import { loadSettings, activeConfig } from './lib/storage.js';
import { t, detectLanguage } from './lib/i18n.js';

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
    const { system, user } = buildRequest(mode, trimmed, { ...settings, primaryLanguage: detectLanguage() });
    const result = await callAI(config, system, user);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

// The popup talks to the worker through messages, so API keys never leave the extension's own pages.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || sender.tab) return false; // extension pages only
  if (message?.type === 'luna-run') {
    runAI(message.mode, message.text).then(sendResponse);
    return true;
  }
  return false;
});
