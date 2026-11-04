import { createOptimizedPicture } from '../../scripts/aem.js';

const HEADING = 'h1, h2, h3, h4, h5, h6';
// a short label with no sentence punctuation reads as an eyebrow
const EYEBROW_MAX_LENGTH = 60;

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

function isImageOnly(cell) {
  return !!cell.querySelector('picture, img') && !cell.textContent.trim();
}

function decorateMedia(cell) {
  cell.classList.add('columns-notched-media');
  const pics = [...cell.querySelectorAll('picture')];
  const frame = document.createElement('div');
  frame.className = 'columns-notched-frame';
  // two images: the first is for tablet/desktop, the second for mobile
  if (pics.length > 1) {
    pics[0].classList.add('columns-notched-desktop-only');
    pics[1].classList.add('columns-notched-mobile-only');
    frame.append(pics[0], pics[1]);
  } else if (pics.length === 1) {
    frame.append(pics[0]);
  } else {
    // bare <img> without a <picture> wrapper
    const img = cell.querySelector('img');
    if (img) frame.append(img);
  }
  cell.replaceChildren(frame);
}

// a list whose every item starts with an icon renders as a ruled icon list
function markIconLists(cell) {
  cell.querySelectorAll(':scope > ul').forEach((ul) => {
    const items = [...ul.children];
    const iconFirst = (li) => {
      const first = li.firstElementChild;
      return first && (first.matches('picture, img, .icon')
        || (first.tagName === 'P' && first.querySelector(':scope > picture:first-child, :scope > img:first-child')));
    };
    if (items.length && items.every(iconFirst)) ul.classList.add('columns-notched-icon-list');
  });
}

function decorateText(cell) {
  cell.classList.add('columns-notched-text');
  markIconLists(cell);
  const first = cell.firstElementChild;
  if (!first || first.tagName !== 'P' || !first.nextElementSibling) return;
  const text = first.textContent.trim();
  const isLabel = text
    && text.length <= EYEBROW_MAX_LENGTH
    && !/[.!?:]$/.test(text)
    && !first.querySelector('a, picture, img');
  if (isLabel) first.classList.add('columns-notched-eyebrow');
}

function decorateBox(cell) {
  decorateText(cell);
  cell.classList.add('columns-notched-box');
  // consecutive lists sit side by side inside the dark box
  const lists = [...cell.querySelectorAll(':scope > ul, :scope > ol')];
  if (lists.length > 1) {
    const group = document.createElement('div');
    group.className = 'columns-notched-lists';
    lists[0].before(group);
    group.append(...lists);
  }
}

function isImageParagraph(el) {
  return !!el && !!el.querySelector('picture, img') && !el.textContent.trim();
}

/* a box cell that ends with an image: the text becomes the dark box and the
   trailing image sits underneath it (about-us "Our Vision"). Returns false when the
   image is not at the end, so the cell falls back to a plain box. */
function decorateStackedBox(cell) {
  const children = [...cell.children];
  const media = [];
  while (children.length && isImageParagraph(children[children.length - 1])) {
    media.unshift(children.pop());
  }
  if (!media.length || !children.length) return false;
  const box = document.createElement('div');
  box.append(...children);
  const frame = document.createElement('div');
  frame.className = 'columns-notched-box-media';
  media.forEach((el) => {
    if (el.matches('picture, img')) frame.append(el);
    else frame.append(...el.querySelectorAll('picture, img:not(picture img)'));
  });
  cell.replaceChildren(box, frame);
  cell.classList.add('columns-notched-stack');
  decorateBox(box);
  return true;
}

function hasTextAndImage(cell) {
  return !!cell.querySelector('picture, img') && !!cell.textContent.trim();
}

export default function decorate(block) {
  optimizeImages(block);

  // option "dark": the first text cell is the navy box, butted against the image
  const isDark = block.classList.contains('dark');
  let hasImage = false;
  let hasBox = false;
  let hasStack = false;
  [...block.children].forEach((row) => {
    row.classList.add('columns-notched-row');
    const cells = [...row.children];
    // drop cells an author left completely empty
    cells.forEach((cell) => {
      if (!cell.textContent.trim() && !cell.querySelector('picture, img')) cell.remove();
    });
    [...row.children].forEach((cell, idx) => {
      if (isImageOnly(cell)) {
        decorateMedia(cell);
        hasImage = true;
      } else if (idx > 0 && hasTextAndImage(cell) && decorateStackedBox(cell)) {
        hasStack = true;
      } else if (idx > 0) {
        // a text cell after the first one renders as the dark notched box
        decorateBox(cell);
        hasBox = true;
      } else if (isDark) {
        decorateBox(cell);
      } else {
        decorateText(cell);
      }
    });
    if (!row.children.length) row.remove();
  });

  if (hasImage) block.classList.add('columns-notched-has-image');
  if (hasBox) block.classList.add('columns-notched-has-box');
  if (hasStack) block.classList.add('columns-notched-has-stack');

  // text + image led by a heading (about-us "Celebrating 120 years"), not an eyebrow (industries)
  const text = block.querySelector('.columns-notched-text:not(.columns-notched-box)');
  if (hasImage && !isDark && text?.firstElementChild?.matches(HEADING)) {
    block.classList.add('columns-notched-titled');
  }
  // dark box with a call to action (about-us "Our Purpose") stacks under its image until desktop
  if (isDark && block.querySelector('.columns-notched-box a[href]')) {
    block.classList.add('columns-notched-cta');
  }
}
