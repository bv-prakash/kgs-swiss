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
 * Mounts the newsletter drop-in (normal email form) in the newsletter section.
 * Every label comes from the newsletter placeholder sheet, so authored copy in the
 * section is replaced.
 */
async function decorateNewsletter(section) {
  section.textContent = '';
  const mount = document.createElement('div');
  mount.className = 'footer-newsletter-mount';
  section.append(mount);
  try {
    await import('../../scripts/initializers/newsletter.js');
    const [{ render }, { default: NewsletterContainer }] = await Promise.all([
      import('@prakash.gurung/commerce-newsletter/render.js'),
      import('@prakash.gurung/commerce-newsletter/containers/NewsletterContainer.js'),
    ]);
    await render.render(NewsletterContainer, {})(mount);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Newsletter drop-in failed to load', error);
  }
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
  if (newsletter) footer.append(newsletter);

  // main row: brand | contact | certifications, separated by dividers
  const main = document.createElement('div');
  main.className = 'footer-main';
  [brand, contact, certs].filter(Boolean).forEach((section) => main.append(section));
  if (main.children.length) footer.append(main);
  if (bottom) footer.append(bottom);

  footer.querySelectorAll('.footer-brand li img, .footer-contact li img').forEach(maskIcon);
  decorateLinks(footer);

  block.append(footer);

  // the drop-in loads after the rest of the footer is shown
  if (newsletter) decorateNewsletter(newsletter);
}
