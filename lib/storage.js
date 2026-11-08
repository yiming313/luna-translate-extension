export const DEFAULT_SETTINGS = {
  provider: 'openrouter',
  // Keys are stored per provider so switching providers does not lose them.
  apiKeys: {},
  models: {},
  baseUrls: {},
  targetLanguage: 'auto',
  polishLanguage: 'same',
  translatePrompt: '',
  polishPrompt: '',
};

export async function loadSettings() {
  // storage.local stays on this device; storage.sync would upload API keys to the Google account.
  const stored = await chrome.storage.local.get('settings');
  const { primaryLanguage, secondaryLanguage, ...rest } = stored.settings || {}; // drop removed settings
  return { ...DEFAULT_SETTINGS, ...rest };
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
