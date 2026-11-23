// All drawing: the dusk city, the actors, the particles, and the HUD
// (money, health, wanted stars, mission, respect, radio, dispatch feed and
// minimap). One canvas, one camera that follows the player.
import { WORLD, PALETTE, VIEW } from './config.js';
import { districtAt } from './city.js';
import { respectRank } from './missions.js';

export function makeCamera() {
  return { x: 0, y: 0, zoom: 1 };
}

function duskSky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Low sun on the horizon.
  const sun = ctx.createRadialGradient(w * 0.78, h * 0.62, 4, w * 0.78, h * 0.62, 120);
  sun.addColorStop(0, 'rgba(255, 214, 130, 0.9)');
  sun.addColorStop(1, 'rgba(255, 158, 87, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
}

function drawGround(ctx, city, cam) {
  // Base ground: grass, then the beach + water on the east edge.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(WORLD.width - 110, 0, 110, WORLD.height);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(WORLD.width - 34, 0, 34, WORLD.height);
  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = '#2a4a2c';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#3d6a35';
    for (let i = 0; i < park.palms; i++) {
      const px = park.x + 20 + ((i * 53) % Math.max(40, park.w - 40));
      const py = park.y + 24 + ((i * 37) % Math.max(40, park.h - 40));
      drawPalm(ctx, px, py, 1);
    }
  }
  // Roads: asphalt, sidewalks, centre dashes.
  for (const a of city.avenues) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(a - WORLD.roadHalf - WORLD.sidewalk, 0, (WORLD.roadHalf + WORLD.sidewalk) * 2, WORLD.height);
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(a - WORLD.roadHalf, 0, WORLD.roadHalf * 2, WORLD.height);
    ctx.strokeStyle = PALETTE.asphaltLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    ctx.moveTo(a, 0);
    ctx.lineTo(a, WORLD.height);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const s of city.streets) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(0, s - WORLD.roadHalf - WORLD.sidewalk, WORLD.width, (WORLD.roadHalf + WORLD.sidewalk) * 2);
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(0, s - WORLD.roadHalf, WORLD.width, WORLD.roadHalf * 2);
    ctx.strokeStyle = PALETTE.asphaltLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(WORLD.width, s);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Parking lots.
  for (const lot of city.lots) {
    ctx.fillStyle = '#2c2c38';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = '#c9c9d4';
    ctx.lineWidth = 2;
    for (let i = 0; i < lot.cars; i++) {
      const lx = lot.x + 24 + i * 52;
      ctx.strokeRect(lx, lot.y + 14, 40, 20);
    }
  }
}

function drawPalm(ctx, x, y, scale) {
  ctx.strokeStyle = '#6a4a2a';
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 3 * scale, y - 18 * scale);
  ctx.stroke();
  ctx.strokeStyle = '#3d7a35';
  ctx.lineWidth = 3 * scale;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    ctx.beginPath();
    ctx.moveTo(x + 3 * scale, y - 18 * scale);
    ctx.lineTo(x + 3 * scale + Math.cos(a) * 16 * scale, y - 18 * scale + Math.sin(a) * 12 * scale);
    ctx.stroke();
  }
}

