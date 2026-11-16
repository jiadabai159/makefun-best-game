// Keyboard and mouse, read as a state the world steps from. Actions are edge
// triggered: takeActions returns the ones pressed since the last read, then
// clears them, so a keypress never fires twice.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: FIELD.width / 2, y: FIELD.height / 2, down: false };
  let actions = 0;
  let click = null; // the last mousedown position, until takeClick() reads it

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD.width,
      y: ((clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  function onKeyDown(event) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const p = toLogical(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  }

  function onMouseDown(event) {
    const p = toLogical(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    click = { x: p.x, y: p.y };
    actions |= ACTION_CONFIRM;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** Normalised WASD / arrow movement vector for this frame. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    /** Where the mouse points, in playfield coordinates. */
    aim() { return { x: mouse.x, y: mouse.y }; },
    /** True while the fire button (mouse) or Space is held. */
    firing() { return mouse.down || keys.has('Space'); },
    /** Which number key (1, 2 or 3) is held, for level-up choices; 0 when none. */
    numberChoice() {
      if (keys.has('Digit1') || keys.has('Numpad1')) return 1;
      if (keys.has('Digit2') || keys.has('Numpad2')) return 2;
      if (keys.has('Digit3') || keys.has('Numpad3')) return 3;
      return 0;
    },
    mousePos() { return { x: mouse.x, y: mouse.y }; },
    /** The last click's position, once; null when no click is waiting. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
