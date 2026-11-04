import { createOptimizedPicture } from '../../scripts/aem.js';

const VIDEO_RE = /\.(mp4|webm|ogg|mov)(\?|#|$)/i;
// frame shown while paused when no poster image is authored
const PREVIEW_TIME = 1;

function isVideoLink(a) {
  try {
    return VIDEO_RE.test(new URL(a.href, window.location.href).pathname);
  } catch (e) {
    return false;
  }
}

function buildVideo(src, hasPoster) {
  const video = document.createElement('video');
  video.className = 'columns-video-player';
  video.playsInline = true;
  // with a poster image nothing loads until play; without one, load enough to show a frame
  video.preload = hasPoster ? 'none' : 'metadata';
  const url = new URL(src, window.location.href);
  const source = document.createElement('source');
  source.src = hasPoster ? url.href : `${url.origin}${url.pathname}${url.search}#t=${PREVIEW_TIME}`;
  const ext = url.pathname.split('.').pop().toLowerCase();
  source.type = `video/${ext === 'mov' ? 'quicktime' : ext}`;
  video.append(source);
  return video;
}

function decorateMedia(cell) {
  cell.classList.add('columns-video-media');
  const link = [...cell.querySelectorAll('a')].find(isVideoLink);
  const pic = cell.querySelector('picture');
  if (!link) {
    // image only: keep it as a static media panel
    if (pic) {
      const frame = document.createElement('div');
      frame.className = 'columns-video-frame';
      frame.append(pic);
      cell.replaceChildren(frame);
    }
    return;
  }

  const frame = document.createElement('div');
  frame.className = 'columns-video-frame';
  const video = buildVideo(link.href, !!pic);
  frame.append(video);
  if (pic) {
    pic.classList.add('columns-video-poster');
    frame.append(pic);
  }

  const overlay = document.createElement('div');
  overlay.className = 'columns-video-overlay';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'columns-video-play';
  button.setAttribute('aria-label', 'Play video');
  overlay.append(button);
  frame.append(overlay);
  cell.replaceChildren(frame);

  const play = () => {
    if (frame.classList.contains('is-playing')) return;
    frame.classList.add('is-playing');
    overlay.remove();
    if (pic) pic.remove();
    video.controls = true;
    video.preload = 'auto';
    if (!pic) video.currentTime = 0;
    video.focus();
    video.play().catch(() => { /* playback blocked; native controls remain */ });
  };
  overlay.addEventListener('click', play);
}

function wrapSeparators(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue.includes('|')) nodes.push(walker.currentNode);
  }
  nodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.nodeValue.split('|').forEach((part, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'columns-video-sep';
        sep.textContent = '|';
        frag.append(sep);
      }
      if (part) frag.append(document.createTextNode(part));
    });
    node.replaceWith(frag);
  });
}

function decorateText(cell) {
  cell.classList.add('columns-video-text');
  const paras = [...cell.querySelectorAll(':scope > p')];
  const isCta = (p) => {
    const a = p.querySelector('a');
    return a && p.textContent.trim() === a.textContent.trim();
  };
  const ctas = paras.filter(isCta);
  ctas.forEach((p) => {
    p.classList.add('columns-video-cta');
    p.querySelector('a').classList.add('columns-video-button');
  });
  const textParas = paras.filter((p) => !ctas.includes(p));
  const hasHeading = cell.querySelector('h1, h2, h3, h4, h5, h6');
  // eyebrow: the first short paragraph when a statement follows it
  if (textParas.length > 1 || (textParas.length === 1 && hasHeading)) {
    textParas.shift().classList.add('columns-video-eyebrow');
  }
  textParas.forEach((p) => {
    p.classList.add('columns-video-title');
    wrapSeparators(p);
  });
  cell.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    h.classList.add('columns-video-title');
    wrapSeparators(h);
  });
}

export default function decorate(block) {
  const firstRow = block.firstElementChild;
  const cols = firstRow ? firstRow.children.length : 0;
  block.classList.add(`columns-video-${cols}-cols`);

  // optimize first so the media decoration holds the final <picture>
  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '900' }]));
  });

  [...block.children].forEach((row) => {
    row.classList.add('columns-video-row');
    [...row.children].forEach((cell) => {
      const hasVideo = [...cell.querySelectorAll('a')].some(isVideoLink);
      const imageOnly = cell.querySelector('picture') && !cell.textContent.trim();
      if (hasVideo || imageOnly) decorateMedia(cell);
      else decorateText(cell);
    });
  });
}
