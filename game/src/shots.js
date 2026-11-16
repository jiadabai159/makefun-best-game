// The screenshot scenes behind ?shot=start|play|levelup|boss. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (kite away from the nearest enemy, chase the
// nearest shard, always fire at the nearest enemy), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 24;
const LEVELUP_LIMIT_SECONDS = 150;
const BOSS_LIMIT_SECONDS = 600;
const BOSS_HOLD_SECONDS = 6;
const SAMPLE = 1 / 60;

/** The autopilot's input for this frame: move, aim and fire. */
function autopilot(state) {
  const p = state.player;
  let nearestEnemy = null;
  let nearestDist = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
  }
  let nearestShard = null;
  let shardDist = Infinity;
  for (const s of state.shards) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < shardDist) { shardDist = d; nearestShard = s; }
  }
  let mx = 0;
  let my = 0;
  // Kite: run from anything close, drift toward shards when the coast is clear.
  if (nearestEnemy && nearestDist < 170) {
    mx = (p.x - nearestEnemy.x) / nearestDist;
    my = (p.y - nearestEnemy.y) / nearestDist;
  } else if (nearestShard && shardDist < 260) {
    mx = (nearestShard.x - p.x) / shardDist;
    my = (nearestShard.y - p.y) / shardDist;
  } else if (nearestEnemy) {
    // Hold a fighting distance: close in when far away.
    const want = 260;
    const dir = nearestDist > want + 60 ? 1 : 0;
    mx = ((nearestEnemy.x - p.x) / nearestDist) * dir;
    my = ((nearestEnemy.y - p.y) / nearestDist) * dir;
  }
  // Stay inside the field instead of hugging a wall.
  if (p.x < 80) mx += 0.8;
  if (p.x > FIELD.width - 80) mx -= 0.8;
  if (p.y < 80) my += 0.8;
  if (p.y > FIELD.height - 80) my -= 0.8;
  const len = Math.hypot(mx, my) || 1;
  const aim = nearestEnemy ?? { x: p.x + 100, y: p.y };
  return {
    x: mx / len, y: my / len,
    ax: aim.x, ay: aim.y,
    firing: true,
  };
}

/** Run the world forward with the autopilot until `stop(state)` is true. */
function playUntil(world, stop, limitSeconds) {
  for (let i = 0; i < limitSeconds / STEP; i += 1) {
    if (world.state.levelUp) world.chooseUpgrade(0);
    const events = world.step(STEP, autopilot(world.state), null);
    if (events & EVENT_OVER || events & EVENT_WIN || stop(world.state)) break;
  }
}

/**
 * Set `world` to the named scene (start, play, levelup or boss; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.startRun();
  if (name !== 'play' && name !== 'levelup' && name !== 'boss') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0, ax: world.state.player.x + 100, ay: world.state.player.y, firing: false }, null);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Stop mid-fight, not in the breather between waves: wait until the field
    // is busy as well as the clock having run.
    playUntil(
      world,
      (s) => s.time >= 12 && s.enemies.length >= 10 && s.waveState !== 'clear',
      PLAY_SECONDS + 25,
    );
    const over = world.state.over;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'levelup') {
    playUntil(world, (s) => s.levelUp !== null, LEVELUP_LIMIT_SECONDS);
    if (world.state.over) return { screen: SCREEN_OVER, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // boss: play until the wave 5 Dreadnought arrives, then hold the fight.
  playUntil(world, (s) => s.boss !== null, BOSS_LIMIT_SECONDS);
  if (world.state.boss) {
    for (let i = 0; i < BOSS_HOLD_SECONDS / STEP; i += 1) {
      if (world.state.levelUp) world.chooseUpgrade(0);
      const events = world.step(STEP, autopilot(world.state), null);
      if (events & EVENT_OVER) break;
    }
  }
  if (world.state.won) return { screen: SCREEN_WIN, best: world.state.score };
  if (world.state.over) return { screen: SCREEN_OVER, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
