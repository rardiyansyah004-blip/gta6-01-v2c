// Actors: the player on foot and in cars, pedestrians, traffic, police
// cruisers and the Air One helicopter. Each actor is plain data; the update
// functions below move them, and the renderer draws them.
import { WORLD, PLAYER, WANTED } from './config.js';
import { makeRng, clamp, angleDiff, angleLerp, dist2 } from './rng.js';
import { nearestRoadPoint, randomRoadPoint } from './city.js';
import { inputDown } from './input.js';

const PED_SHIRTS = ['#e05a4e', '#4e8de0', '#e0c24e', '#7ac74f', '#b06ad0', '#e0e0e0', '#e07ab0', '#4ec8c0'];
const COP_COLOR = '#20242e';
let nextId = 1;

export function makePlayer(x, y) {
  return {
    id: nextId++, kind: 'player', x, y, angle: -Math.PI / 2,
    vx: 0, vy: 0, speed: 0, health: PLAYER.health, money: 120,
    ammo: 24, inCar: null, respect: 0, tunes: 0, running: false,
    aimX: x, aimY: y - 60, fireTimer: 0, punchTimer: 0, hurtTimer: 0,
  };
}

export function makePed(city, rng, x, y) {
  const p = x === undefined ? randomRoadPoint(city, rng) : { x, y };
  return {
    id: nextId++, kind: 'ped', x: p.x, y: p.y,
    angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 62),
    shirt: rng.pick(PED_SHIRTS), skin: rng.pick(['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0']),
    walkPhase: rng.range(0, 6), target: null, panic: 0, dead: false,
    // Hostile crew (missions 4 and 7): chase the player instead of wandering.
    hostile: false,
  };
}

// A hostile crew member: spawns near a point and hunts the player.
export function makeHostilePed(city, rng, x, y) {
  const ped = makePed(city, rng, x, y);
  ped.hostile = true;
  ped.shirt = '#3a3a44';
  ped.speed = rng.range(70, 95);
  return ped;
}

const TRAFFIC_MODELS = [
  { name: 'Comet', color: '#d8443c', top: 520, len: 46, wid: 22 },
  { name: 'Vortex GT', color: '#3c7dd8', top: 560, len: 48, wid: 22 },
  { name: 'Solstice', color: '#e8b13c', top: 470, len: 44, wid: 21 },
  { name: 'Bison', color: '#7dd87a', top: 430, len: 52, wid: 24 },
  { name: 'Lumen', color: '#c9c9d4', top: 490, len: 45, wid: 21 },
  { name: 'Onyx', color: '#8a5fd0', top: 510, len: 47, wid: 22 },
  { name: 'Dune', color: '#e07020', top: 450, len: 50, wid: 23 },
  { name: 'Marlin', color: '#3ec8c0', top: 480, len: 46, wid: 22 },
];

export function makeTrafficCar(city, rng) {
  const spot = randomRoadPoint(city, rng);
  const model = rng.pick(TRAFFIC_MODELS);
  return {
    id: nextId++, kind: 'car', model: model.name, color: model.color,
    top: model.top, len: model.len, wid: model.wid,
    x: spot.x, y: spot.y,
    angle: spot.vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
    speed: rng.range(90, 170), cruise: rng.range(90, 170),
    vertical: spot.vertical, driver: true, stolen: false,
  };
}

export function makeCop(city, rng, nearX, nearY) {
  const spot = nearestRoadPoint(city, nearX + rng.range(-500, 500), nearY + rng.range(-500, 500));
  return {
    id: nextId++, kind: 'cop', model: 'Interceptor', color: COP_COLOR,
    top: 540, len: 48, wid: 22,
    x: spot.x, y: spot.y,
    angle: spot.vertical ? Math.PI / 2 : 0,
    speed: 0, cruise: 300, vertical: spot.vertical,
    siren: rng.range(0, 6), roadblock: false, ramTimer: 0,
  };
}

export function makeHeli(x, y) {
  return {
    id: nextId++, kind: 'heli', x, y: y - 260, angle: 0,
    altitude: 150, orbit: 0, searchX: x, searchY: y, rotor: 0,
  };
}

// --- updates ---------------------------------------------------------------

export function updatePlayerOnFoot(player, input, dt) {
  let mx = 0;
  let my = 0;
  if (inputDown(input, 'KeyW') || inputDown(input, 'ArrowUp')) my -= 1;
  if (inputDown(input, 'KeyS') || inputDown(input, 'ArrowDown')) my += 1;
  if (inputDown(input, 'KeyA') || inputDown(input, 'ArrowLeft')) mx -= 1;
  if (inputDown(input, 'KeyD') || inputDown(input, 'ArrowRight')) mx += 1;
  const moving = mx !== 0 || my !== 0;
  if (moving) {
    const len = Math.hypot(mx, my);
    const speed = (inputDown(input, 'ShiftLeft') || inputDown(input, 'ShiftRight')) ? PLAYER.runSpeed : PLAYER.walkSpeed;
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
    player.angle = Math.atan2(my, mx);
    player.running = speed === PLAYER.runSpeed;
  } else {
    player.running = false;
  }
  player.x = clamp(player.x, 20, WORLD.width - 20);
  player.y = clamp(player.y, 20, WORLD.height - 20);
  // Aim follows the mouse (screen space is converted by the caller).
  if (input.mouseSeen) {
    player.aimX = input.mouseWorldX;
    player.aimY = input.mouseWorldY;
  }
  return moving;
}

