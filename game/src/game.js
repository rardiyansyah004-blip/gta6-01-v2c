// Game state and the update loop: screens, wanted heat, police response,
// combat, stealing cars, the garage, saves and the dispatch feed. This file
// owns the rules; actors.js moves things, render.js draws them.
import { WORLD, PLAYER, WANTED, MONEY } from './config.js';
import { makeRng, clamp, dist2 } from './rng.js';
import { buildCity, nearestRoadPoint, randomRoadPoint, districtAt } from './city.js';
import {
  makePlayer, makePed, makeHostilePed, makeTrafficCar, makeCop, makeHeli,
  updatePlayerOnFoot, updatePlayerDriving, updatePed, updateTrafficCar,
  updateCop, updateHeli, starsFromHeat,
} from './actors.js';
import { MISSION_CHAIN, makeMissionState, placeMissionTarget, missionObjectiveText, respectRank } from './missions.js';
import { makeAudio, ensureAudio, tickAudio, setStation, stationName, toggleMusic, sfxShot, sfxPunch, sfxPickup, sfxBusted, updateEngineSound } from './audio.js';
import { makeInput, attachInput, inputDown, inputPressed, endFrameInput } from './input.js';
import { makeCamera, render } from './render.js';

const SAVE_KEY = (slot) => `solara-bay.save.v2c.slot${slot}`;

export function makeGame(canvas, seed = 20261124) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const start = nearestRoadPoint(city, 600, 600);
  const game = {
    canvas, ctx: canvas.getContext('2d'),
    seed, rng, city,
    screen: 'title', // title | playing | paused | busted
    time: 0,
    player: makePlayer(start.x, start.y),
    peds: [],
    traffic: [],
    cops: [],
    heli: null,
    roadblocks: [],
    particles: [],
    mission: makeMissionState(city, rng),
    heat: 0,
    stars: 0,
    feed: [
      'SBPD dispatch online — all units, stay sharp.',
      'Crown District quiet tonight. Keep it that way.',
    ],
    input: makeInput(),
    audio: makeAudio(),
    camera: makeCamera(),
    shotMode: null,
    kills: 0,
    carsStolen: 0,
    jobsDone: 0,
    freezeWorld: false,
  };
  for (let i = 0; i < 26; i++) game.peds.push(makePed(city, rng));
  for (let i = 0; i < 14; i++) game.traffic.push(makeTrafficCar(city, rng));
  attachInput(game.input, canvas);
  // Methods the renderer calls (kept on the object to avoid a render<->game
  // circular import).
  game.currentMissionDef = () => currentMissionDef(game);
  game.missionObjective = () => missionObjective(game);
  game.radioName = () => radioName(game);
  game.readSave = (slot) => readSave(game, slot);
  return game;
}

// --- helpers ---------------------------------------------------------------

export function currentMissionDef(game) {
  return MISSION_CHAIN[Math.min(game.mission.index, MISSION_CHAIN.length - 1)];
}

export function missionObjective(game) {
  const def = currentMissionDef(game);
  if (game.mission.phase === 'briefing') return `${def.brief} — press ENTER to start the job`;
  if (game.mission.phase === 'complete') return 'All nine jobs done. Solara Bay is yours, Mara.';
  return missionObjectiveText(def, game.mission);
}

export function radioName(game) {
  return stationName(game.audio);
}

function addFeed(game, line) {
  game.feed.push(line);
  if (game.feed.length > 40) game.feed.shift();
}

function addHeat(game, amount, reason) {
  game.heat = clamp(game.heat + amount, 0, 100);
  const stars = starsFromHeat(game.heat);
  if (stars > game.stars) {
    addFeed(game, `SBPD: wanted level ${stars} star${stars > 1 ? 's' : ''} — ${reason}`);
  }
  game.stars = stars;
}

function spawnParticles(game, x, y, color, count, speed = 120) {
  for (let i = 0; i < count; i++) {
    const a = game.rng.range(0, Math.PI * 2);
    const s = game.rng.range(speed * 0.3, speed);
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      size: game.rng.range(2, 5), color,
      life: game.rng.range(0.3, 0.8), maxLife: 0.8,
    });
  }
}

