// desktop navigation (hover panels) from 1024px, matching the source site
const isDesktop = window.matchMedia('(width >= 1024px)');

/**
 * Fetches the nav fragment. Metadata-independent: /content first (local preview),
 * then the site root (Document Authoring / EDS preview and live).
 * @returns {Promise<Element|null>} container holding the nav sections
 */
async function fetchNav() {
  let resp = await fetch('/content/nav.plain.html');
  if (!resp.ok) resp = await fetch('/nav.plain.html');
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

function closePanels(nav, except) {
  nav.querySelectorAll('.nav-drop[aria-expanded="true"]').forEach((drop) => {
    if (drop !== except) {
      drop.setAttribute('aria-expanded', 'false');
      drop.querySelector('.nav-panel')?.classList.remove('nav-panel-align-right');
    }
  });
}

/**
 * Places a dropdown under its trigger and keeps it inside the nav content box:
 * a dropdown that would run past the right edge is aligned to that edge instead.
 * Mega panels span the content box and need no placement.
 */
function containPanel(drop) {
  const panel = drop.querySelector('.nav-panel');
  if (!panel || panel.classList.contains('nav-panel-mega')) return;
  const nav = drop.closest('nav');
  const navBox = nav.getBoundingClientRect();
  const triggerBox = (drop.querySelector('.nav-link') || drop).getBoundingClientRect();
  const left = triggerBox.left - navBox.left;
  const fits = left + panel.offsetWidth <= navBox.width;
  panel.classList.toggle('nav-panel-align-right', !fits);
  panel.style.left = fits ? `${left}px` : '';
}

// short grace period so a diagonal pointer path into a panel does not close it
const CLOSE_DELAY = 200;
let closeTimer;

function openPanel(nav, drop) {
  clearTimeout(closeTimer);
  closePanels(nav, drop);
  drop.setAttribute('aria-expanded', 'true');
  containPanel(drop);
}

function scheduleClose(nav) {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => closePanels(nav), CLOSE_DELAY);
}

/**
 * Turns each top-level list item into a nav item; items with a nested list
 * become hover panels (a panel with images becomes a mega panel).
 */
function decorateSections(nav, section) {
  const list = section.querySelector(':scope > ul');
  if (!list) return;
  list.classList.add('nav-list');
  [...list.children].forEach((item) => {
    item.classList.add('nav-item');
    const trigger = item.querySelector(':scope > p > a, :scope > a');
    if (trigger) {
      trigger.classList.add('nav-link', 'nav-trigger');
      const p = trigger.closest('p');
      if (p && p.parentElement === item) p.replaceWith(trigger);
    }
    const sublist = item.querySelector(':scope > ul');
    if (!sublist) return;

    const panel = document.createElement('div');
    panel.className = 'nav-panel';

    // mobile sub-panel header: back arrow + the parent label as title (hidden on desktop)
    const panelHeader = document.createElement('div');
    panelHeader.className = 'nav-panel-header';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'nav-panel-back';
    back.setAttribute('aria-label', 'Back');
    const title = document.createElement('h2');
    title.className = 'nav-panel-title';
    title.textContent = trigger ? trigger.textContent.trim() : '';
    panelHeader.append(back, title);
    back.addEventListener('click', () => {
      item.setAttribute('aria-expanded', 'false');
      trigger?.focus();
    });
    panel.append(panelHeader);

    sublist.classList.add('nav-panel-links');
    panel.append(sublist);
    const media = [...item.querySelectorAll(':scope > p')].filter((p) => p.querySelector('img'));
    media.forEach((p) => {
      p.classList.add('nav-panel-media');
      panel.append(p);
    });
    if (media.length) panel.classList.add('nav-panel-mega');
    item.append(panel);

    item.classList.add('nav-drop', media.length ? 'nav-drop-mega' : 'nav-drop-list');
    item.setAttribute('aria-expanded', 'false');
    if (trigger) trigger.setAttribute('aria-haspopup', 'true');

    item.addEventListener('mouseenter', () => {
      if (isDesktop.matches) openPanel(nav, item);
    });
    item.addEventListener('mouseleave', () => {
      if (isDesktop.matches) scheduleClose(nav);
    });
    item.addEventListener('focusin', () => {
      if (isDesktop.matches) openPanel(nav, item);
    });
    item.addEventListener('focusout', (e) => {
      if (isDesktop.matches && !item.contains(e.relatedTarget)) closePanels(nav);
    });
    // mobile: tapping a parent row opens its sub-panel instead of navigating
    trigger?.addEventListener('click', (e) => {
      if (isDesktop.matches) return;
      e.preventDefault();
      closePanels(nav, item);
      item.setAttribute('aria-expanded', 'true');
      back.focus();
    });
  });
}

