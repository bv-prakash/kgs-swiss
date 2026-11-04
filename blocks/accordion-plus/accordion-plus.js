export default function decorate(block) {
  [...block.children].forEach((row) => {
    const [label, ...rest] = [...row.children];
    if (!label || !label.textContent.trim()) {
      row.remove();
      return;
    }

    const summary = document.createElement('summary');
    summary.className = 'accordion-plus-label';
    // unwrap a single heading/paragraph so the label stays inline in <summary>
    const only = label.children.length === 1 ? label.firstElementChild : null;
    if (only && /^(P|H[1-6])$/.test(only.tagName)) summary.append(...only.childNodes);
    else summary.append(...label.childNodes);

    const body = document.createElement('div');
    body.className = 'accordion-plus-body';
    rest.forEach((cell) => body.append(...cell.childNodes));

    const details = document.createElement('details');
    details.className = 'accordion-plus-item';
    details.append(summary, body);
    row.replaceWith(details);
  });
}
