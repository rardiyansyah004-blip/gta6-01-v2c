// The story: nine jobs for Mara Solis, a driver-for-hire in Solara Bay,
// from a first set of wheels to the Crown of Solara. Each mission is data:
// a briefing, an objective type, a target on the map and a payout. The game
// object runs them in order and tracks progress.
import { WORLD } from './config.js';
import { randomRoadPoint, nearestRoadPoint } from './city.js';

export const MISSION_CHAIN = [
  {
    id: 'first-wheels', title: 'First Wheels', pay: 150,
    brief: 'Mara needs wheels. Borrow a car — any car — and bring it to the garage on Crown Ave.',
    type: 'steal-and-deliver', district: 'Crown District',
  },
  {
    id: 'courier-run', title: 'Courier Run', pay: 200,
    brief: 'A package for the Old Harbor. Drive it there before the clock runs out. No questions.',
    type: 'timed-goto', district: 'Old Harbor', timeLimit: 75,
  },
  {
    id: 'getaway', title: 'Getaway', pay: 300,
    brief: 'A job went loud. Lose the cruisers — get your heat down to zero and reach the safehouse.',
    type: 'lose-heat', district: 'Verde Heights',
  },
  {
    id: 'dockside', title: 'Dockside Takedown', pay: 400,
    brief: 'Rivals are holding the Marina Yards. Clear them out — on foot, with your pistol.',
    type: 'eliminate', district: 'Marina Yards', targets: 4,
  },
  {
    id: 'big-score', title: 'The Big Score', pay: 600,
    brief: 'The Crown Bank vault. Grab the cash and get out of Crown District before the response arrives.',
    type: 'grab-and-escape', district: 'Crown District',
  },
  {
    id: 'street-kings', title: 'Street Kings', pay: 500,
    brief: 'A four-checkpoint street race along the shore. Beat both rivals to the finish.',
    type: 'race', district: 'Palmera Shore', checkpoints: 4, timeLimit: 120,
  },
  {
    id: 'harbor-heat', title: 'Harbor Heat', pay: 550,
    brief: 'Hold the docks against the incoming crew. Survive the waves — three of them.',
    type: 'defend', district: 'Marina Yards', waves: 3,
  },
  {
    id: 'getaway-driver', title: 'Getaway Driver', pay: 700,
    brief: 'Escort the crew van through the city while the SBPD hunts you. Keep the van alive.',
    type: 'escort', district: 'Old Harbor',
  },
  {
    id: 'crown', title: 'Crown of Solara', pay: 1000,
    brief: 'The finale. Five stars, the whole city after you. Reach the Palmera pier alive.',
    type: 'finale', district: 'Palmera Shore',
  },
];

export function makeMissionState(city, rng) {
  return {
    index: 0,
    phase: 'briefing', // briefing | active | done | complete
    timer: 0,
    progress: 0,
    target: null,
    checkpoint: 0,
    eliminated: 0,
    wave: 0,
    heat: 0,
    van: null,
    checkpoints: [],
    startedAt: 0,
  };
}

// Place the current mission's target on the map. Called when a mission starts.
export function placeMissionTarget(mission, city, rng, player) {
  const def = MISSION_CHAIN[mission.index];
  const spot = randomRoadPoint(city, rng);
  mission.target = { x: spot.x, y: spot.y };
  mission.checkpoints = [];
  if (def.type === 'race') {
    // Four checkpoints snaking along the shore roads, snapped onto the
    // nearest road so the race is driven on asphalt, not through buildings.
    let cx = 400;
    let cy = 300;
    for (let i = 0; i < def.checkpoints; i++) {
      const snapped = nearestRoadPoint(city, cx, cy);
      mission.checkpoints.push({ x: snapped.x, y: snapped.y, done: false });
      cx += 620;
      cy = cy === 300 ? 1100 : 300;
    }
    mission.target = mission.checkpoints[0];
  }
  if (def.type === 'defend' || def.type === 'eliminate') {
    mission.target = { x: player.x + 320, y: player.y };
  }
  mission.timer = def.timeLimit ?? 0;
  mission.progress = 0;
  mission.checkpoint = 0;
  mission.eliminated = 0;
  mission.wave = 0;
  return def;
}

export function missionObjectiveText(def, mission) {
  switch (def.type) {
    case 'steal-and-deliver': return 'Steal a car, then drive to the garage marker';
    case 'timed-goto': return `Reach the marker — ${Math.max(0, Math.ceil(mission.timer))}s left`;
    case 'lose-heat': return 'Lose the heat, then reach the safehouse marker';
    case 'eliminate': return `Take out the crew — ${mission.eliminated}/${def.targets} down`;
    case 'grab-and-escape': return mission.progress === 0 ? 'Grab the cash at the bank' : 'Escape Crown District';
    case 'race': return `Checkpoint ${mission.checkpoint + 1}/${def.checkpoints} — ${Math.max(0, Math.ceil(mission.timer))}s left`;
    case 'defend': return `Hold the docks — wave ${mission.wave + 1}/${def.waves}`;
    case 'escort': return 'Escort the van to the marker — keep it alive';
    case 'finale': return 'Reach the Palmera pier — 5 stars on you';
    default: return def.brief;
  }
}

export function respectRank(respect) {
  if (respect >= 900) return 'Queen of Solara';
  if (respect >= 650) return 'Street Royalty';
  if (respect >= 450) return 'Big Shot';
  if (respect >= 250) return 'Rising Name';
  if (respect >= 100) return 'Known Face';
  return 'Nobody';
}
