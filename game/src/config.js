// NEON VOID — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  accel: 2600,
  maxSpeed: 340,
  drag: 4.2,
  maxHp: 100,
  fireRate: 4.2, // shots per second
  bulletSpeed: 760,
  bulletDamage: 12,
  bulletRadius: 5,
  pierce: 0,
  projectiles: 1,
  spread: 0.09, // radians between projectiles in a volley
  magnet: 95,
  invuln: 1.0, // seconds of protection after a hit
  touchDamageCooldown: 0.6,
};

/** Enemy types: shape, speed, health, damage, score and xp they are worth. */
export const ENEMIES = {
  drone: { radius: 13, hp: 24, speed: 135, damage: 8, score: 10, xp: 1, color: '#ff5d73' },
  dart: { radius: 10, hp: 12, speed: 215, damage: 6, score: 15, xp: 1, color: '#ff9f43' },
  brute: { radius: 24, hp: 90, speed: 70, damage: 16, score: 30, xp: 3, color: '#e8415a' },
  spitter: { radius: 14, hp: 26, speed: 90, damage: 8, score: 25, xp: 2, color: '#a55eea' },
  splitter: { radius: 16, hp: 30, speed: 100, damage: 10, score: 20, xp: 2, color: '#2bcbba' },
  mite: { radius: 8, hp: 8, speed: 185, damage: 5, score: 5, xp: 1, color: '#7bed9f' },
  boss: { radius: 48, hp: 950, speed: 46, damage: 25, score: 500, xp: 25, color: '#ff2e63' },
};

/** A wave's roster: how many of each type spawn, before the boss on boss waves. */
export function waveRoster(wave) {
  const roster = [];
  const add = (type, n) => { for (let i = 0; i < n; i += 1) roster.push(type); };
  add('drone', 8 + wave * 3);
  if (wave >= 2) add('dart', 3 + wave * 2);
  if (wave >= 3) add('brute', 2 + Math.floor(wave / 2));
  if (wave >= 3) add('spitter', 2 + Math.floor(wave / 2));
  if (wave >= 4) add('splitter', 2 + Math.floor(wave / 2));
  // Shuffle with the world's own random; the caller shuffles the roster.
  return roster;
}

/** Seconds between spawns; waves get denser as they go on. */
export function spawnInterval(wave) {
  return Math.max(0.2, 0.6 - wave * 0.04);
}

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level) {
  return 6 + (level - 1) * 5;
}

/** The upgrade pool a level-up draws three distinct cards from. */
export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Cycler', desc: '+18% fire rate', max: 5, apply: (u) => { u.fireRate *= 1.18; } },
  { id: 'heavy', name: 'Heavy Rounds', desc: '+25% bullet damage', max: 5, apply: (u) => { u.damage *= 1.25; } },
  { id: 'split', name: 'Split Shot', desc: '+1 projectile per volley', max: 3, apply: (u) => { u.projectiles += 1; } },
  { id: 'swift', name: 'Swift Thrusters', desc: '+12% move speed', max: 4, apply: (u) => { u.speed *= 1.12; } },
  { id: 'hull', name: 'Hull Plating', desc: '+30 max hull, repair 30', max: 4, apply: (u) => { u.maxHp += 30; u.heal = 30; } },
  { id: 'magnet', name: 'Magnet Coil', desc: '+45% shard pickup radius', max: 3, apply: (u) => { u.magnet *= 1.45; } },
  { id: 'pierce', name: 'Piercing Rounds', desc: 'Bullets pierce +1 enemy', max: 3, apply: (u) => { u.pierce += 1; } },
  { id: 'overdrive', name: 'Overdrive', desc: '+8% fire rate, +6% speed', max: 3, apply: (u) => { u.fireRate *= 1.08; u.speed *= 1.06; } },
];

export const PALETTE = {
  backdrop: '#070a18',
  grid: 'rgba(90, 120, 255, 0.07)',
  star: '#aebaff',
  player: '#4fe3ff',
  playerCore: '#e8fbff',
  bullet: '#ffe66d',
  shard: '#2ee6a8',
  text: '#eef1f5',
  muted: '#8b93a3',
  panel: 'rgba(16, 22, 44, 0.92)',
  panelEdge: '#2e3d6b',
  hp: '#2ee6a8',
  hpLow: '#ff5d73',
  xp: '#a55eea',
  boss: '#ff2e63',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-void.best';
