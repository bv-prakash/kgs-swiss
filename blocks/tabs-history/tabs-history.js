import { createOptimizedPicture } from '../../scripts/aem.js';

const HEADING = /^H[1-6]$/;

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [
      { media: '(min-width: 768px)', width: '750' },
      { width: '750' },
    ]));
  });
}

// cells may arrive as bare text when they hold a single paragraph
function cellElements(cell) {
  if (!cell) return [];
  if (!cell.children.length && cell.textContent.trim()) {
    const p = document.createElement('p');
    p.append(...cell.childNodes);
    return [p];
  }
  return [...cell.children];
}

function buildPanel(textCell, imageCells) {
  const panel = document.createElement('div');
  panel.className = 'tabs-history-panel';

  const parts = textCell ? cellElements(textCell) : [];
  // two headings in a row: the first is the period title above both columns
  if (parts.length > 1 && HEADING.test(parts[0].tagName) && HEADING.test(parts[1].tagName)) {
    const title = parts.shift();
    title.classList.add('tabs-history-title');
    panel.append(title);
  }

  const body = document.createElement('div');
  body.className = 'tabs-history-body';
  const text = document.createElement('div');
  text.className = 'tabs-history-text';
  parts.forEach((el) => {
    // images authored in the text cell move to the image column
    if (el.querySelector('picture, img') && !el.textContent.trim()) {
      imageCells.push(el);
      return;
    }
    text.append(el);
  });
  if (text.children.length) {
    const subtitle = text.firstElementChild;
    if (HEADING.test(subtitle.tagName)) subtitle.classList.add('tabs-history-subtitle');
    body.append(text);
  }

  const pictures = imageCells.flatMap((cell) => [...cell.querySelectorAll('picture')]
    .concat(cell.matches('picture') ? [cell] : []));
  const captions = imageCells.flatMap((cell) => [...cell.querySelectorAll('p, h1, h2, h3, h4, h5, h6')]
    .filter((el) => el.textContent.trim() && !el.querySelector('picture')));
  if (pictures.length || captions.length) {
    const media = document.createElement('div');
    media.className = 'tabs-history-media';
    if (pictures.length) {
      const frame = document.createElement('div');
      frame.className = 'tabs-history-frame';
      // two images: the first is for tablet/desktop, the second for mobile
      if (pictures.length > 1) {
        pictures[0].classList.add('tabs-history-desktop-only');
        pictures[1].classList.add('tabs-history-mobile-only');
      }
      frame.append(...pictures.slice(0, 2));
      media.append(frame);
    }
    captions.forEach((el) => {
      el.classList.add('tabs-history-caption');
      media.append(el);
    });
    body.append(media);
  }

  if (body.children.length) panel.append(body);
  return panel;
}

export default function decorate(block) {
  // optimise first: it replaces the <picture> elements the panels then classify
  optimizeImages(block);
  const uid = `tabs-history-${Math.random().toString(36).slice(2, 8)}`;
  const tablist = document.createElement('div');
  tablist.className = 'tabs-history-list';
  tablist.setAttribute('role', 'tablist');
  const panels = document.createElement('div');
  panels.className = 'tabs-history-panels';

  const tabs = [];
  [...block.children].forEach((row) => {
    const [labelCell, textCell, ...imageCells] = [...row.children];
    const label = labelCell ? labelCell.textContent.trim() : '';
    if (!label) return;
    const idx = tabs.length;

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tabs-history-tab';
    tab.id = `${uid}-tab-${idx}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `${uid}-panel-${idx}`);
    tab.textContent = label;

    const panel = buildPanel(textCell, imageCells);
    panel.id = `${uid}-panel-${idx}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;

    tablist.append(tab);
    panels.append(panel);
    tabs.push({ tab, panel });
  });

  const select = (index, focus = false) => {
    tabs.forEach(({ tab, panel }, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panel.hidden = !active;
    });
    const { tab } = tabs[index];
    if (focus) tab.focus();
    // keep the active tab visible in the scrolling bar
    const left = tab.offsetLeft - tablist.offsetLeft;
    if (left < tablist.scrollLeft || left + tab.offsetWidth > tablist.scrollLeft + tablist.clientWidth) {
      tablist.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
    }
  };

  tabs.forEach(({ tab }, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (e) => {
      const last = tabs.length - 1;
      let next = null;
      if (e.key === 'ArrowRight') next = i === last ? 0 : i + 1;
      else if (e.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = last;
      if (next === null) return;
      e.preventDefault();
      select(next, true);
    });
  });

  block.replaceChildren(tablist, panels);
  if (tabs.length) select(0);
}
