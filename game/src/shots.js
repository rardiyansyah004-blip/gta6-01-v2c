// Staged screenshot scenes (?shot=1..4). Each one composes a frozen frame
// that proves a different system: the 5-star chase, the street race, the
// living dusk city on foot, and the title screen with save slots. The world
// is frozen after staging so the composition never drifts.
import { WORLD } from './config.js';
import { makeCop, makeHeli, makeTrafficCar, starsFromHeat } from './actors.js';
import { placeMissionTarget } from './missions.js';
import { nearestRoadPoint } from './city.js';

function putPlayerInCar(game, model, color, top, x, y, angle) {
  const car = {
    id: 9000 + Math.floor(Math.random() * 99), kind: 'car', model, color,
    top, len: 48, wid: 22, x, y, angle, speed: 0,
    cruise: top, vertical: false, driver: false, stolen: true,
  };
  game.player.inCar = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  return car;
}

function seedFeed(game, lines) {
  game.feed = [...lines];
}

function stageChase(game) {
  // Shot 1 — the cover: 5-star chase at dusk.
  const cx = 1500;
  const cy = 1100;
  game.screen = 'playing';
  game.mission.index = 7;
  game.mission.phase = 'active';
  placeMissionTarget(game.mission, game.city, game.rng, game.player);
  putPlayerInCar(game, 'Vortex GT', '#3c7dd8', 560, cx, cy, 0);
  game.player.inCar.speed = 420;
  game.player.money = 2450;
  game.player.respect = 720;
  game.heat = 100;
  game.stars = 5;
  game.cops = [];
  for (let i = 0; i < 3; i++) {
    const cop = makeCop(game.city, game.rng, cx + 200 + i * 120, cy + (i - 1) * 160);
    cop.speed = 480;
    game.cops.push(cop);
  }
  const rb = nearestRoadPoint(game.city, cx + 560, cy);
  game.roadblocks = [{ x: rb.x, y: rb.y, angle: 0 }];
  game.heli = makeHeli(cx, cy);
  game.heli.x = cx - 120;
  game.heli.y = cy - 200;
  game.heli.searchX = cx;
  game.heli.searchY = cy;
  seedFeed(game, [
    'SBPD: Air One is overhead — the searchlight is on you.',
    'SBPD: roadblock set on Crown Ave — all units converge.',
    'SBPD: suspect in a blue Vortex GT, 5 stars, do not lose her.',
    'SBPD: unit 7 in pursuit, speeds over 90.',
  ]);
  game.freezeWorld = true;
}

function stageRace(game) {
  // Shot 2 — Street Kings race in progress. The player starts west of the
  // first checkpoint with two rivals just ahead, all facing east toward it.
  const cx = 180;
  const cy = 300;
  game.screen = 'playing';
  game.mission.index = 5;
  game.mission.phase = 'active';
  placeMissionTarget(game.mission, game.city, game.rng, game.player);
  putPlayerInCar(game, 'Comet', '#d8443c', 520, cx, cy, 0);
  game.player.inCar.speed = 460;
  game.player.money = 1380;
  game.player.respect = 310;
  game.heat = 0;
  game.stars = 0;
  game.mission.timer = 96;
  // Two rivals ahead of the player, between her and the checkpoint.
  game.traffic = game.traffic.slice(0, 6);
  const rival1 = makeTrafficCar(game.city, game.rng);
  rival1.x = cx + 130; rival1.y = cy - 26; rival1.angle = 0; rival1.speed = 430; rival1.color = '#e8b13c';
  const rival2 = makeTrafficCar(game.city, game.rng);
  rival2.x = cx + 160; rival2.y = cy + 28; rival2.angle = 0; rival2.speed = 410; rival2.color = '#7dd87a';
  game.traffic.push(rival1, rival2);
  seedFeed(game, [
    'STREET KINGS: checkpoint 1 ahead — hold the line.',
    'SBPD: reports of street racing near the pier.',
    'Radio: NITRO is on — 128 BPM for the chase.',
  ]);
  game.freezeWorld = true;
}

function stageCity(game) {
  // Shot 3 — living dusk intersection, on foot with a pistol. Set the
  // player's spot FIRST: the mission target is placed relative to her.
  const ix = 1200;
  const iy = 1000;
  game.screen = 'playing';
  game.player.x = ix;
  game.player.y = iy;
  game.player.angle = -0.5;
  game.player.aimX = ix + 120;
  game.player.aimY = iy - 60;
  game.mission.index = 3;
  game.mission.phase = 'active';
  placeMissionTarget(game.mission, game.city, game.rng, game.player);
  game.player.money = 640;
  game.player.respect = 180;
  game.player.ammo = 18;
  game.heat = 35;
  game.stars = 2;
  const cop = makeCop(game.city, game.rng, ix + 180, iy + 60);
  cop.speed = 200;
  game.cops = [cop];
  // A burning wreck nearby, peds scattering.
  game.city.wrecks.push({ x: ix - 140, y: iy + 90, angle: 0.6, color: '#1c1c22', smoke: 3 });
  for (const ped of game.peds.slice(0, 6)) {
    ped.x = ix + (Math.random() - 0.5) * 500;
    ped.y = iy + (Math.random() - 0.5) * 300;
    ped.panic = 2;
  }
  seedFeed(game, [
    'SBPD: shots fired, pedestrian down. Units responding.',
    'SBPD: 2 stars on the suspect near Old Harbor.',
    'SBPD: unit 12, check the Marina Yards.',
  ]);
  game.freezeWorld = true;
}

function stageTitle(game) {
  // Shot 4 — the title screen with save slots.
  game.screen = 'title';
  try {
    window.localStorage.setItem('solara-bay.save.v2c.slot0', JSON.stringify({ job: 4, money: 860, respect: 190, jobsDone: 3, carsStolen: 5, savedAt: '2026-11-24T02:00:00Z' }));
    window.localStorage.setItem('solara-bay.save.v2c.slot1', JSON.stringify({ job: 7, money: 2140, respect: 480, jobsDone: 6, carsStolen: 11, savedAt: '2026-11-24T02:00:00Z' }));
    window.localStorage.setItem('solara-bay.save.v2c.slot2', JSON.stringify({ job: 9, money: 5300, respect: 940, jobsDone: 9, carsStolen: 19, savedAt: '2026-11-24T02:00:00Z' }));
  } catch {
    // localStorage unavailable — the title still renders with empty slots.
  }
  game.freezeWorld = true;
}

export function stageShot(game, n) {
  if (n === 1) stageChase(game);
  else if (n === 2) stageRace(game);
  else if (n === 3) stageCity(game);
  else if (n === 4) stageTitle(game);
}