function drawBuildings(ctx, city, time) {
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.tone;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    // Lit windows: a warm grid, some flickering with time.
    const cellW = b.w / b.cols;
    const cellH = b.h / Math.max(1, b.floors);
    for (const win of b.windows) {
      const flicker = Math.sin(time * 2 + win.f * 3 + win.c * 5) > -0.85;
      if (!flicker) continue;
      ctx.fillStyle = win.warm ? '#ffd98a' : '#9fd8ff';
      ctx.fillRect(b.x + 5 + win.c * cellW, b.y + 5 + win.f * cellH, cellW - 9, cellH - 9);
    }
    ctx.strokeStyle = PALETTE.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (b.neon) {
      ctx.save();
      ctx.font = `bold ${Math.max(13, Math.min(22, b.w / b.neon.word.length))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = b.neon.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = b.neon.color;
      ctx.fillText(b.neon.word, b.x + b.w / 2, b.y - 6);
      ctx.restore();
    }
  }
  // Shore palms.
  for (const palm of city.palms) drawPalm(ctx, palm.x, palm.y, 1.1);
}

function drawCarShape(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 7);
  ctx.fill();
  ctx.fillStyle = '#1a2030';
  roundRect(ctx, -car.len / 2 + 9, -car.wid / 2 + 4, car.len * 0.42, car.wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(car.len / 2 - 8, -car.wid / 2 + 3, 4, car.wid - 6);
  // Headlight cones at dusk.
  const beam = ctx.createLinearGradient(car.len / 2, 0, car.len / 2 + 90, 0);
  beam.addColorStop(0, 'rgba(255, 240, 180, 0.28)');
  beam.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(car.len / 2, -car.wid / 2 + 2);
  ctx.lineTo(car.len / 2 + 90, -26);
  ctx.lineTo(car.len / 2 + 90, 26);
  ctx.lineTo(car.len / 2, car.wid / 2 - 2);
  ctx.closePath();
  ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(ctx, -car.len / 2 - 2, -car.wid / 2 - 2, car.len + 4, car.wid + 4, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, angle, shirt, skin, phase, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const bob = Math.sin(phase) * 1.5;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 10 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, bob * 0.4, 9 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(7 * scale, 0, 5.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCopLights(ctx, cop, time) {
  const on = Math.floor(time * 6) % 2 === 0;
  ctx.save();
  ctx.translate(cop.x, cop.y);
  ctx.rotate(cop.angle);
  ctx.fillStyle = on ? '#ff2e4d' : '#2e7bff';
  ctx.beginPath();
  ctx.arc(-6, -8, 4, 0, Math.PI * 2);
  ctx.arc(6, -8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = on ? '#2e7bff' : '#ff2e4d';
  ctx.beginPath();
  ctx.arc(-6, 8, 4, 0, Math.PI * 2);
  ctx.arc(6, 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Light wash on the road.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = on ? '#ff2e4d' : '#2e7bff';
  ctx.beginPath();
  ctx.arc(cop.x, cop.y, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 + (1 - p.life / p.maxLife) * 1.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawWrecks(ctx, city, time) {
  for (const w of city.wrecks) {
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.angle);
    ctx.fillStyle = w.color;
    roundRect(ctx, -22, -10, 44, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(-8, -8, 14, 16);
    ctx.restore();
    // Smoke column.
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#8a8a96';
    const sx = w.x + Math.sin(time + w.smoke) * 6;
    const sy = w.y - 26 - ((time * 12 + w.smoke * 9) % 40);
    ctx.beginPath();
    ctx.arc(sx, sy, 10 + ((time * 12 + w.smoke * 9) % 40) * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHeli(ctx, heli, time) {
  // Searchlight cone on the ground first (under the heli).
  const dx = heli.searchX - heli.x;
  const dy = heli.searchY - heli.y;
  const len = Math.hypot(dx, dy) + 60;
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath();
  ctx.moveTo(heli.x, heli.y);
  ctx.arc(heli.x, heli.y, len, ang - 0.22, ang + 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(heli.x, heli.y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(4, 6, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7dd7ff';
  ctx.beginPath();
  ctx.ellipse(12, 0, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9c9d4';
  ctx.lineWidth = 3;
  const r = heli.rotor;
  ctx.beginPath();
  ctx.moveTo(Math.cos(r) * 34, Math.sin(r) * 34);
  ctx.lineTo(-Math.cos(r) * 34, -Math.sin(r) * 34);
  ctx.moveTo(Math.cos(r + Math.PI / 2) * 34, Math.sin(r + Math.PI / 2) * 34);
  ctx.lineTo(-Math.cos(r + Math.PI / 2) * 34, -Math.sin(r + Math.PI / 2) * 34);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('AIR ONE', heli.x, heli.y - 44);
  ctx.restore();
}

function drawRoadblock(ctx, rb) {
  ctx.save();
  ctx.translate(rb.x, rb.y);
  ctx.rotate(rb.angle);
  ctx.fillStyle = '#e8b13c';
  ctx.fillRect(-34, -8, 68, 16);
  ctx.fillStyle = '#20242e';
  for (let i = -30; i < 30; i += 12) ctx.fillRect(i, -8, 6, 16);
  ctx.restore();
  ctx.save();
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('SBPD ROADBLOCK', rb.x, rb.y - 22);
  ctx.restore();
}

// --- HUD -------------------------------------------------------------------

function drawHud(ctx, game) {
  const p = game.player;
  const stars = game.stars;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top right: money, health, ammo, wanted stars.
  ctx.fillStyle = 'rgba(10, 10, 18, 0.72)';
  roundRect(ctx, VIEW.width - 300, 12, 288, 92, 10);
  ctx.fill();
  ctx.fillStyle = '#7dd87a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${Math.floor(p.money)}`, VIEW.width - 284, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`♥ ${Math.max(0, Math.ceil(p.health))}`, VIEW.width - 284, 70);
  ctx.fillText(`Ammo ${p.ammo}`, VIEW.width - 190, 70);
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd23c' : 'rgba(255, 255, 255, 0.25)';
    ctx.fillText('★', VIEW.width - 142 + i * 24, 46);
  }
  ctx.fillStyle = '#c9c9d4';
  ctx.font = '13px sans-serif';
  ctx.fillText(respectRank(p.respect), VIEW.width - 284, 94);
  // Top left: mission tracker.
  const def = game.currentMissionDef();
  ctx.fillStyle = 'rgba(10, 10, 18, 0.72)';
  roundRect(ctx, 12, 12, 430, 86, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`JOB ${game.mission.index + 1}/9 — ${def.title}`, 26, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px sans-serif';
  wrapText(ctx, game.missionObjective(), 26, 58, 402, 18);
  // Bottom left: dispatch feed.
  ctx.fillStyle = 'rgba(10, 10, 18, 0.66)';
  roundRect(ctx, 12, VIEW.height - 132, 360, 120, 10);
  ctx.fill();
  ctx.fillStyle = '#7dd7ff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('SBPD DISPATCH', 24, VIEW.height - 110);
  ctx.fillStyle = '#e8e8f0';
  ctx.font = '13px sans-serif';
  const feed = game.feed.slice(-4);
  feed.forEach((line, i) => {
    ctx.fillText(line, 24, VIEW.height - 88 + i * 20);
  });
  // Bottom right: radio + controls hint.
  ctx.fillStyle = 'rgba(10, 10, 18, 0.66)';
  roundRect(ctx, VIEW.width - 300, VIEW.height - 66, 288, 54, 10);
  ctx.fill();
  ctx.fillStyle = '#ff9e57';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`♪ ${game.radioName()}`, VIEW.width - 284, VIEW.height - 34);
  ctx.fillStyle = '#c9c9d4';
  ctx.font = '12px sans-serif';
  ctx.fillText('Q radio · M music · E enter/exit car · P pause', VIEW.width - 284, VIEW.height - 16);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

