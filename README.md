# Solara Bay — an open-world crime story (gta6-01)

A complete open-world crime game that plays offline in a desktop browser
from static files. You are Mara Solis, a driver-for-hire in Solara Bay, a
sun-soaked dusk city of five districts. Nine jobs take you from a first set
of stolen wheels to the Crown of Solara — with the SBPD, its roadblocks and
its Air One helicopter hunting you the whole way.

## What is in the game

- A living city: five districts, traffic, pedestrians, neon, palms, wrecks,
  a beach and a marina, all generated from a seed.
- On foot and by car: steal any car (E), drive it, tune it at the garage
  (G, $500 a tune, +15% top speed, max 3).
- Wanted system: 1–5 stars. Crimes raise your heat; hiding sheds it.
  Roadblocks at 3+ stars, the Air One helicopter with a searchlight at 4+.
- Nine story missions: steal-and-deliver, timed courier, getaway, dockside
  takedown, the big score, a four-checkpoint street race, a three-wave
  defence, an escort, and a five-star finale.
- Combat on foot: click to shoot, Space to punch. Ammo is limited.
- HUD: money, health, ammo, wanted stars, respect rank, mission tracker,
  SBPD dispatch feed, minimap, radio station.
- Three generative radio stations (Q switches, M mutes), all synthesized
  with WebAudio — no audio files.
- Three save slots on the title screen (1/2/3 to load, F quick-saves).
- Start and pause screens, a busted screen, and a respect ladder from
  Nobody to Queen of Solara.

## Controls

- WASD / arrows — move or drive (Shift to run on foot)
- E — steal / exit a car
- Mouse — aim; click — shoot
- Space — punch
- Q — radio station, M — music on/off, G — garage tune, F — quick-save
- P — pause, R — restart the job, Enter — start / confirm

## Play it

```sh
node serve.ts          # game/ on http://localhost:8080
```

## Hand it in

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots live under `screenshots/` (4 staged shots, one per system).
The game is entirely original: its city, characters, vehicles, names,
story, art and music are its own, with nothing from any commercial game.

## License

MIT — see LICENSE.
