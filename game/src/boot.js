// Entry point: create the canvas game, run the frame loop, and expose the
// playtest handle. A ?shot=N query stages one of the four screenshot scenes
// instead of starting at the title screen.
import { VIEW } from './config.js';
import { makeGame, frame, debugHandle } from './game.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : 20261124;
const game = makeGame(canvas, seed);

const shotParam = Number(params.get('shot'));
if (Number.isFinite(shotParam) && shotParam >= 1 && shotParam <= 4) {
  stageShot(game, shotParam);
  // One frozen frame is enough for a screenshot; keep rendering it so the
  // canvas paints even before any input.
  frame(game, performance.now());
} else {
  const loop = (now) => {
    frame(game, now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// Playtest driver handle (also used by the shot tooling to confirm staging).
window.__solara = debugHandle(game);
window.__solaraReady = true;
