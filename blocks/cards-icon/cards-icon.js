import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-icon-item';
    const body = document.createElement('div');
    body.className = 'cards-icon-body';
    let icon = null;

    [...row.children].forEach((cell) => {
      const pic = cell.querySelector('picture, img, .icon');
      if (!icon && pic && !cell.textContent.trim()) {
        icon = cell;
        icon.className = 'cards-icon-icon';
      } else if (cell.textContent.trim()) {
        body.append(...cell.childNodes);
      }
    });
    if (!icon && !body.childNodes.length) return;
    if (icon) li.append(icon);
    if (body.childNodes.length) li.append(body);

    const title = body.querySelector('h1, h2, h3, h4, h5, h6');
    if (title) title.classList.add('cards-icon-title');
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '200' }]));
  });
  block.replaceChildren(ul);
}
