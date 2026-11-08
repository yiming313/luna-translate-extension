// Tiny, safe renderer for the model's reply. Builds DOM nodes with textContent only (no innerHTML).
// Loaded as a classic script in the popup and the content script: exposes window.LunaRender.
(() => {
  /**
   * Splits a reply into blocks: { label, text, quoted }.
   * Polish replies look like "***Warm:***\n>text"; translations are plain text.
   */
  function parse(reply) {
    const lines = String(reply).replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    let current = null;
    const flush = () => {
      if (current && current.text.trim()) blocks.push({ ...current, text: current.text.trim() });
      current = null;
    };
    for (const line of lines) {
      const labelMatch = line.match(/^\s*(?:[-*]\s*)?\*{2,3}([^*]+?)\*{2,3}\s*$/);
      if (labelMatch) {
        flush();
        current = { label: labelMatch[1].replace(/:\s*$/, ''), text: '', quoted: true };
        continue;
      }
      const heading = line.match(/^\s*#{1,4}\s+(.*)$/);
      if (heading) {
        flush();
        blocks.push({ label: '', text: heading[1].trim(), quoted: false, heading: true });
        continue;
      }
      if (!current) current = { label: '', text: '', quoted: false };
      current.text += `${line.replace(/^\s*>\s?/, '')}\n`;
    }
    flush();
    return blocks;
  }

  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /**
   * Renders a reply into `container`.
   * actions: [{ label, onClick(text) }] shown under every result block.
   */
  function render(container, reply, actions = []) {
    const doc = container.ownerDocument;
    container.replaceChildren();
    for (const block of parse(reply)) {
      if (block.heading) {
        container.append(el(doc, 'h4', 'lt-heading', block.text));
        continue;
      }
      const wrap = el(doc, 'div', 'lt-block');
      if (block.label) wrap.append(el(doc, 'div', 'lt-label', block.label));
      wrap.append(el(doc, 'div', 'lt-text', block.text));
      if (actions.length) {
        const bar = el(doc, 'div', 'lt-actions');
        for (const action of actions) {
          const button = el(doc, 'button', 'lt-action', action.label);
          button.type = 'button';
          button.addEventListener('click', () => action.onClick(block.text, button));
          bar.append(button);
        }
        wrap.append(bar);
      }
      container.append(wrap);
    }
  }

  window.LunaRender = { parse, render };
})();
