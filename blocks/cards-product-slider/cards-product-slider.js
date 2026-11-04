import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizeImages(block) {
  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function buildCard(row) {
  const li = document.createElement('li');
  li.className = 'cards-product-slider-card';
  [...row.children].forEach((cell) => {
    const hasMedia = cell.querySelector('picture, img');
    if (!cell.textContent.trim() && !hasMedia) return;
    if (hasMedia && !cell.textContent.trim()) {
      // keep one image per card; a second (mobile) image is not needed at this size
      const pic = cell.querySelector('picture') || cell.querySelector('img');
      cell.replaceChildren(pic);
      cell.className = 'cards-product-slider-card-image';
    } else {
      cell.className = 'cards-product-slider-card-body';
      const first = cell.querySelector(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
      if (first) first.classList.add('cards-product-slider-card-title');
    }
    li.append(cell);
  });
  return li.children.length ? li : null;
}

function makeButton(dir, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `cards-product-slider-${dir}`;
  button.setAttribute('aria-label', label);
  return button;
}

export default function decorate(block) {
  optimizeImages(block);

  const list = document.createElement('ul');
  list.className = 'cards-product-slider-list';
  [...block.children].forEach((row) => {
    const card = buildCard(row);
    if (card) list.append(card);
  });

  // the scroller is focusable so keyboard users can scroll it with the arrow keys
  const scroller = document.createElement('div');
  scroller.className = 'cards-product-slider-scroller';
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'group');
  scroller.setAttribute('aria-label', 'Products');
  scroller.append(list);

  const prev = makeButton('prev', 'Previous');
  const next = makeButton('next', 'Next');

  const dots = document.createElement('div');
  dots.className = 'cards-product-slider-dots';
  const cards = [...list.children];
  const dotButtons = cards.map((card, idx) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'cards-product-slider-dot';
    const title = card.querySelector('.cards-product-slider-card-title');
    dot.setAttribute('aria-label', title ? title.textContent.trim() : `Product ${idx + 1}`);
    dots.append(dot);
    return dot;
  });

  block.replaceChildren(prev, scroller, next, dots);

  const step = () => {
    if (cards.length < 2) return scroller.clientWidth;
    return cards[1].offsetLeft - cards[0].offsetLeft;
  };
  const scrollToCard = (idx) => {
    const target = cards[Math.max(0, Math.min(idx, cards.length - 1))];
    scroller.scrollTo({ left: target.offsetLeft - cards[0].offsetLeft, behavior: 'smooth' });
  };

  const update = () => {
    const max = scroller.scrollWidth - scroller.clientWidth;
    const atStart = scroller.scrollLeft <= 1;
    const atEnd = scroller.scrollLeft >= max - 1;
    prev.disabled = atStart;
    next.disabled = atEnd;
    block.classList.toggle('cards-product-slider-static', max <= 1);
    const current = atEnd && max > 1 ? cards.length - 1 : Math.round(scroller.scrollLeft / step());
    dotButtons.forEach((dot, i) => dot.setAttribute('aria-current', i === current ? 'true' : 'false'));
  };

  prev.addEventListener('click', () => scroller.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => scroller.scrollBy({ left: step(), behavior: 'smooth' }));
  dotButtons.forEach((dot, i) => dot.addEventListener('click', () => scrollToCard(i)));

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  scroller.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(schedule).observe(scroller);
  update();
}
