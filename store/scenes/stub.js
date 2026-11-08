// Fake `chrome` API so the real popup/options/content-script code can render in a plain page.
// Only used to produce store screenshots; scenes define window.SCENE before loading this.
(() => {
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang') === 'zh' ? 'zh_CN' : 'en';
  document.documentElement.dataset.lang = lang === 'zh_CN' ? 'zh' : 'en';
  const x = new XMLHttpRequest();
  x.open('GET', `/_locales/${lang}/messages.json`, false);
  x.send();
  const msgs = JSON.parse(x.responseText);
  const S = window.SCENE[lang === 'zh_CN' ? 'zh' : 'en'];
  window.chrome = {
    i18n: {
      getUILanguage: () => (lang === 'zh_CN' ? 'zh-CN' : 'en-US'),
      getMessage: (key, subs = []) => {
        const m = msgs[key];
        if (!m) return '';
        let out = m.message;
        for (const [name, ph] of Object.entries(m.placeholders || {})) {
          out = out.replace(`$${name.toUpperCase()}$`, ph.content.replace('$1', subs[0] ?? ''));
        }
        return out;
      },
    },
    storage: { local: {
      get: async () => ({ settings: window.SCENE.settings, popupMode: window.SCENE.mode }),
      set: async () => {},
    } },
    runtime: {
      sendMessage: async () => ({ ok: true, result: S.result }),
      onMessage: { addListener: (fn) => { window.__onMessage = fn; } },
      openOptionsPage: () => {},
    },
    permissions: { contains: async () => true, request: async () => true },
  };
})();
