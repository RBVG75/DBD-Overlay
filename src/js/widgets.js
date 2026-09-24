// Anchor-based placement plus drag-to-move for the overlay widgets.
// The Tauri window covers the whole screen, so dragging must move the element
// inside the page — never the window itself.

export function positionWidget(el, position, offsetX, offsetY) {
  const [vertical, horizontal] = String(position || 'top-left').split('-');
  el.style.top = 'auto';
  el.style.bottom = 'auto';
  el.style.left = 'auto';
  el.style.right = 'auto';
  let tx = '0px';
  let ty = '0px';

  if (horizontal === 'left') el.style.left = `${offsetX}px`;
  else if (horizontal === 'right') el.style.right = `${offsetX}px`;
  else {
    el.style.left = '50%';
    tx = `calc(-50% + ${offsetX}px)`;
  }

  if (vertical === 'top') el.style.top = `${offsetY}px`;
  else if (vertical === 'bottom') el.style.bottom = `${offsetY}px`;
  else {
    el.style.top = '50%';
    ty = `calc(-50% + ${offsetY}px)`;
  }

  el.style.transform = `translate(${tx}, ${ty})`;
}

const NO_DRAG = 'input, textarea, button, select, a, [role="button"], [data-no-drag]';

export function makeDraggable(el, { getState, onMove, onEnd }) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let base = null;

  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(NO_DRAG)) return;
    const state = getState();
    if (!state) return;
    dragging = true;
    base = { ...state };
    startX = event.clientX;
    startY = event.clientY;
    el.setPointerCapture(event.pointerId);
    el.classList.add('dragging');
    event.preventDefault();
  });

  el.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const [vertical, horizontal] = base.position.split('-');
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const offsetX = Math.round(base.offset_x + (horizontal === 'right' ? -dx : dx));
    const offsetY = Math.round(base.offset_y + (vertical === 'bottom' ? -dy : dy));
    onMove({ offset_x: offsetX, offset_y: offsetY });
  });

  function stop(event) {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    try {
      el.releasePointerCapture(event.pointerId);
    } catch (_) {
      /* pointer already released */
    }
    if (onEnd) onEnd();
  }

  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
}
