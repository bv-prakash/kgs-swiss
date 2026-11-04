import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-logos-item';
    let pic = null;
    const nameParts = [];
    [...row.children].forEach((cell) => {
      const cellPic = cell.querySelector('picture');
      if (cellPic && !pic) {
        pic = cell.querySelector('a') && cell.querySelector('a').contains(cellPic)
          ? cell.querySelector('a') : cellPic;
      }
      if (cell.textContent.trim()) nameParts.push(cell.textContent.trim());
    });
    if (!pic && !nameParts.length) return;

    if (pic) {
      const logo = document.createElement('div');
      logo.className = 'cards-logos-logo';
      logo.append(pic);
      li.append(logo);
      const img = logo.querySelector('img');
      if (img && !img.alt && nameParts.length) img.alt = nameParts.join(' ');
    }
    if (nameParts.length) {
      const name = document.createElement('p');
      name.className = pic ? 'cards-logos-name cards-logos-name-hidden' : 'cards-logos-name';
      name.textContent = nameParts.join(' ');
      li.append(name);
    }
    if (pic && nameParts.length) {
      // the logo alt already names the brand; avoid a duplicate announcement
      li.querySelector('.cards-logos-name').setAttribute('aria-hidden', 'true');
    }
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '400' }]));
  });
  block.replaceChildren(ul);
}