function nearestCar(game, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of game.traffic) {
    const d = dist2(game.player.x, game.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// --- saves -----------------------------------------------------------------

export function readSave(game, slot) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY(slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSave(game, slot) {
  try {
    const p = game.player;
    window.localStorage.setItem(SAVE_KEY(slot), JSON.stringify({
      job: game.mission.index + 1,
      money: Math.floor(p.money),
      respect: p.respect,
      jobsDone: game.jobsDone,
      carsStolen: game.carsStolen,
      savedAt: new Date().toISOString(),
    }));
    return true;
  } catch {
    return false;
  }
}

function applySave(game, slot) {
  const save = readSave(game, slot);
  if (!save) return false;
  game.player.money = save.money;
  game.player.respect = save.respect;
  game.jobsDone = save.jobsDone;
  game.carsStolen = save.carsStolen;
  game.mission.index = clamp(save.job - 1, 0, MISSION_CHAIN.length - 1);
  game.mission.phase = 'briefing';
  addFeed(game, `Save slot ${slot + 1} loaded — job ${save.job}/9, $${save.money}.`);
  return true;
}

// --- missions --------------------------------------------------------------

function startMission(game) {
  const def = placeMissionTarget(game.mission, game.city, game.rng, game.player);
  game.mission.phase = 'active';
  game.mission.startedAt = game.time;
  addFeed(game, `New job: ${def.title} — ${def.brief}`);
  if (def.type === 'escort') {
    const spot = nearestRoadPoint(game.city, game.player.x + 200, game.player.y);
    game.mission.van = {
      id: 9991, kind: 'car', model: 'Crew Van', color: '#c9c9d4',
      top: 420, len: 56, wid: 24, x: spot.x, y: spot.y,
      angle: 0, speed: 0, cruise: 200, vertical: false, driver: true, stolen: false, hp: 100,
    };
  }
  if (def.type === 'eliminate') {
    // The rival crew is waiting at the docks.
    for (let i = 0; i < def.targets; i++) {
      game.peds.push(makeHostilePed(
        game.city, game.rng,
        game.player.x + 260 + i * 70,
        game.player.y + (i % 2 === 0 ? -120 : 120),
      ));
    }
    addFeed(game, `Rival crew spotted — ${def.targets} of them. Take them all out.`);
  }
  if (def.type === 'finale') addHeat(game, 100, 'the Crown job');
  if (def.type === 'getaway') addHeat(game, 45, 'the job went loud');
}

function completeMission(game) {
  const def = currentMissionDef(game);
  game.player.money += def.pay;
  game.player.respect += 60 + game.mission.index * 15;
  game.jobsDone++;
  sfxPickup(game.audio);
  addFeed(game, `Job done: ${def.title} — +$${def.pay}, +${60 + game.mission.index * 15} respect.`);
  game.mission.index++;
  if (game.mission.index >= MISSION_CHAIN.length) {
    game.mission.phase = 'complete';
    addFeed(game, 'Crown of Solara complete. Mara owns this city.');
    return;
  }
  game.mission.phase = 'briefing';
  game.mission.target = null;
  game.mission.van = null;
  // Clear the heat after a clean job — the city breathes again.
  game.heat = Math.max(0, game.heat - 40);
  game.stars = starsFromHeat(game.heat);
}

function failMission(game, reason) {
  addFeed(game, `Job failed: ${reason}. The job is still open — try again.`);
  game.mission.phase = 'briefing';
  game.mission.target = null;
  game.mission.van = null;
  game.heat = Math.max(0, game.heat - 20);
  game.stars = starsFromHeat(game.heat);
}

function updateMission(game, dt) {
  const m = game.mission;
  if (m.phase !== 'active') return;
  const def = currentMissionDef(game);
  const p = game.player;
  if (def.timeLimit) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(game, 'out of time');
      return;
    }
  }
  const t = m.target;
  const nearTarget = t && dist2(p.x, p.y, t.x, t.y) < 70 * 70;
  switch (def.type) {
    case 'steal-and-deliver':
      if (m.progress === 0 && p.inCar) {
        m.progress = 1;
        addFeed(game, 'Wheels acquired. Now bring it to the garage marker.');
      } else if (m.progress === 1 && nearTarget) completeMission(game);
      break;
    case 'timed-goto':
      if (nearTarget) completeMission(game);
      break;
    case 'lose-heat':
      if (game.heat <= 0 && nearTarget) completeMission(game);
      break;
    case 'eliminate': {
      if (m.eliminated >= def.targets) completeMission(game);
      break;
    }
    case 'grab-and-escape':
      if (m.progress === 0 && nearTarget) {
        m.progress = 1;
        p.money += 250;
        addFeed(game, 'Cash grabbed — $250 in hand. Now get out of Crown District.');
      } else if (m.progress === 1 && p.x > 1600) completeMission(game);
      break;
    case 'race': {
      const cp = m.checkpoints[m.checkpoint];
      if (cp && dist2(p.x, p.y, cp.x, cp.y) < 80 * 80) {
        cp.done = true;
        m.checkpoint++;
        addFeed(game, `Checkpoint ${m.checkpoint}/${def.checkpoints} — keep pushing.`);
        if (m.checkpoint >= def.checkpoints) completeMission(game);
        else m.target = m.checkpoints[m.checkpoint];
      }
      break;
    }
    case 'defend': {
      const alive = game.peds.filter((x) => x.hostile && !x.dead).length;
      if (alive === 0) {
        if (m.wave >= def.waves) {
          completeMission(game);
        } else {
          m.wave++;
          const count = 2 + m.wave;
          for (let i = 0; i < count; i++) {
            game.peds.push(makeHostilePed(
              game.city, game.rng,
              game.player.x + 380 + i * 60,
              game.player.y + (i % 2 === 0 ? -160 : 160),
            ));
          }
          addFeed(game, `Wave ${m.wave}/${def.waves} incoming — ${count} hostiles on the docks!`);
        }
      }
      break;
    }
    case 'escort': {
      const van = m.van;
      if (!van || van.hp <= 0) { failMission(game, 'the crew van was destroyed'); return; }
      if (nearTarget) completeMission(game);
      break;
    }
    case 'finale':
      if (nearTarget) completeMission(game);
      break;
    default:
      break;
  }
}

// --- combat ----------------------------------------------------------------

function tryShoot(game) {
  const p = game.player;
  if (p.inCar || p.ammo <= 0 || p.fireTimer > 0) return;
  p.ammo--;
  p.fireTimer = 0.28;
  sfxShot(game.audio);
  const aimAngle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  const mx = p.x + Math.cos(aimAngle) * 26;
  const my = p.y + Math.sin(aimAngle) * 26;
  spawnParticles(game, mx, my, '#ffd23c', 6, 200);
  addHeat(game, 4, 'shots fired');
  // Hit the nearest ped / cop within a cone in front of the player.
  let best = null;
  let bestD = 320 * 320;
  const candidates = [...game.peds.filter((x) => !x.dead), ...game.cops];
  for (const c of candidates) {
    const d = dist2(p.x, p.y, c.x, c.y);
    if (d > bestD) continue;
    const ang = Math.atan2(c.y - p.y, c.x - p.x);
    let diff = Math.abs(ang - aimAngle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 0.45) { bestD = d; best = c; }
  }
  if (best) {
    spawnParticles(game, best.x, best.y, '#ff2e4d', 10, 160);
    if (best.kind === 'ped') {
      best.dead = true;
      game.kills++;
      addHeat(game, WANTED.shoot, 'a pedestrian was shot');
      addFeed(game, 'SBPD: shots fired, pedestrian down. Units responding.');
      countElimination(game, best);
    } else {
      // Cops take two hits.
      best.hp = (best.hp ?? 2) - 1;
      addHeat(game, WANTED.killCop / 2, 'an officer was hit');
      if (best.hp <= 0) {
        game.cops = game.cops.filter((c) => c !== best);
        game.kills++;
        addFeed(game, 'SBPD: officer down! All units converge!');
      }
    }
  }
}

// Only hostile crew count toward the Dockside Takedown.
function countElimination(game, ped) {
  const m = game.mission;
  if (currentMissionDef(game).type === 'eliminate' && m.phase === 'active' && ped.hostile) {
    m.eliminated++;
  }
}

function tryPunch(game) {
  const p = game.player;
  if (p.inCar || p.punchTimer > 0) return;
  p.punchTimer = 0.4;
  sfxPunch(game.audio);
  const aimAngle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  for (const ped of game.peds) {
    if (ped.dead) continue;
    const d = dist2(p.x, p.y, ped.x, ped.y);
    if (d < 46 * 46) {
      ped.dead = true;
      ped.panic = 0;
      game.kills++;
      addHeat(game, WANTED.punch, 'an assault on the street');
      spawnParticles(game, ped.x, ped.y, '#ff2e4d', 8, 140);
      countElimination(game, ped);
      break;
    }
  }
}

function tryEnterExitCar(game) {
  const p = game.player;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    car.speed = 0;
    return 'exit';
  }
  const car = nearestCar(game, 64);
  if (car) {
    p.inCar = car;
    game.traffic = game.traffic.filter((c) => c !== car);
    if (car.driver) {
      // Stealing a car with a driver in it is a crime the city notices.
      addHeat(game, WANTED.stealCar, 'a car was stolen in broad daylight');
      game.carsStolen++;
      spawnParticles(game, car.x, car.y, '#ffffff', 6, 100);
      addFeed(game, `You took a ${car.model}. The owner called it in.`);
    }
    return 'enter';
  }
  return null;
}

