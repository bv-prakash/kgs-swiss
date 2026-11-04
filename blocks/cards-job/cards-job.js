// jobs shown per page; the source paginates its job list 4 at a time
const PAGE_SIZE = 4;

function isLinkOnly(el) {
  const a = el.querySelector('a[href]');
  return !!a && el.textContent.trim() === a.textContent.trim();
}

function buildCard(row) {
  // a cell holding a single paragraph arrives as bare text: wrap it so it reads like the rest
  const parts = [...row.children].flatMap((cell) => {
    if (!cell.children.length && cell.textContent.trim()) {
      const p = document.createElement('p');
      p.append(...cell.childNodes);
      return [p];
    }
    return [...cell.children];
  });
  if (!parts.length) return null;

  const li = document.createElement('li');
  li.className = 'cards-job-card';

  const header = document.createElement('div');
  header.className = 'cards-job-header';
  const title = parts.find((el) => /^H[1-6]$/.test(el.tagName));
  if (title) {
    title.classList.add('cards-job-title');
    header.append(title);
  }

  // the last link-only paragraph is the "View details" link
  const linkEl = [...parts].reverse().find((el) => el !== title && isLinkOnly(el));
  const info = document.createElement('div');
  info.className = 'cards-job-info';
  parts
    .filter((el) => el !== title && el !== linkEl && el.textContent.trim())
    .forEach((el, idx) => {
      const meta = document.createElement('p');
      meta.className = 'cards-job-meta';
      // the first fact is the location; the block draws a pin in front of it
      if (idx === 0) meta.classList.add('cards-job-location');
      meta.append(...el.childNodes);
      info.append(meta);
    });

  li.append(header);
  if (info.children.length) li.append(info);
  if (linkEl) {
    const link = document.createElement('p');
    link.className = 'cards-job-link';
    const a = linkEl.querySelector('a');
    a.className = '';
    if (title && !a.getAttribute('aria-label')) {
      a.setAttribute('aria-label', `${a.textContent.trim()}: ${title.textContent.trim()}`);
    }
    link.append(a);
    li.append(link);
  }
  if (!li.textContent.trim()) return null;
  return li;
}

function buildPager(block, list, items) {
  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const nav = document.createElement('nav');
  nav.className = 'cards-job-pager';
  nav.setAttribute('aria-label', 'Job pages');
  const ul = document.createElement('ul');
  nav.append(ul);

  const show = (page, focusList = false) => {
    items.forEach((item, idx) => {
      item.hidden = Math.floor(idx / PAGE_SIZE) !== page;
    });
    ul.replaceChildren();
    const addButton = (label, target, cls, current = false) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = cls;
      button.textContent = label;
      if (current) button.setAttribute('aria-current', 'page');
      else button.addEventListener('click', () => show(target, true));
      if (cls === 'cards-job-page') button.setAttribute('aria-label', `Page ${label}`);
      li.append(button);
      ul.append(li);
    };
    if (page > 0) addButton('Previous', page - 1, 'cards-job-step');
    for (let i = 0; i < pageCount; i += 1) addButton(String(i + 1), i, 'cards-job-page', i === page);
    if (page < pageCount - 1) addButton('Next', page + 1, 'cards-job-step');
    if (focusList) {
      const first = items[page * PAGE_SIZE];
      const target = first && first.querySelector('a, h1, h2, h3, h4, h5, h6');
      if (target) {
        if (!target.matches('a')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
      block.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  list.after(nav);
  show(0);
}

export default function decorate(block) {
  const list = document.createElement('ul');
  list.className = 'cards-job-list';
  [...block.children].forEach((row) => {
    const card = buildCard(row);
    if (card) list.append(card);
  });
  block.replaceChildren(list);

  // introduced by a lone heading (careers "Open Positions"): the full job listing, not a teaser
  const intro = block.closest('.section')?.querySelector(':scope > .default-content-wrapper');
  if (intro && intro.children.length === 1 && /^H[1-6]$/.test(intro.firstElementChild.tagName)) {
    block.classList.add('cards-job-listing');
  }

  const items = [...list.children];
  if (items.length > PAGE_SIZE) buildPager(block, list, items);
}
