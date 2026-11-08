// Injected on demand (activeTab). Shows the result card in a closed-off shadow root so page CSS cannot touch it.
(() => {
  if (window.__lunaTranslateLoaded) return;
  window.__lunaTranslateLoaded = true;

  const STYLE = `
    :host { all: initial; }
    .card { position: fixed; z-index: 2147483647; right: 20px; top: 20px; width: min(420px, calc(100vw - 40px)); max-height: calc(100vh - 40px); display: flex; flex-direction: column; font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif; color: #e8edf7; background: #0f1729; border: 1px solid #2b3a5c; border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,.45); }
    header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #22304f; }
    header strong { flex: 1; font-size: 13px; letter-spacing: .02em; }
    .close { border: 0; background: none; color: #8fa0c4; font-size: 18px; cursor: pointer; line-height: 1; }
    .body { padding: 12px; overflow: auto; }
    .source { margin: 0 0 10px; padding-bottom: 10px; border-bottom: 1px dashed #22304f; color: #8fa0c4; font-size: 12px; max-height: 4.6em; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; }
    .status { color: #8fa0c4; }
    .error { color: #ff9a9a; white-space: pre-wrap; overflow-wrap: anywhere; }
    .lt-block { margin: 0 0 10px; padding: 10px 12px; border-radius: 10px; background: #16213a; }
    .lt-label { margin-bottom: 4px; color: #75e6e0; font-size: 11px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
    .lt-text { white-space: pre-wrap; overflow-wrap: anywhere; }
    .lt-heading { margin: 8px 0 6px; font-size: 13px; color: #9e8cff; }
    .lt-actions { display: flex; gap: 8px; margin-top: 8px; }
    .lt-action { padding: 3px 10px; border: 1px solid #2b3a5c; border-radius: 7px; background: transparent; color: #c6d2ee; font: inherit; font-size: 12px; cursor: pointer; }
    .lt-action:hover { border-color: #75e6e0; color: #75e6e0; }
    @media (prefers-color-scheme: light) {
      .card { color: #172033; background: #ffffff; border-color: #d5dcec; }
      header { border-color: #e4e9f4; } .source { border-color: #e4e9f4; color: #5a6a8a; }
      .lt-block { background: #f1f4fb; } .lt-label { color: #0b7d78; } .lt-heading { color: #5a46c8; }
      .lt-action { border-color: #ccd5e8; color: #34456b; } .lt-action:hover { border-color: #0b7d78; color: #0b7d78; }
      .status { color: #5a6a8a; } .error { color: #b3261e; }
    }
  `;

  const host = document.createElement('div');
  host.style.all = 'initial';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'dialog');
  const header = document.createElement('header');
  const title = document.createElement('strong');
  const close = document.createElement('button');
  close.className = 'close';
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', chrome.i18n.getMessage('close'));
  header.append(title, close);
  const body = document.createElement('div');
  body.className = 'body';
  card.append(header, body);
  shadow.append(style, card);

  // Remember where the selection was so "replace" can write back into editable fields.
  let target = null;
  function captureTarget() {
    const active = document.activeElement;
    if (active && typeof active.selectionStart === 'number' && active.selectionEnd > active.selectionStart) {
      target = { kind: 'field', node: active, start: active.selectionStart, end: active.selectionEnd };
      return;
    }
    const selection = window.getSelection();
    if (selection && selection.rangeCount && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === 1 ? container : container.parentElement;
      target = element && element.isContentEditable ? { kind: 'editable', range: range.cloneRange() } : null;
      return;
    }
    // Selection may have been cleared by opening the context menu; keep the previous target.
  }

  function replaceSelection(text) {
    if (!target) return false;
    if (target.kind === 'field') {
      const { node, start, end } = target;
      node.focus();
      node.setRangeText(text, start, end, 'end');
      node.dispatchEvent(new Event('input', { bubbles: true }));
      target = null;
      return true;
    }
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(target.range);
    const ok = document.execCommand('insertText', false, text);
    target = null;
    return ok;
  }

  function remove() {
    host.remove();
  }
  close.addEventListener('click', remove);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && host.isConnected) remove();
  }, true);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'luna-show') return;
    if (message.status === 'loading') captureTarget();
    if (!host.isConnected) document.documentElement.append(host);
    title.textContent = `Luna · ${message.label}`;
    body.replaceChildren();

    const source = document.createElement('p');
    source.className = 'source';
    source.textContent = message.text;
    body.append(source);

    const area = document.createElement('div');
    body.append(area);
    if (message.status === 'loading') {
      const p = document.createElement('p');
      p.className = 'status';
      p.textContent = message.loading;
      area.append(p);
    } else if (message.status === 'error') {
      const p = document.createElement('p');
      p.className = 'error';
      p.textContent = message.error;
      area.append(p);
    } else {
      const actions = [{
        label: chrome.i18n.getMessage('copy'),
        onClick: async (text, button) => {
          try { await navigator.clipboard.writeText(text); button.textContent = chrome.i18n.getMessage('copied'); } catch { button.textContent = chrome.i18n.getMessage('copyFailed'); }
        },
      }];
      if (target) {
        actions.push({
          label: chrome.i18n.getMessage('replaceOriginal'),
          onClick: (text, button) => {
            button.textContent = chrome.i18n.getMessage(replaceSelection(text) ? 'replaced' : 'replaceFailed');
          },
        });
      }
      window.LunaRender.render(area, message.result, actions);
    }
  });
})();