function drawMinimap(ctx, game) {
  const size = 168;
  const x0 = VIEW.width - size - 12;
  const y0 = VIEW.height - size - 82;
  const scale = size / WORLD.width;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 10, 18, 0.78)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#1d2a33';
  ctx.fillRect(x0, y0, size, size);
  // Roads.
  ctx.strokeStyle = '#5a5a6a';
  ctx.lineWidth = 2;
  for (const a of game.city.avenues) {
    ctx.beginPath();
    ctx.moveTo(x0 + a * scale, y0);
    ctx.lineTo(x0 + a * scale, y0 + size);
    ctx.stroke();
  }
  for (const s of game.city.streets) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + s * scale);
    ctx.lineTo(x0 + size, y0 + s * scale);
    ctx.stroke();
  }
  // Mission marker.
  if (game.mission.target) {
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(x0 + game.mission.target.x * scale, y0 + game.mission.target.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops.
  ctx.fillStyle = '#2e7bff';
  for (const cop of game.cops) {
    ctx.fillRect(x0 + cop.x * scale - 2, y0 + cop.y * scale - 2, 4, 4);
  }
  // Player.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + game.player.x * scale, y0 + game.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + game.player.x * scale, y0 + game.player.y * scale, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#c9c9d4';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(districtAt(game.player.x, game.player.y).name.toUpperCase(), x0, y0 - 10);
  ctx.restore();
}

function drawTitle(ctx, game) {
  ctx.save();
  duskSky(ctx, VIEW.width, VIEW.height);
  // Skyline silhouette.
  ctx.fillStyle = '#14141f';
  for (let i = 0; i < 26; i++) {
    const bw = 40 + ((i * 37) % 50);
    const bh = 90 + ((i * 53) % 180);
    ctx.fillRect(i * 50, VIEW.height - bh - 130, bw, bh + 130);
  }
  ctx.fillStyle = '#ffd98a';
  for (let i = 0; i < 60; i++) {
    const wx = (i * 97) % VIEW.width;
    const wy = VIEW.height - 140 - ((i * 61) % 220);
    ctx.fillRect(wx, wy, 5, 7);
  }
  ctx.fillStyle = '#ff5fa2';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff5fa2';
  ctx.shadowBlur = 30;
  ctx.fillText('SOLARA BAY', VIEW.width / 2, 220);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-world crime story — nine jobs, one city, no way out but through.', VIEW.width / 2, 268);
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('WASD move / drive · E steal & exit car · Click shoot · Q radio · P pause', VIEW.width / 2, 330);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText('Press ENTER to start — 3 save slots', VIEW.width / 2, 372);
  // Save slots.
  for (let i = 0; i < 3; i++) {
    const slot = game.readSave(i);
    const sy = 410 + i * 44;
    ctx.fillStyle = 'rgba(10, 10, 18, 0.7)';
    roundRect(ctx, VIEW.width / 2 - 220, sy, 440, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#e8e8f0';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SLOT ${i + 1} — ${slot ? `Job ${slot.job}/9 · $${slot.money} · ${slot.respect} respect` : 'empty'}`, VIEW.width / 2 - 204, sy + 22);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9c9d4';
  ctx.font = '13px sans-serif';
  ctx.fillText('1 / 2 / 3 — load a slot · a city of its own: nothing from any commercial game', VIEW.width / 2, 560);
  ctx.fillStyle = '#7dd7ff';
  ctx.fillText('Missions · wanted system · police helicopter · garage tunes · 3 radio stations', VIEW.width / 2, 586);
  ctx.restore();
}

function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 8, 16, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 10);
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#c9c9d4';
  ctx.fillText('P resume · R restart the job · M music', VIEW.width / 2, VIEW.height / 2 + 30);
  ctx.restore();
}

function drawBusted(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 8, 16, 0.8)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ff2e4d';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff2e4d';
  ctx.shadowBlur = 26;
  ctx.fillText('BUSTED', VIEW.width / 2, VIEW.height / 2 - 20);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText(`The SBPD caught Mara after ${game.mission.index} jobs. The city keeps its secrets.`, VIEW.width / 2, VIEW.height / 2 + 24);
  ctx.fillStyle = '#ffd23c';
  ctx.fillText('Press ENTER — back to the title', VIEW.width / 2, VIEW.height / 2 + 62);
  ctx.restore();
}

