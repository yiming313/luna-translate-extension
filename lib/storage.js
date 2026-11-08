import { detectLanguage } from './i18n.js';

export const DEFAULT_SETTINGS = {
  provider: 'openrouter',
  // Keys are stored per provider so switching providers does not lose them.
  apiKeys: {},
  models: {},
  baseUrls: {},
  primaryLanguage: '', // empty = follow the browser language
  secondaryLanguage: '',
  targetLanguage: 'auto',
  polishLanguage: 'same',
  translatePrompt: '',
  polishPrompt: '',
};

export async function loadSettings() {
  // storage.local stays on this device; storage.sync would upload API keys to the Google account.
  const stored = await chrome.storage.local.get('settings');
  const settings = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  settings.primaryLanguage ||= detectLanguage();
  settings.secondaryLanguage ||= settings.primaryLanguage === 'English' ? 'Español' : 'English';
  return settings;
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export function activeConfig(settings) {
  const provider = settings.provider;
  return {
    provider,
    apiKey: settings.apiKeys?.[provider] || '',
    model: settings.models?.[provider] || '',
    baseUrl: settings.baseUrls?.[provider] || '',
  };
}

export async function loadModelCache() {
  const stored = await chrome.storage.local.get('modelCache');
  return stored.modelCache || {};
}

export async function saveModelCache(cache) {
  await chrome.storage.local.set({ modelCache: cache });
}
