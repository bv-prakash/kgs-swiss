/**
 * Fetches the footer fragment. Metadata-independent: /content first (local preview),
 * then the site root (Document Authoring / EDS preview and live).
 * @returns {Promise<Element|null>} container holding the footer sections
 */
async function fetchFooter() {
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) resp = await fetch('/footer.plain.html');
  if (!resp.ok) return null;
  const container = document.createElement('div');
  container.innerHTML = await resp.text();
  // resolve relative image paths against the fragment's own URL
  container.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!/^(https?:|data:|\/)/.test(src)) img.src = new URL(src, resp.url).href;
  });
  return container;
}

/**
 * Replaces an icon image with a mask-painted span so the icon takes the link colour
 * (and its hover colour). The image alt becomes the link's accessible name.
 */
function maskIcon(img) {
  const icon = document.createElement('span');
  icon.className = 'footer-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.style.setProperty('--footer-icon', `url("${img.src}")`);
  const link = img.closest('a');
  if (link && img.alt && !link.textContent.trim()) link.setAttribute('aria-label', img.alt);
  img.replaceWith(icon);
}

/**
 * Builds the newsletter form from the section's list: label, placeholder, then a link whose
 * text is the button label and whose URL is the form action.
 */
function decorateNewsletter(section) {
  const list = section.querySelector('ul');
  if (!list) return;
  const [labelItem, placeholderItem, submitItem] = [...list.children];
  const submitLink = submitItem?.querySelector('a');
  if (!submitLink) return;

  const form = document.createElement('form');
  form.className = 'footer-newsletter-form';
  form.action = submitLink.href;
  form.method = 'post';
  const inputId = 'footer-newsletter-email';
  form.innerHTML = `
    <label class="footer-visually-hidden" for="${inputId}"></label>
    <input type="email" id="${inputId}" name="email" required autocomplete="email">
    <button type="submit" class="footer-newsletter-submit"></button>`;
  form.querySelector('label').textContent = labelItem?.textContent.trim() || '';
  form.querySelector('input').placeholder = placeholderItem?.textContent.trim() || '';
  form.querySelector('button').textContent = submitLink.textContent.trim();

  const intro = document.createElement('div');
  intro.className = 'footer-newsletter-intro';
  [...section.children].filter((el) => el !== list).forEach((el) => intro.append(el));
  list.remove();
  section.append(intro, form);
}

/**
 * Smooth-scrolls to the top for in-page "#top" links; PDF links open in a new tab.
 */
function decorateLinks(footer) {
  footer.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === '#top') {
      a.classList.add('footer-go-top');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else if (/\.pdf($|[?#])/i.test(a.pathname)) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
  });
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const fragment = await fetchFooter();
  if (!fragment) return;

  block.textContent = '';
  const footer = document.createElement('div');
  footer.className = 'footer-inner';

  const sections = [...fragment.children];
  const names = ['newsletter', 'brand', 'contact', 'certs', 'bottom'];
  sections.forEach((section, i) => {
    if (names[i]) section.classList.add(`footer-${names[i]}`);
  });

  const [newsletter, brand, contact, certs, bottom] = sections;
  if (newsletter) {
    decorateNewsletter(newsletter);
    footer.append(newsletter);
  }

  // main row: brand | contact | certifications, separated by dividers
  const main = document.createElement('div');
  main.className = 'footer-main';
  [brand, contact, certs].filter(Boolean).forEach((section) => main.append(section));
  if (main.children.length) footer.append(main);
  if (bottom) footer.append(bottom);

  footer.querySelectorAll('.footer-brand li img, .footer-contact li img').forEach(maskIcon);
  decorateLinks(footer);

  block.append(footer);
}
