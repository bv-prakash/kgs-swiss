import { createOptimizedPicture } from '../../scripts/aem.js';

function isImageCell(cell) {
  return cell.querySelector('picture') && cell.textContent.trim() === '';
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-industry-item';
    [...row.children].forEach((cell) => {
      if (isImageCell(cell)) {
        cell.className = 'cards-industry-image';
        li.append(cell);
      } else if (cell.textContent.trim()) {
        cell.className = 'cards-industry-body';
        li.append(cell);
      }
    });
    if (!li.children.length) return;
    if (!li.querySelector('.cards-industry-image')) li.classList.add('cards-industry-no-image');

    const body = li.querySelector('.cards-industry-body');
    if (body) {
      const title = body.querySelector('h1, h2, h3, h4, h5, h6');
      if (title) title.classList.add('cards-industry-title');
      [...body.children].forEach((el) => {
        if (el === title) return;
        const a = el.querySelector('a');
        if (a && el.textContent.trim() === a.textContent.trim()) {
          el.classList.add('cards-industry-link');
        } else if (el.textContent.trim()) {
          el.classList.add('cards-industry-description');
        }
      });

      // a title-only tile (e.g. "All Industries") gets a flat, overlay-free treatment
      if (!body.querySelector('.cards-industry-description')) li.classList.add('cards-industry-no-description');

      // the whole tile is clickable through the first link (stretched)
      const link = body.querySelector('.cards-industry-link a') || body.querySelector('a');
      if (link) {
        li.classList.add('cards-industry-linked');
        link.classList.add('cards-industry-stretched');
      }
    }
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
  block.replaceChildren(ul);
}