// --- police response ---------------------------------------------------------

function updatePolice(game, dt) {
  // Wanted decay: slow in the open, fast when hidden (no cop within 300px).
  const nearestCop = game.cops.reduce((best, cop) => {
    const d = Math.hypot(cop.x - game.player.x, cop.y - game.player.y);
    return Math.min(best, d);
  }, Infinity);
  const hidden = nearestCop > 300 && !game.player.inCar;
  if (game.heat > 0) {
    game.heat = Math.max(0, game.heat - (hidden ? WANTED.decayHidden : WANTED.decayPerSecond) * dt);
    game.stars = starsFromHeat(game.heat);
  }
  // Spawn cops up to the wanted level's demand.
  const want = Math.min(WANTED.maxCops, game.stars);
  while (game.cops.length < want) {
    game.cops.push(makeCop(game.city, game.rng, game.player.x, game.player.y));
  }
  while (game.cops.length > want) game.cops.pop();
  // Roadblocks at 3+ stars, ahead of the player on the nearest avenue.
  game.roadblocks = [];
  if (game.stars >= WANTED.roadblockAtStars) {
    const spot = nearestRoadPoint(game.city, game.player.x + 420, game.player.y);
    game.roadblocks.push({ x: spot.x, y: spot.y, angle: spot.vertical ? 0 : Math.PI / 2 });
  }
  // Air One at 4+ stars.
  if (game.stars >= WANTED.heliAtStars && !game.heli) {
    game.heli = makeHeli(game.player.x, game.player.y);
    addFeed(game, 'SBPD Air One is overhead — the searchlight is on you.');
  }
  if (game.stars < WANTED.heliAtStars && game.heli) game.heli = null;
  // Move cops; a cop that touches the player on foot busts them.
  for (const cop of game.cops) {
    const d = updateCop(cop, game.player, dt, game.rng);
    if (!game.player.inCar && d < 34 && game.player.health > 0) {
      game.player.health -= 34 * dt;
      if (game.player.health <= 0) bustPlayer(game);
    }
    // Ramming damage while driving — but with a cooldown and a shove, so a
    // cop cannot pin the car at zero speed by staying in contact.
    if (game.player.inCar && d < 40) {
      if (cop.ramTimer <= 0) {
        cop.speed *= 0.6;
        game.player.inCar.speed *= 0.7;
        spawnParticles(game, cop.x, cop.y, '#ffd23c', 4, 120);
        cop.ramTimer = 0.8;
      }
      const nx = (cop.x - game.player.x) / (d || 1);
      const ny = (cop.y - game.player.y) / (d || 1);
      cop.x += nx * 24;
      cop.y += ny * 24;
    }
    if (cop.ramTimer > 0) cop.ramTimer -= dt;
  }
  if (game.heli) updateHeli(game.heli, game.player, dt);
}

