// Thin wrapper over chrome.i18n. Locale files live in _locales/ (en is the fallback).
export const t = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String)) || key;

/** Fills [data-i18n], [data-i18n-placeholder], [data-i18n-label] and <html lang>. */
export function applyI18n(root = document) {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  root.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-label]').forEach((node) => {
    const text = t(node.dataset.i18nLabel);
    node.setAttribute('aria-label', text);
    node.title = text;
  });
}

/** Best guess of the user's main language from the browser UI language. */
export function detectLanguage() {
  const ui = (chrome.i18n.getUILanguage() || 'en').toLowerCase();
  if (ui.startsWith('zh')) return /tw|hk|mo|hant/.test(ui) ? '繁體中文' : '简体中文';
  const map = { ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch', es: 'Español', pt: 'Português', it: 'Italiano', ru: 'Русский', ar: 'العربية', hi: 'हिन्दी', id: 'Bahasa Indonesia', vi: 'Tiếng Việt', th: 'ไทย', tr: 'Türkçe' };
  return map[ui.split('-')[0]] || 'English';
}