// --- main render entry -----------------------------------------------------

export function render(ctx, game, time) {
  const cam = game.camera;
  ctx.save();
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (game.screen === 'title') {
    drawTitle(ctx, game);
    ctx.restore();
    return;
  }
  // Camera follows the player, clamped to the world.
  cam.x = Math.max(0, Math.min(WORLD.width - VIEW.width, game.player.x - VIEW.width / 2));
  cam.y = Math.max(0, Math.min(WORLD.height - VIEW.height, game.player.y - VIEW.height / 2));
  ctx.translate(-cam.x, -cam.y);
  drawGround(ctx, game.city, cam);
  drawBuildings(ctx, game.city, time);
  drawWrecks(ctx, game.city, time);
  // Mission marker beacon — big and pulsing so it reads at a glance.
  if (game.mission.target && game.screen === 'playing') {
    const t = game.mission.target;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.3 * Math.sin(time * 4);
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Roadblocks.
  for (const rb of game.roadblocks) drawRoadblock(ctx, rb);
  // Traffic and parked cars.
  for (const car of game.traffic) drawCarShape(ctx, car, false);
  // Peds.
  for (const ped of game.peds) {
    if (!ped.dead) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.walkPhase);
  }
  // Escort van.
  if (game.mission.van) drawCarShape(ctx, game.mission.van, false);
  // Cops.
  for (const cop of game.cops) {
    drawCarShape(ctx, cop, false);
    drawCopLights(ctx, cop, time);
  }
  // Player (on foot or driving).
  const p = game.player;
  if (p.inCar) {
    drawCarShape(ctx, p.inCar, true);
  } else {
    // A white ring marks the protagonist so she reads at a glance.
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawPerson(ctx, p.x, p.y, p.angle, '#e05a4e', '#e8b98a', p.walkPhase ?? time * 8, 1.15);
    // Aim line + muzzle flash.
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.aimX, p.aimY);
    ctx.stroke();
    ctx.restore();
  }
  // Heli above everything.
  if (game.heli) drawHeli(ctx, game.heli, time);
  drawParticles(ctx, game.particles);
  ctx.restore();
  // Screen-space HUD.
  drawHud(ctx, game);
  drawMinimap(ctx, game);
  if (game.screen === 'paused') drawPaused(ctx);
  if (game.screen === 'busted') drawBusted(ctx, game);
}
