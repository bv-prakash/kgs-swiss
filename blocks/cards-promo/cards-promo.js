export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-promo-item';
    const body = document.createElement('div');
    body.className = 'cards-promo-body';
    [...row.children].forEach((cell) => body.append(...cell.childNodes));
    if (!body.textContent.trim()) return;

    const title = body.querySelector('h1, h2, h3, h4, h5, h6');
    if (title) title.classList.add('cards-promo-title');
    // trailing link-only paragraphs form the CTA area
    const parts = [...body.children];
    let firstCta = null;
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const el = parts[i];
      const a = el.querySelector('a');
      if (el === title || !a || el.textContent.trim() !== a.textContent.trim()) break;
      el.classList.add('cards-promo-cta');
      firstCta = el;
    }
    if (firstCta) firstCta.classList.add('cards-promo-cta-first');
    li.append(body);
    ul.append(li);
  });
  block.replaceChildren(ul);
}
