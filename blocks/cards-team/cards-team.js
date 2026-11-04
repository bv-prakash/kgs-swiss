import { createOptimizedPicture } from '../../scripts/aem.js';

function optimize(picture) {
  const img = picture.querySelector('img');
  if (!img) return picture;
  const url = new URL(img.src, window.location.href);
  if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return picture;
  return createOptimizedPicture(img.src, img.alt, false, [
    { media: '(min-width: 768px)', width: '600' },
    { width: '400' },
  ]);
}

// the name is a bold-only paragraph (or a heading); everything else is the role
function isName(el) {
  if (/^H[1-6]$/.test(el.tagName)) return true;
  const strong = el.querySelector('strong, b');
  return !!strong && el.textContent.trim() === strong.textContent.trim();
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-team-item';
    const body = document.createElement('div');
    body.className = 'cards-team-body';
    let picture = null;

    [...row.children].forEach((cell) => {
      const pic = cell.querySelector('picture') || cell.querySelector('img');
      if (pic && !picture) picture = pic;
      if (!cell.children.length && cell.textContent.trim()) {
        // a single-paragraph cell arrives as bare text
        const p = document.createElement('p');
        p.append(...cell.childNodes);
        body.append(p);
        return;
      }
      [...cell.children].forEach((el) => {
        if (el.contains(picture) && !el.textContent.trim()) return;
        if (el.textContent.trim()) body.append(el);
      });
    });

    if (!picture && !body.textContent.trim()) return;

    [...body.children].forEach((el) => {
      if (isName(el)) {
        el.classList.add('cards-team-name');
      } else {
        el.classList.add('cards-team-role');
      }
    });

    if (picture) {
      const frame = document.createElement('div');
      frame.className = 'cards-team-image';
      const pic = picture.tagName === 'PICTURE' ? picture : picture.closest('picture') || picture;
      frame.append(optimize(pic));
      li.append(frame);
    }
    li.append(body);
    ul.append(li);
  });
  block.replaceChildren(ul);
}
