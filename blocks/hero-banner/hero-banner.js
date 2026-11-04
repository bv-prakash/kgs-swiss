import { createOptimizedPicture } from '../../scripts/aem.js';

function isImageOnly(cell) {
  return cell.querySelector('picture') && cell.textContent.trim() === '';
}

/**
 * Breadcrumb derived from the page path: Home > parent folders > page heading.
 * A leading /content folder (local preview) is kept in links but not shown.
 */
function buildBreadcrumb(title) {
  const parts = window.location.pathname.replace(/\.html$/, '').split('/').filter(Boolean);
  const offset = parts[0] === 'content' ? 1 : 0;
  const crumbs = [{ label: 'Home', href: '/' }];
  parts.slice(offset, -1).forEach((part, i) => {
    crumbs.push({
      label: part.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      href: `/${parts.slice(0, offset + i + 1).join('/')}`,
    });
  });
  crumbs.push({ label: title });

  const nav = document.createElement('nav');
  nav.className = 'hero-banner-breadcrumb';
  nav.setAttribute('aria-label', 'Breadcrumb');
  const list = document.createElement('ol');
  crumbs.forEach(({ label, href }) => {
    const li = document.createElement('li');
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      li.append(a);
    } else {
      li.textContent = label;
      li.setAttribute('aria-current', 'page');
    }
    list.append(li);
  });
  nav.append(list);
  return nav;
}

export default function decorate(block) {
  const media = document.createElement('div');
  media.className = 'hero-banner-media';
  const content = document.createElement('div');
  content.className = 'hero-banner-content';

  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => {
      if (isImageOnly(cell)) {
        media.append(...cell.childNodes);
      } else if (cell.textContent.trim() !== '' || cell.children.length) {
        // a stray picture inside a text cell still belongs to the background
        const strayPic = media.children.length ? null : cell.querySelector('picture');
        if (strayPic) {
          const parent = strayPic.parentElement;
          media.append(strayPic);
          if (parent && parent !== cell && parent.textContent.trim() === '' && !parent.children.length) parent.remove();
        }
        content.append(...cell.childNodes);
      }
    });
  });

  // mark CTA links: first is primary, the rest secondary
  const ctas = [...content.querySelectorAll('a')].filter((a) => {
    const p = a.closest('p');
    return p && p.textContent.trim() === a.textContent.trim();
  });
  ctas.forEach((a, i) => {
    a.classList.add('hero-banner-cta', i === 0 ? 'hero-banner-cta-primary' : 'hero-banner-cta-secondary');
    a.closest('p').classList.add('hero-banner-cta-wrapper');
  });

  // group the CTA paragraphs into one row so they can sit side by side
  const ctaWrappers = [...content.querySelectorAll('.hero-banner-cta-wrapper')];
  if (ctaWrappers.length) {
    const group = document.createElement('div');
    group.className = 'hero-banner-ctas';
    ctaWrappers[0].before(group);
    group.append(...ctaWrappers);
  }

  media.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, true, [
      { media: '(min-width: 900px)', width: '2000' },
      { width: '900' },
    ]));
  });

  // compact page banners lead with a breadcrumb back to their parent pages
  const heading = content.querySelector('h1');
  if (block.classList.contains('compact') && heading) {
    content.prepend(buildBreadcrumb(heading.textContent.trim()));
  }

  const children = [];
  if (media.children.length) children.push(media);
  else block.classList.add('hero-banner-no-image');
  if (content.childNodes.length) children.push(content);
  block.replaceChildren(...children);
}
