import { createOptimizedPicture } from '../../scripts/aem.js';

function isImageCell(cell) {
  return cell.querySelector('picture') && cell.textContent.trim() === '';
}

function isLinkOnly(el) {
  const a = el.querySelector('a');
  return a && el.textContent.trim() === a.textContent.trim();
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-news-item';
    const body = document.createElement('div');
    body.className = 'cards-news-body';
    let image = null;

    [...row.children].forEach((cell) => {
      if (!image && isImageCell(cell)) {
        image = cell;
        image.className = 'cards-news-image';
      } else if (cell.textContent.trim()) {
        body.append(...cell.childNodes);
      }
    });
    if (!image && !body.childNodes.length) return;
    if (image) li.append(image);
    if (body.childNodes.length) li.append(body);

    // body order: category (plain text), title (link or heading), read more (last link)
    const parts = [...body.children];
    const linkParts = parts.filter(isLinkOnly);
    const heading = parts.find((el) => /^H[1-6]$/.test(el.tagName));
    const readMore = linkParts.length > 1 || (linkParts.length === 1 && heading)
      ? linkParts[linkParts.length - 1] : null;
    const title = heading || linkParts.find((el) => el !== readMore) || null;
    if (title) title.classList.add('cards-news-title');
    if (readMore) readMore.classList.add('cards-news-read-more');
    const titleIndex = title ? parts.indexOf(title) : parts.length;
    parts.forEach((el, i) => {
      if (el === title || el === readMore) return;
      el.classList.add(i < titleIndex ? 'cards-news-category' : 'cards-news-description');
    });

    // link an unlinked image to the article
    const href = (title && title.querySelector('a')) || (readMore && readMore.querySelector('a'));
    if (image && href && !image.querySelector('a')) {
      const a = document.createElement('a');
      a.href = href.href;
      a.tabIndex = -1;
      a.setAttribute('aria-hidden', 'true');
      a.append(...image.childNodes);
      image.append(a);
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
