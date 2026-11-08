export const DEFAULT_SETTINGS = {
  provider: 'openrouter',
  // Keys are stored per provider so switching providers does not lose them.
  apiKeys: {},
  models: {},
  baseUrls: {},
  primaryLanguage: '简体中文',
  targetLanguage: 'auto',
  polishLanguage: 'same',
  translatePrompt: '',
  polishPrompt: '',
};

export async function loadSettings() {
  // storage.local stays on this device; storage.sync would upload API keys to the Google account.
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
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
