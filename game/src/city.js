// The city of Solara Bay: a road grid, building blocks, neon, palms and
// wrecks, all generated from a seed. Everything is plain data — the renderer
// draws it, the actors drive on it, missions point at it.
import { WORLD, DISTRICTS, PALETTE } from './config.js';
import { makeRng, clamp } from './rng.js';

const CAR_COLORS = ['#d8443c', '#3c7dd8', '#e8b13c', '#7dd87a', '#c9c9d4', '#8a5fd0', '#e07020', '#3ec8c0'];
const NEON_WORDS = ['HOTEL', 'TACOS', '24H', 'BAR', 'CASINO', 'PIER', 'GYM', 'CLUB', 'MOTEL', 'DANCE', 'PALMS', 'LUNA'];
const BUILDING_TONES = ['#3d3a55', '#4a3a4d', '#37455c', '#54402e', '#2f4038', '#50323a'];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const avenues = [];
  const streets = [];
  for (let i = 0; i < WORLD.avenueCount; i++) {
    avenues.push(200 + i * WORLD.pitch + rng.range(-24, 24));
  }
  for (let i = 0; i < WORLD.streetCount; i++) {
    streets.push(200 + i * WORLD.pitch + rng.range(-24, 24));
  }

  // Buildings fill the blocks between roads. Each block holds 1-4 buildings
  // with lit windows; a few blocks are parks, parking lots or the beach.
  const buildings = [];
  const parks = [];
  const lots = [];
  for (let ai = 0; ai < avenues.length - 1; ai++) {
    for (let si = 0; si < streets.length - 1; si++) {
      const x0 = avenues[ai] + WORLD.roadHalf + WORLD.sidewalk + 8;
      const y0 = streets[si] + WORLD.roadHalf + WORLD.sidewalk + 8;
      const x1 = avenues[ai + 1] - WORLD.roadHalf - WORLD.sidewalk - 8;
      const y1 = streets[si + 1] - WORLD.roadHalf - WORLD.sidewalk - 8;
      const roll = rng.next();
      if (roll < 0.1) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, palms: rng.int(3, 7) });
        continue;
      }
      if (roll < 0.18) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, cars: rng.int(2, 5) });
        continue;
      }
      const count = rng.int(1, 4);
      for (let b = 0; b < count; b++) {
        const bw = (x1 - x0) / (count === 1 ? 1 : 2) - 14;
        const bh = (y1 - y0) / (count <= 2 ? 1 : 2) - 14;
        const bx = x0 + (b % 2) * ((x1 - x0) / 2) + 7;
        const by = y0 + Math.floor(b / 2) * ((y1 - y0) / 2) + 7;
        const floors = rng.int(2, 9);
        const windows = [];
        const cols = Math.max(2, Math.floor(bw / 26));
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < cols; c++) {
            if (rng.chance(0.55)) windows.push({ f, c, warm: rng.chance(0.7) });
          }
        }
        buildings.push({
          x: bx, y: by, w: bw, h: bh, floors,
          tone: rng.pick(BUILDING_TONES),
          roof: rng.pick(['#23202e', '#2e2a33', '#1f2a24']),
          windows, cols,
          neon: rng.chance(0.4) ? { word: rng.pick(NEON_WORDS), color: rng.pick(['#ff5fa2', '#37e0c8', '#ffb347', '#7dd7ff', '#a4ff6a']) } : null,
        });
      }
    }
  }

  // Burned-out wrecks with smoke — the city has a history.
  const wrecks = [];
  for (let i = 0; i < 5; i++) {
    const road = rng.pick(avenues);
    const cross = rng.pick(streets);
    wrecks.push({
      x: road + rng.range(-40, 40),
      y: cross + rng.range(60, 300),
      angle: rng.range(0, Math.PI * 2),
      color: '#1c1c22',
      smoke: rng.range(0, 10),
    });
  }

  // Palm rows along the shore (east edge) and the beach strip.
  const palms = [];
  for (let y = 120; y < WORLD.height - 120; y += 90) {
    palms.push({ x: WORLD.width - 70 + rng.range(-14, 14), y: y + rng.range(-20, 20) });
  }
  for (let i = 0; i < 24; i++) {
    palms.push({ x: rng.range(80, WORLD.width - 80), y: rng.range(80, WORLD.height - 80) });
  }

  return { seed, avenues, streets, buildings, parks, lots, wrecks, palms };
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

export function onRoad(city, x, y) {
  const r = WORLD.roadHalf;
  for (const a of city.avenues) if (Math.abs(x - a) <= r) return true;
  for (const s of city.streets) if (Math.abs(y - s) <= r) return true;
  return false;
}

// Nearest point on the road network to (x, y) — used to snap spawns.
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const a of city.avenues) {
    const d = Math.abs(x - a);
    if (d < bestD) { bestD = d; best = { x: a, y: clamp(y, 40, WORLD.height - 40), vertical: true }; }
  }
  for (const s of city.streets) {
    const d = Math.abs(y - s);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 40, WORLD.width - 40), y: s, vertical: false }; }
  }
  return best;
}

// A random point on a road, for traffic and mission spawns.
export function randomRoadPoint(city, rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(city.avenues) + rng.range(-14, 14), y: rng.range(60, WORLD.height - 60), vertical: true };
  }
  return { x: rng.range(60, WORLD.width - 60), y: rng.pick(city.streets) + rng.range(-14, 14), vertical: false };
}

export function paletteFor(x, y) {
  const d = districtAt(x, y);
  return { ...PALETTE, districtTone: d.tone, neon: d.neon };
}