/**
 * Mobile drawer header: close button plus the drawer logo (the second brand image,
 * if the nav provides one). Hidden on desktop.
 */
function decorateDrawer(nav, sections, onClose) {
  const header = document.createElement('div');
  header.className = 'nav-drawer-header';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'nav-drawer-close';
  close.setAttribute('aria-label', 'Close navigation');
  close.addEventListener('click', onClose);
  header.append(close);
  const brandParagraphs = nav.querySelectorAll('.nav-brand > p');
  if (brandParagraphs.length > 1) {
    const drawerLogo = brandParagraphs[brandParagraphs.length - 1];
    drawerLogo.classList.add('nav-drawer-logo');
    header.append(drawerLogo);
  }
  sections.prepend(header);
}

/**
 * Builds the expandable search from the tools section: the image is the toggle
 * icon, the link text is the placeholder and the link URL is the form action.
 */
function decorateSearch(navWrapper, tools) {
  const icon = tools.querySelector('img');
  const link = tools.querySelector('a');
  if (!link) return;
  const placeholder = link.textContent.trim();
  const action = link.href;
  const iconSrc = icon ? icon.src : '';
  const label = icon?.alt || 'Search';
  tools.textContent = '';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-search-toggle';
  toggle.setAttribute('aria-label', label);
  toggle.setAttribute('aria-expanded', 'false');
  if (iconSrc) toggle.innerHTML = `<img src="${iconSrc}" alt="" width="20" height="20">`;

  const form = document.createElement('form');
  form.className = 'nav-search-form';
  form.action = action;
  form.method = 'get';
  form.setAttribute('role', 'search');
  form.innerHTML = `
    <input type="text" name="q" autocomplete="off" aria-label="${label}">
    <button type="submit" class="nav-search-submit" aria-label="${label}">${iconSrc ? `<img src="${iconSrc}" alt="" width="20" height="20">` : ''}</button>
    <span class="nav-search-divider" aria-hidden="true"></span>
    <button type="button" class="nav-search-close" aria-label="Close search"></button>`;
  const input = form.querySelector('input');
  input.placeholder = placeholder;

  const setOpen = (open) => {
    navWrapper.classList.toggle('search-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) input.focus();
  };
  toggle.addEventListener('click', () => setOpen(true));
  form.querySelector('.nav-search-close').addEventListener('click', () => {
    setOpen(false);
    toggle.focus();
  });
  form.addEventListener('submit', (e) => {
    if (!input.value.trim()) e.preventDefault();
  });
  document.addEventListener('click', (e) => {
    if (navWrapper.classList.contains('search-open') && !tools.contains(e.target)) setOpen(false);
  });
  tools.append(toggle, form);
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await fetchNav();
  if (!fragment) return;

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main');
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  ['brand', 'sections', 'tools'].forEach((name, i) => {
    nav.children[i]?.classList.add(`nav-${name}`);
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);

  const sections = nav.querySelector('.nav-sections');
  if (sections) decorateSections(nav, sections);
  const tools = nav.querySelector('.nav-tools');
  if (tools) decorateSearch(navWrapper, tools);

  // hamburger (visible below the desktop breakpoint)
  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  const hamburgerButton = hamburger.querySelector('button');
  const setMenuOpen = (open) => {
    nav.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburgerButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.body.style.overflowY = open && !isDesktop.matches ? 'hidden' : '';
  };
  hamburgerButton.addEventListener('click', () => setMenuOpen(nav.getAttribute('aria-expanded') !== 'true'));
  nav.prepend(hamburger);
  setMenuOpen(false);

  if (sections) {
    decorateDrawer(nav, sections, () => {
      closePanels(nav);
      setMenuOpen(false);
      hamburgerButton.focus();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    closePanels(nav);
    navWrapper.classList.remove('search-open');
    if (!isDesktop.matches) setMenuOpen(false);
  });

  // reset state when crossing the desktop breakpoint
  isDesktop.addEventListener('change', () => {
    closePanels(nav);
    navWrapper.classList.remove('search-open');
    setMenuOpen(false);
  });

  block.append(navWrapper);
}