export function updatePlayerDriving(player, car, input, dt) {
  const forward = inputDown(input, 'KeyW') || inputDown(input, 'ArrowUp');
  const back = inputDown(input, 'KeyS') || inputDown(input, 'ArrowDown');
  const left = inputDown(input, 'KeyA') || inputDown(input, 'ArrowLeft');
  const right = inputDown(input, 'KeyD') || inputDown(input, 'ArrowRight');
  const bonus = 1 + player.tunes * 0.15;
  const top = car.top * bonus;
  if (forward) car.speed = Math.min(top, car.speed + PLAYER.carAccel * dt);
  else if (back) car.speed = Math.max(-PLAYER.carReverse, car.speed - PLAYER.carBrake * dt);
  else {
    // Coast down.
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = clamp(Math.abs(car.speed) / 200, 0.15, 1);
  car.angle += steer * PLAYER.carTurn * grip * Math.sign(car.speed) * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 20, WORLD.width - 20);
  car.y = clamp(car.y, 20, WORLD.height - 20);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;
  return Math.abs(car.speed) > 20;
}

export function updatePed(ped, city, dt, dangerX, dangerY) {
  if (ped.dead) return;
  // Hostile crew chase the player directly.
  if (ped.hostile) {
    const heading = Math.atan2(dangerY - ped.y, dangerX - ped.x);
    ped.angle = angleLerp(ped.angle, heading, Math.min(1, dt * 5));
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.x = clamp(ped.x, 20, WORLD.width - 20);
    ped.y = clamp(ped.y, 20, WORLD.height - 20);
    ped.walkPhase += dt * ped.speed * 0.06;
    return;
  }
  const d2 = dist2(ped.x, ped.y, dangerX, dangerY);
  if (d2 < 220 * 220) ped.panic = Math.min(3, ped.panic + dt * 2);
  else ped.panic = Math.max(0, ped.panic - dt);
  const speed = ped.speed * (ped.panic > 0 ? 2.4 : 1);
  if (!ped.target || dist2(ped.x, ped.y, ped.target.x, ped.target.y) < 30 * 30) {
    const spot = randomRoadPoint(city, makeRng((ped.id * 7919 + Date.now()) % 2147483647));
    ped.target = spot;
  }
  let heading = ped.angle;
  if (ped.panic > 0) {
    // Flee directly away from the danger.
    heading = Math.atan2(ped.y - dangerY, ped.x - dangerX);
  } else if (ped.target) {
    heading = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
  }
  ped.angle = angleLerp(ped.angle, heading, Math.min(1, dt * 4));
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  ped.x = clamp(ped.x, 20, WORLD.width - 20);
  ped.y = clamp(ped.y, 20, WORLD.height - 20);
  ped.walkPhase += dt * speed * 0.06;
}

export function updateTrafficCar(car, city, dt) {
  // Cruise along the current road; at an intersection, sometimes turn.
  const step = car.speed * dt;
  car.x += Math.cos(car.angle) * step;
  car.y += Math.sin(car.angle) * step;
  // Wrap around the world edge instead of despawning (keeps streets full).
  if (car.x < 30) { car.x = WORLD.width - 40; }
  if (car.x > WORLD.width - 30) { car.x = 40; }
  if (car.y < 30) { car.y = WORLD.height - 40; }
  if (car.y > WORLD.height - 30) { car.y = 40; }
  // Snap back onto the nearest road if drifted off (keeps traffic believable).
  if (!nearRoad(city, car.x, car.y, 40)) {
    const spot = nearestRoadPoint(city, car.x, car.y);
    car.x = spot.x;
    car.y = spot.y;
    car.angle = spot.vertical ? Math.PI / 2 : 0;
  }
}

function nearRoad(city, x, y, margin) {
  for (const a of city.avenues) if (Math.abs(x - a) <= WORLD.roadHalf + margin) return true;
  for (const s of city.streets) if (Math.abs(y - s) <= WORLD.roadHalf + margin) return true;
  return false;
}

export function updateCop(cop, player, dt, rng) {
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const distance = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  // Cops steer toward the player but with limited turn rate, so a good
  // driver can shake them on corners.
  cop.angle += clamp(angleDiff(cop.angle, want), -2.4 * dt, 2.4 * dt);
  const targetSpeed = distance > 420 ? 560 : 480;
  cop.speed += clamp(targetSpeed - cop.speed, -700 * dt, 500 * dt);
  cop.x += Math.cos(cop.angle) * cop.speed * dt;
  cop.y += Math.sin(cop.angle) * cop.speed * dt;
  cop.x = clamp(cop.x, 20, WORLD.width - 20);
  cop.y = clamp(cop.y, 20, WORLD.height - 20);
  cop.siren += dt;
  return distance;
}

export function updateHeli(heli, player, dt) {
  heli.orbit += dt * 0.55;
  const radius = 190;
  const tx = player.x + Math.cos(heli.orbit) * radius;
  const ty = player.y + Math.sin(heli.orbit) * radius;
  heli.x += (tx - heli.x) * Math.min(1, dt * 1.8);
  heli.y += (ty - heli.y) * Math.min(1, dt * 1.8);
  heli.rotor += dt * 30;
  // The searchlight lags behind the player, sweeping the ground.
  heli.searchX += (player.x - heli.searchX) * Math.min(1, dt * 1.2);
  heli.searchY += (player.y - heli.searchY) * Math.min(1, dt * 1.2);
}

export function starsFromHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, Math.ceil(heat / 20));
}
