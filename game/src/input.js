// Keyboard + mouse input with one-shot action bits. A held key reports
// `down()` every frame; `pressed()` fires once per physical press, so a
// toggle (radio, pause) never double-fires while the key is held.
export function makeInput() {
  return {
    keys: new Set(),
    pressedKeys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: 0,
    mouseWorldY: 0,
    mouseSeen: false,
    mouseDown: false,
    mousePressed: false,
    // A queued click that fires once even if it lands between frames.
    clickQueue: 0,
  };
}

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressedKeys.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
    input.mouseSeen = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
      input.clickQueue++;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseDown = false;
  });
}

export function inputDown(input, code) {
  return input.keys.has(code);
}

export function inputPressed(input, code) {
  return input.pressedKeys.has(code);
}

// Call once per frame after the game has read the presses.
export function endFrameInput(input) {
  input.pressedKeys.clear();
  input.mousePressed = false;
  input.clickQueue = 0;
}

// Test hook: inject a key press from the playtest driver.
export function injectKey(input, code) {
  input.pressedKeys.add(code);
  input.keys.add(code);
}

export function releaseKey(input, code) {
  input.keys.delete(code);
}
