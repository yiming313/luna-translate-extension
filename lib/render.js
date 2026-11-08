// Tiny, safe renderer for the model's reply. Builds DOM nodes with textContent only (no innerHTML).
// Loaded as a classic script in the popup: exposes window.LunaRender.
(() => {
  /**
   * Splits a reply into blocks: { label, text, heading? }.
   * "### Title" starts a heading, "***Label:***" starts a labelled block (its lines may be "> quoted"),
   * everything else is collected into plain blocks.
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
      const labelMatch = line.match(/^\s*(?:[-*]\s*)?\*{3}([^*]+?)\*{3}\s*$/);
      if (labelMatch) {
        flush();
        current = { label: labelMatch[1].replace(/\s*[:：]\s*$/, ''), text: '' };
        continue;
      }
      const heading = line.match(/^\s*#{1,4}\s+(.*)$/);
      if (heading) {
        flush();
        blocks.push({ label: '', text: heading[1].trim(), heading: true });
        continue;
      }
      if (!current) current = { label: '', text: '' };
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

  /** Appends `text` to `parent`, turning **bold** segments into <strong>. */
  function inline(doc, parent, text) {
    text.split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
      if (!part) return;
      parent.append(i % 2 ? el(doc, 'strong', '', part) : doc.createTextNode(part));
    });
  }

  /** Renders the lines of one block: bullets, "**Key:** value" rows and plain lines. */
  function renderLines(doc, container, text) {
    for (const raw of text.split('\n')) {
      const line = raw.trimEnd();
      if (!line.trim()) continue;
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      const row = el(doc, 'div', bullet ? 'lt-line lt-bullet' : 'lt-line');
      inline(doc, row, bullet ? bullet[1] : line);
      container.append(row);
    }
  }

  /**
   * Renders a reply into `container`.
   * actions: [{ label, onClick(text, button) }] shown under labelled blocks (or under the only block of a plain reply).
   */
  function render(container, reply, actions = []) {
    const doc = container.ownerDocument;
    container.replaceChildren();
    const blocks = parse(reply);
    const hasLabelled = blocks.some((b) => b.label);
    for (const block of blocks) {
      if (block.heading) {
        container.append(el(doc, 'h4', 'lt-heading', block.text));
        continue;
      }
      const wrap = el(doc, 'div', 'lt-block');
      if (block.label) wrap.append(el(doc, 'div', 'lt-label', block.label));
      const body = el(doc, 'div', 'lt-text');
      renderLines(doc, body, block.text);
      wrap.append(body);
      if (actions.length && (block.label || !hasLabelled)) {
        const bar = el(doc, 'div', 'lt-actions');
        for (const action of actions) {
          const button = el(doc, 'button', 'lt-action', action.label);
          button.type = 'button';
          button.addEventListener('click', () => action.onClick(block.text.replace(/\*\*/g, ''), button));
          bar.append(button);
        }
        wrap.append(bar);
      }
      container.append(wrap);
    }
  }

  window.LunaRender = { parse, render };
})();
