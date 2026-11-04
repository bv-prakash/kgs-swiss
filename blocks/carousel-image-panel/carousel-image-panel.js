import { createOptimizedPicture } from '../../scripts/aem.js';

let instanceCount = 0;

function optimizeImages(block) {
  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [
      { media: '(min-width: 768px)', width: '1000' },
      { width: '750' },
    ]));
  });
}

function hasText(cell) {
  return !!cell.textContent.trim();
}

/** Collects the fixed image (first row's pictures) and one slide per row text cell. */
function readRows(block) {
  let media = null;
  const slides = [];
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => {
      if (hasText(cell)) {
        slides.push(cell);
      } else if (!media && cell.querySelector('picture, img')) {
        media = [...cell.querySelectorAll('picture')];
        if (!media.length) media = [cell.querySelector('img')];
      }
    });
  });
  return { media, slides };
}

function buildMedia(pics) {
  const media = document.createElement('div');
  media.className = 'carousel-image-panel-media';
  // two images: the first is for tablet/desktop, the second for mobile
  if (pics.length > 1) {
    pics[0].classList.add('carousel-image-panel-desktop-only');
    pics[1].classList.add('carousel-image-panel-mobile-only');
    media.append(pics[0], pics[1]);
  } else {
    media.append(pics[0]);
  }
  return media;
}

export default function decorate(block) {
  instanceCount += 1;
  const id = `carousel-image-panel-${instanceCount}`;
  optimizeImages(block);
  const { media, slides } = readRows(block);

  const panel = document.createElement('div');
  panel.className = 'carousel-image-panel-panel';
  const track = document.createElement('div');
  track.className = 'carousel-image-panel-slides';
  panel.append(track);

  const tabs = document.createElement('div');
  tabs.className = 'carousel-image-panel-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Slides');

  const buttons = slides.map((cell, idx) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-image-panel-slide';
    slide.id = `${id}-slide-${idx}`;
    slide.append(...cell.childNodes);
    // drop empty trailing paragraphs the source leaves after each slide
    slide.querySelectorAll('p').forEach((p) => {
      if (!p.textContent.trim() && !p.querySelector('picture, img')) p.remove();
    });
    track.append(slide);

    const heading = slide.querySelector('h1, h2, h3, h4, h5, h6');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'carousel-image-panel-tab';
    button.id = `${id}-tab-${idx}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', slide.id);
    button.setAttribute('aria-label', heading ? heading.textContent.trim() : `Slide ${idx + 1} of ${slides.length}`);
    tabs.append(button);

    slide.setAttribute('role', 'tabpanel');
    slide.setAttribute('aria-labelledby', button.id);
    return button;
  });

  const content = [];
  if (media) content.push(buildMedia(media));
  else block.classList.add('carousel-image-panel-no-image');
  content.push(panel);
  block.replaceChildren(...content);

  if (slides.length < 2) {
    // a single slide is shown as static text, without tabs
    track.querySelectorAll('.carousel-image-panel-slide').forEach((slide) => {
      slide.classList.add('is-active');
      slide.removeAttribute('role');
      slide.removeAttribute('aria-labelledby');
    });
    return;
  }
  panel.append(tabs);
  block.setAttribute('aria-roledescription', 'carousel');

  const slideEls = [...track.children];
  let active = 0;
  const show = (index, focus = false) => {
    active = (index + slideEls.length) % slideEls.length;
    slideEls.forEach((slide, i) => {
      const on = i === active;
      slide.classList.toggle('is-active', on);
      // hidden slides leave the tab order and the accessibility tree
      slide.inert = !on;
    });
    buttons.forEach((button, i) => {
      const on = i === active;
      button.setAttribute('aria-selected', on ? 'true' : 'false');
      button.tabIndex = on ? 0 : -1;
    });
    if (focus) buttons[active].focus();
  };

  buttons.forEach((button, i) => button.addEventListener('click', () => show(i)));

  // roving focus across the tabs (WAI-ARIA tabs pattern, automatic activation)
  tabs.addEventListener('keydown', (e) => {
    const keys = {
      ArrowRight: active + 1,
      ArrowDown: active + 1,
      ArrowLeft: active - 1,
      ArrowUp: active - 1,
      Home: 0,
      End: slideEls.length - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    show(keys[e.key], true);
  });

  // horizontal swipe on touch screens
  let startX = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    startX = e.clientX;
  });
  track.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) show(active + (dx < 0 ? 1 : -1));
  });
  track.addEventListener('pointercancel', () => { startX = null; });

  show(0);
}
