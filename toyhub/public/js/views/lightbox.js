import { h } from '../dom.js';

// The viewer lives outside the render tree, appended straight to the body: a
// state change would redraw the whole page underneath it, which replays the
// entrance animations and reads as a flicker.
let open = null;

export function openLightbox({ images, index, label, onChange }) {
  if (open) closeLightbox();

  let i = index;
  const img = h('img', { src: images[i], alt: label, class: 'lightbox-img' });
  const counter = h('div', { class: 'lightbox-count tnum' }, `${i + 1} / ${images.length}`);

  const show = (next) => {
    i = (next + images.length) % images.length;
    img.src = images[i];
    counter.textContent = `${i + 1} / ${images.length}`;
    if (onChange) onChange(i);
  };

  const many = images.length > 1;
  const backdrop = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, [
    h('button', { class: 'lightbox-close', 'aria-label': 'Close', onclick: () => closeLightbox() }, '×'),
    many ? h('button', { class: 'lightbox-nav', style: 'left:16px', 'aria-label': 'Previous photograph', onclick: (e) => { e.stopPropagation(); show(i - 1); } }, '‹') : null,
    img,
    many ? h('button', { class: 'lightbox-nav', style: 'right:16px', 'aria-label': 'Next photograph', onclick: (e) => { e.stopPropagation(); show(i + 1); } }, '›') : null,
    many ? counter : null
  ]);

  // Anywhere that is not the picture itself closes it.
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeLightbox(); });

  const onKey = (e) => {
    if (e.key === 'Escape') closeLightbox();
    else if (many && e.key === 'ArrowLeft') show(i - 1);
    else if (many && e.key === 'ArrowRight') show(i + 1);
  };
  document.addEventListener('keydown', onKey);

  const previouslyFocused = document.activeElement;
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  backdrop.querySelector('.lightbox-close').focus();

  open = { backdrop, onKey, previouslyFocused };
}

export function closeLightbox() {
  if (!open) return;
  document.removeEventListener('keydown', open.onKey);
  open.backdrop.remove();
  document.body.style.overflow = '';
  if (open.previouslyFocused && open.previouslyFocused.focus) open.previouslyFocused.focus();
  open = null;
}
