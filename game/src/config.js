// Solara Bay — tuning constants and world layout. One place for every number
// the rest of the game shares, so balancing is a single-file edit.
export const WORLD = {
  width: 3200,
  height: 2400,
  // City grid: avenues run north-south, streets east-west, on a 400px pitch
  // with a jittered offset so the map does not read as a perfect grid.
  pitch: 400,
  avenueCount: 8,
  streetCount: 6,
  roadHalf: 26,
  sidewalk: 14,
};

export const DISTRICTS = [
  { name: 'Crown District', x: 0, y: 0, w: 1600, h: 800, tone: '#2a2f45', neon: '#ff5fa2' },
  { name: 'Palmera Shore', x: 1600, y: 0, w: 1600, h: 800, tone: '#27354a', neon: '#37e0c8' },
  { name: 'Old Harbor', x: 0, y: 800, w: 1600, h: 800, tone: '#33291f', neon: '#ffb347' },
  { name: 'Marina Yards', x: 1600, y: 800, w: 1600, h: 800, tone: '#1f2f33', neon: '#7dd7ff' },
  { name: 'Verde Heights', x: 0, y: 1600, w: 3200, h: 800, tone: '#22301f', neon: '#a4ff6a' },
];

export const PLAYER = {
  walkSpeed: 205,
  runSpeed: 300,
  radius: 13,
  health: 100,
  // Driving physics: arcade, not sim — grip keeps it fun at low speed.
  carAccel: 620,
  carBrake: 900,
  carReverse: 260,
  carMaxSpeed: 560,
  carTurn: 2.9,
  carGrip: 6.5,
};

export const WANTED = {
  // Heat 0..100; stars are heat/20 rounded up. Crimes add heat, hiding sheds it.
  stealCar: 22,
  punch: 8,
  shoot: 30,
  killCop: 40,
  decayPerSecond: 1.6,
  decayHidden: 4.5,
  roadblockAtStars: 3,
  heliAtStars: 4,
  maxCops: 6,
};

export const MONEY = {
  start: 120,
  garageTuneCost: 500,
  tuneSpeedBonus: 0.15,
  maxTunes: 3,
};

export const RADIO = [
  { id: 'sol', name: 'SOL 98.5', mood: 'sunset pop', bpm: 112, root: 57, scale: [0, 2, 4, 7, 9] },
  { id: 'bay', name: 'BAY FM', mood: 'late-night funk', bpm: 96, root: 45, scale: [0, 3, 5, 7, 10] },
  { id: 'nitro', name: 'NITRO', mood: 'chase electro', bpm: 128, root: 50, scale: [0, 2, 3, 7, 8] },
];

export const VIEW = { width: 1280, height: 720 };

// Palette for the dusk look: a sun-soaked city going neon at dusk.
export const PALETTE = {
  skyTop: '#2b1e4d',
  skyMid: '#c65a7a',
  skyLow: '#ff9e57',
  asphalt: '#23232e',
  asphaltLine: '#d8c25a',
  sidewalk: '#3a3a46',
  grass: '#2c4630',
  sand: '#c9a86a',
  water: '#1d4e5f',
  buildingEdge: '#14141c',
};