function bustPlayer(game) {
  game.screen = 'busted';
  sfxBusted(game.audio);
  addFeed(game, 'SBPD: suspect in custody. Mara is busted.');
  game.player.health = 0;
}

// --- main update -----------------------------------------------------------

export function update(game, dt) {
  game.time += dt;
  const input = game.input;
  const p = game.player;
  if (p.fireTimer > 0) p.fireTimer -= dt;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;

  // Global toggles.
  if (inputPressed(input, 'KeyM')) {
    const on = toggleMusic(game.audio);
    addFeed(game, on ? 'Music on.' : 'Music off.');
  }
  if (inputPressed(input, 'KeyQ')) {
    setStation(game.audio, game.audio.station + 1);
    addFeed(game, `Radio: ${stationName(game.audio)}.`);
  }

  if (game.screen === 'title') {
    if (inputPressed(input, 'Enter')) {
      ensureAudio(game.audio);
      game.screen = 'playing';
      game.mission.phase = 'briefing';
      addFeed(game, 'Mara Solis, driver-for-hire. First job is waiting — press ENTER.');
    }
    if (inputPressed(input, 'Digit1')) { if (applySave(game, 0)) game.screen = 'playing'; }
    if (inputPressed(input, 'Digit2')) { if (applySave(game, 1)) game.screen = 'playing'; }
    if (inputPressed(input, 'Digit3')) { if (applySave(game, 2)) game.screen = 'playing'; }
    return;
  }

  if (game.screen === 'busted') {
    if (inputPressed(input, 'Enter')) {
      const fresh = makeGame(game.canvas, game.seed);
      Object.assign(game, fresh);
      game.screen = 'title';
    }
    return;
  }

  if (inputPressed(input, 'KeyP')) {
    game.screen = game.screen === 'paused' ? 'playing' : 'paused';
  }
  if (game.screen === 'paused') {
    if (inputPressed(input, 'KeyR')) {
      game.mission.phase = 'briefing';
      game.mission.target = null;
      addFeed(game, 'Job restarted.');
    }
    return;
  }

  // Playing.
  if (game.freezeWorld) return; // staged screenshot mode holds the frame.
  if (inputPressed(input, 'Enter') && game.mission.phase === 'briefing') {
    ensureAudio(game.audio);
    startMission(game);
  }
  if (inputPressed(input, 'KeyE')) tryEnterExitCar(game);
  if (inputPressed(input, 'KeyG') && p.inCar && p.money >= MONEY.garageTuneCost && p.tunes < MONEY.maxTunes) {
    p.money -= MONEY.garageTuneCost;
    p.tunes++;
    sfxPickup(game.audio);
    addFeed(game, `Garage tune #${p.tunes}: +15% top speed. The ${p.inCar.model} purrs now.`);
  }
  if (input.mousePressed || input.clickQueue > 0) tryShoot(game);
  if (inputPressed(input, 'Space')) tryPunch(game);
  if (inputPressed(input, 'KeyF')) {
    // Quick-save to slot 1.
    if (writeSave(game, 0)) addFeed(game, 'Saved to slot 1 (F).');
  }

  // Mouse world position for aiming.
  const cam = game.camera;
  input.mouseWorldX = cam.x + input.mouseX;
  input.mouseWorldY = cam.y + input.mouseY;

  if (p.inCar) updatePlayerDriving(p, p.inCar, input, dt);
  else updatePlayerOnFoot(p, input, dt);

  for (const ped of game.peds) updatePed(ped, game.city, dt, p.x, p.y);
  // Hostile crew beat on the player up close.
  for (const ped of game.peds) {
    if (ped.hostile && !ped.dead && !p.inCar && dist2(ped.x, ped.y, p.x, p.y) < 30 * 30) {
      p.health -= 12 * dt;
      if (p.health <= 0) bustPlayer(game);
    }
  }
  for (const car of game.traffic) updateTrafficCar(car, game.city, dt);
  // Escort van follows the player's road, slowly.
  if (game.mission.van) {
    const van = game.mission.van;
    const d = Math.hypot(p.x - van.x, p.y - van.y);
    if (d > 160) {
      const want = Math.atan2(p.y - van.y, p.x - van.x);
      van.angle += clamp(((want - van.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1.6 * dt, 1.6 * dt);
      van.speed = Math.min(260, van.speed + 200 * dt);
    } else {
      van.speed = Math.max(0, van.speed - 300 * dt);
    }
    van.x += Math.cos(van.angle) * van.speed * dt;
    van.y += Math.sin(van.angle) * van.speed * dt;
  }
  updateMission(game, dt);
  updatePolice(game, dt);

  // Particles.
  for (const pt of game.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);

  // Ambient dispatch chatter.
  if (game.rng.next() < dt * 0.02) {
    const lines = [
      'SBPD: traffic stop on Palmera Shore, all clear.',
      'SBPD: reports of street racing near the pier.',
      'SBPD: unit 12, check the Marina Yards.',
      'SBPD: all quiet in Verde Heights.',
      'SBPD: a Comet was seen speeding downtown.',
    ];
    addFeed(game, game.rng.pick(lines));
  }

  tickAudio(game.audio);
  updateEngineSound(game.audio, p.inCar ? p.inCar.speed : 0, game.stars);
}

// --- boot ------------------------------------------------------------------

export function frame(game, now) {
  const dt = Math.min(0.05, (now - (game.lastNow ?? now)) / 1000 || 0.016);
  game.lastNow = now;
  update(game, dt);
  // Consume one-shot presses here, after every early return above, so a
  // stale press can never double-fire (e.g. P toggling pause twice).
  endFrameInput(game.input);
  render(game.ctx, game, game.time);
}

// Debug handle for the playtest driver (window.__solara).
export function debugHandle(game) {
  return {
    game,
    screen: () => game.screen,
    player: () => ({
      x: game.player.x, y: game.player.y,
      health: game.player.health, money: game.player.money,
      ammo: game.player.ammo, inCar: !!game.player.inCar,
      stars: game.stars, heat: game.heat,
      respect: game.player.respect, tunes: game.player.tunes,
    }),
    mission: () => ({
      index: game.mission.index, phase: game.mission.phase,
      title: currentMissionDef(game).title,
    }),
    counts: () => ({
      peds: game.peds.filter((x) => !x.dead).length,
      traffic: game.traffic.length,
      cops: game.cops.length,
      heli: !!game.heli,
      roadblocks: game.roadblocks.length,
      feed: game.feed.length,
    }),
    press: (code) => {
      game.input.pressedKeys.add(code);
      game.input.keys.add(code);
    },
    release: (code) => { game.input.keys.delete(code); },
    hold: (code, ms) => {
      game.input.keys.add(code);
      setTimeout(() => game.input.keys.delete(code), ms);
    },
    clickAt: (x, y) => {
      game.input.mouseX = x;
      game.input.mouseY = y;
      game.input.mouseSeen = true;
      game.input.mousePressed = true;
      game.input.clickQueue = 1;
    },
    teleport: (x, y) => {
      game.player.x = x;
      game.player.y = y;
      // A player in a car takes the car along.
      if (game.player.inCar) {
        game.player.inCar.x = x;
        game.player.inCar.y = y;
      }
    },
    setHeat: (h) => { game.heat = h; game.stars = starsFromHeat(h); },
    setAmmo: (n) => { game.player.ammo = n; },
    start: () => { game.screen = 'playing'; game.mission.phase = 'briefing'; },
    startMission: () => { if (game.mission.phase === 'briefing') startMission(game); },
    completeMissionNow: () => { completeMission(game); },
    save: (slot) => writeSave(game, slot),
    readSave: (slot) => readSave(game, slot),
    feed: () => [...game.feed],
    respectRank: () => respectRank(game.player.respect),
  };
}
