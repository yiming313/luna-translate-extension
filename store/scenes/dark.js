// Headless Chrome ignores the dark colour scheme, so the scenes force the extension's dark palette
// by disabling its light-mode media queries (the extension itself is untouched).
window.loadDark = async (href) => {
  const css = (await (await fetch(href)).text()).replaceAll('@media (prefers-color-scheme: light)', '@media not all');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
};
window.runDark = async (href) => {
  const js = (await (await fetch(href)).text()).replaceAll('@media (prefers-color-scheme: light)', '@media not all');
  (0, eval)(js);
};
