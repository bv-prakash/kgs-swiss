import { loadCSS, loadScript } from '../../scripts/aem.js';

// Leaflet comes from a CDN at runtime, only once the block is near the viewport
const LEAFLET_VERSION = '1.9.4';
const LEAFLET_BASE = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist`;
// the source's Stamen toner-lite tiles are no longer served. Esri's light grey canvas is the
// closest key-free match (CARTO now answers "API key required"; OSM blocks embedded use).
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

const MARKER_TYPES = {
  manufacturing: { label: 'Manufacturing Sites & Sales Offices' },
  sales: { label: 'Sales & Distribution Offices' },
  conversion: { label: 'Conversion Plants' },
};
const DEFAULT_TYPE = 'sales';
const DESKTOP = window.matchMedia('(min-width: 768px)');

let leafletPromise;
function loadLeaflet() {
  if (!leafletPromise) {
    leafletPromise = Promise.all([
      loadCSS(`${LEAFLET_BASE}/leaflet.css`),
      loadScript(`${LEAFLET_BASE}/leaflet.js`, {
        integrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
        crossorigin: '',
      }),
    ]).then(() => window.L);
  }
  return leafletPromise;
}

function el(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

function cellParts(cell) {
  if (!cell) return [];
  if (!cell.children.length && cell.textContent.trim()) return [el('p', '', ...cell.childNodes)];
  return [...cell.children];
}

function parseMarker(cell) {
  const text = cell ? cell.textContent : '';
  const coords = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  const typeMatch = text.toLowerCase().match(/manufactur|sales|conversion/);
  let type = DEFAULT_TYPE;
  if (typeMatch) type = typeMatch[0].startsWith('manufactur') ? 'manufacturing' : typeMatch[0];
  const lat = coords ? parseFloat(coords[1]) : NaN;
  const lng = coords ? parseFloat(coords[2]) : NaN;
  const valid = Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return { type, latlng: valid ? [lat, lng] : null };
}

function parseOffice(cell) {
  const office = {
    country: '', name: '', typeLabel: '', address: '', phone: null, email: null,
  };
  const rest = [];
  cellParts(cell).forEach((part) => {
    const text = part.textContent.trim();
    if (!text) return;
    const tel = part.querySelector('a[href^="tel:"]');
    const mail = part.querySelector('a[href^="mailto:"]');
    const strong = part.querySelector('strong, b');
    if (/^H[1-6]$/.test(part.tagName) && !office.country) office.country = text;
    else if (tel && !office.phone) office.phone = { href: tel.getAttribute('href'), text: tel.textContent.trim() };
    else if (mail && !office.email) office.email = { href: mail.getAttribute('href'), text: mail.textContent.trim() };
    else if (strong && strong.textContent.trim() === text && !office.name) office.name = text;
    else rest.push(text);
  });
  // remaining paragraphs: office type, then address (a single one is the address)
  if (rest.length === 1) [office.address] = rest;
  else if (rest.length > 1) [office.typeLabel, office.address] = rest;
  return office;
}

function parseRows(block) {
  const entries = [];
  const primary = [];
  const secondary = [];
  [...block.children].forEach((row) => {
    const [regionCell, officeCell, markerCell] = [...row.children];
    if (!regionCell || !officeCell) return;
    const office = { ...parseOffice(officeCell), ...parseMarker(markerCell) };
    if (!office.name && !office.address) return;
    // one office may sit under several regions ("Europe, Global")
    const names = regionCell.textContent.split(/[,\n]/).map((r) => r.trim()).filter(Boolean);
    names.forEach((name, i) => {
      const list = i === 0 ? primary : secondary;
      if (!list.includes(name)) list.push(name);
    });
    entries.push({ names, office });
  });
  // tab order: regions as first named in each row, then regions only ever named second
  const order = [...primary, ...secondary.filter((name) => !primary.includes(name))];
  const regions = new Map(order.map((name) => [name, []]));
  entries.forEach(({ names, office }) => names.forEach((name) => regions.get(name).push(office)));
  return regions;
}

function icon(name) {
  return el('span', `tabs-locations-icon tabs-locations-icon-${name}`);
}

function swatch(type) {
  const s = el('span', `tabs-locations-swatch tabs-locations-swatch-${type}`);
  s.setAttribute('aria-hidden', 'true');
  return s;
}

function officeDetails(office, cls) {
  const details = el('div', cls);
  if (office.typeLabel) {
    const row = el('p', 'tabs-locations-type', swatch(office.type), office.typeLabel);
    details.append(row);
  }
  if (office.address) details.append(el('p', 'tabs-locations-address', icon('pin'), el('span', '', office.address)));
  if (office.phone) {
    const a = el('a', '', office.phone.text);
    a.href = office.phone.href;
    details.append(el('p', 'tabs-locations-phone', icon('phone'), a));
  }
  if (office.email) {
    const a = el('a', '', office.email.text);
    a.href = office.email.href;
    details.append(el('p', 'tabs-locations-email', icon('mail'), a));
  }
  return details;
}

function popupContent(office) {
  const wrap = el('div', 'tabs-locations-popup');
  if (office.name) wrap.append(el('p', 'tabs-locations-popup-title', office.name));
  wrap.append(...officeDetails(office, 'tabs-locations-popup-body').childNodes);
  return wrap;
}

// the pin colour comes from CSS: the source draws every office pin in brand navy,
// the type only shows in the legend and the popup swatch
function markerIcon(L, type) {
  return L.divIcon({
    className: `tabs-locations-marker tabs-locations-marker-${type}`,
    html: '<svg viewBox="0 0 24 30" width="24" height="30" aria-hidden="true"><path d="M12 29s10-9.6 10-17A10 10 0 0 0 2 12c0 7.4 10 17 10 17Z" fill="currentColor" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4.3" fill="#fff"/></svg>',
    iconSize: [24, 30],
    iconAnchor: [12, 29],
    popupAnchor: [0, -26],
  });
}

function buildLegend() {
  const legend = el('ul', 'tabs-locations-legend');
  Object.entries(MARKER_TYPES).forEach(([type, { label }]) => {
    legend.append(el('li', '', swatch(type), label));
  });
  return legend;
}

function buildScroller(cards) {
  const scroller = el('div', 'tabs-locations-scroller');
  const track = el('div', 'tabs-locations-cards', ...cards);
  const prev = el('button', 'tabs-locations-arrow tabs-locations-prev');
  const next = el('button', 'tabs-locations-arrow tabs-locations-next');
  prev.type = 'button';
  next.type = 'button';
  prev.setAttribute('aria-label', 'Previous offices');
  next.setAttribute('aria-label', 'Next offices');
  const update = () => {
    const max = track.scrollWidth - track.clientWidth - 1;
    scroller.classList.toggle('at-start', track.scrollLeft <= 1);
    scroller.classList.toggle('at-end', track.scrollLeft >= max);
  };
  const step = (dir) => {
    const card = track.querySelector('.tabs-locations-store');
    const by = card ? card.offsetWidth + 26 : track.clientWidth * 0.8;
    track.scrollBy({ left: dir * by, behavior: 'smooth' });
  };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  track.addEventListener('scroll', update, { passive: true });
  // re-check once the panel is shown or resized (it measures 0 while hidden)
  new ResizeObserver(update).observe(track);
  scroller.append(track, prev, next);
  scroller.updateArrows = update;
  return scroller;
}

export default function decorate(block) {
  const regions = parseRows(block);
  if (!regions.size) {
    block.replaceChildren();
    return;
  }
  const uid = `tabs-locations-${Math.random().toString(36).slice(2, 8)}`;
  const nav = el('div', 'tabs-locations-tabs');
  const panelsWrap = el('div', 'tabs-locations-panels');
  const mapWrap = el('div', 'tabs-locations-map');
  mapWrap.setAttribute('role', 'region');
  mapWrap.setAttribute('aria-label', 'Map of offices');
  const state = {
    active: 0, open: true, map: null, L: null, layer: null, markers: [], stores: [],
  };
  const items = [];

  [...regions.entries()].forEach(([region, offices], idx) => {
    const tab = el('button', 'tabs-locations-tab', el('span', '', region));
    tab.type = 'button';
    tab.id = `${uid}-tab-${idx}`;
    const panel = el('div', 'tabs-locations-panel');
    panel.id = `${uid}-panel-${idx}`;

    // offices of the same country share one label (e.g. China: 3 offices)
    const cards = [];
    offices.forEach((office, i) => {
      const store = el('div', 'tabs-locations-store');
      const toggle = el('button', 'tabs-locations-store-name', office.name || office.address);
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      const details = officeDetails(office, 'tabs-locations-store-details');
      store.append(toggle, details);
      store.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        // eslint-disable-next-line no-use-before-define
        activateStore(idx, i);
      });
      const prevOffice = offices[i - 1];
      if (prevOffice && prevOffice.country && prevOffice.country === office.country) {
        cards[cards.length - 1].querySelector('.tabs-locations-group').append(store);
      } else {
        const label = el('p', 'tabs-locations-country', office.country || ' ');
        cards.push(el('div', 'tabs-locations-card', label, el('div', 'tabs-locations-group', store)));
      }
    });
    const scroller = buildScroller(cards);
    panel.append(scroller);
    items.push({
      region, offices, tab, panel, scroller,
    });
  });

  function storesOf(idx) {
    return [...items[idx].panel.querySelectorAll('.tabs-locations-store')];
  }

  function showMarkers(idx) {
    const { L, map } = state;
    if (!map) return;
    if (state.layer) state.layer.remove();
    state.layer = L.layerGroup().addTo(map);
    state.markers = items[idx].offices.map((office, i) => {
      if (!office.latlng) return null;
      const marker = L.marker(office.latlng, { icon: markerIcon(L, office.type), title: office.name, keyboard: true });
      marker.bindPopup(popupContent(office), { closeButton: true, autoPanPadding: [20, 20], maxWidth: 400 });
      // eslint-disable-next-line no-use-before-define
      marker.on('click', () => activateStore(idx, i, false));
      marker.addTo(state.layer);
      return marker;
    });
    const points = state.markers.filter(Boolean).map((m) => m.getLatLng());
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 2 });
  }

  function activateStore(idx, i, openPopup = true) {
    storesOf(idx).forEach((store, j) => {
      const on = j === i;
      store.classList.toggle('is-active', on);
      store.querySelector('.tabs-locations-store-name').setAttribute('aria-expanded', String(on));
    });
    const marker = state.markers[i];
    if (!marker) return;
    state.markers.forEach((m) => m && m.getElement() && m.getElement().classList.remove('is-active'));
    if (marker.getElement()) marker.getElement().classList.add('is-active');
    if (openPopup && DESKTOP.matches) marker.openPopup();
  }

  function select(idx, focus = false) {
    const desktop = DESKTOP.matches;
    // on phones a second tap on the open region closes it
    state.open = desktop || state.active !== idx || !state.open;
    state.active = idx;
    items.forEach(({ tab, panel }, i) => {
      const on = i === idx && state.open;
      panel.hidden = !on;
      if (desktop) {
        tab.setAttribute('aria-selected', String(i === idx));
        tab.tabIndex = i === idx ? 0 : -1;
      } else {
        tab.setAttribute('aria-expanded', String(on));
      }
    });
    if (focus) items[idx].tab.focus();
    items[idx].scroller.updateArrows();
    showMarkers(idx);
  }

  function layout() {
    const desktop = DESKTOP.matches;
    block.classList.toggle('is-desktop', desktop);
    if (desktop) {
      nav.setAttribute('role', 'tablist');
      nav.replaceChildren(...items.map(({ tab }) => tab));
      panelsWrap.replaceChildren(...items.map(({ panel }) => panel));
      items.forEach(({ tab, panel }) => {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panel.id);
        tab.removeAttribute('aria-expanded');
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
      });
    } else {
      // phones: an accordion, each region's offices directly under its header
      nav.removeAttribute('role');
      nav.replaceChildren(...items.flatMap(({ tab, panel }) => [tab, panel]));
      panelsWrap.replaceChildren();
      items.forEach(({ tab, panel }) => {
        tab.removeAttribute('role');
        tab.removeAttribute('aria-selected');
        tab.tabIndex = 0;
        tab.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-labelledby', tab.id);
      });
    }
    state.open = true;
    const current = state.active;
    state.active = -1;
    select(current);
  }

  items.forEach(({ tab }, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (e) => {
      if (!DESKTOP.matches) return;
      const last = items.length - 1;
      let next = null;
      if (e.key === 'ArrowRight') next = i === last ? 0 : i + 1;
      else if (e.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = last;
      if (next === null) return;
      e.preventDefault();
      select(next, true);
    });
  });

  block.replaceChildren(nav, panelsWrap, mapWrap, buildLegend());
  DESKTOP.addEventListener('change', () => {
    layout();
    if (state.map) state.map.invalidateSize();
  });
  layout();

  const initMap = async () => {
    try {
      const L = await loadLeaflet();
      // the source map is fixed: no zoom controls, wheel, pinch or double-click zoom
      const map = L.map(mapWrap, {
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoom: false,
        keyboard: false,
        minZoom: 1,
        maxZoom: 2,
        worldCopyJump: false,
      }).setView([20, 0], 1);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxNativeZoom: 16 }).addTo(map);
      state.L = L;
      state.map = map;
      showMarkers(state.active);
    } catch (e) {
      mapWrap.classList.add('is-unavailable');
      // eslint-disable-next-line no-console
      console.warn('tabs-locations: map could not be loaded', e);
    }
  };

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      initMap();
    }
  }, { rootMargin: '300px 0px' });
  observer.observe(mapWrap);
}
