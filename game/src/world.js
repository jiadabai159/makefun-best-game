// The simulation: waves, movement, shooting, collisions, shards, levels and
// bosses. It knows nothing about the screen or the keyboard; step() takes the
// player's input for this frame and an optional sound object (null in the
// screenshot scenes, which run silently). Events are a bitmask so the caller
// can react once per frame.
import { FIELD, STEP, PLAYER, ENEMIES, UPGRADES, waveRoster, spawnInterval, xpForLevel } from './config.js';
import { createPlayer, createBullet, createEnemy, createShard, createParticle, createFloater } from './entities.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_LEVEL = 8;
export const EVENT_BOSS = 16;
export const EVENT_WIN = 32;

const BOSS_WAVES = [5, 10];

export function createWorld(random) {
  const state = {
    time: 0, score: 0, kills: 0, shotsFired: 0,
    wave: 0, waveState: 'idle', // idle | spawning | fighting | clear
    spawnQueue: [], spawnTimer: 0, clearTimer: 0,
    player: createPlayer(FIELD.width / 2, FIELD.height / 2),
    enemies: [], bullets: [], ebullets: [], shards: [],
    particles: [], floaters: [],
    levelUp: null, boss: null, won: false, over: false,
    shake: 0,
  };

  function burst(x, y, color, count, speed) {
    state.particles.push(...createParticle(x, y, color, count, random, speed));
  }

  function dropShards(enemy) {
    for (let i = 0; i < enemy.xp; i += 1) {
      state.shards.push(createShard(enemy.x, enemy.y, 1, random));
    }
  }

  function killEnemy(index, awardScore) {
    const enemy = state.enemies[index];
    state.enemies.splice(index, 1);
    state.kills += 1;
    if (awardScore) state.score += enemy.score;
    state.floaters.push(createFloater(enemy.x, enemy.y, `+${enemy.score}`, '#f2c94c'));
    const color = ENEMIES[enemy.type].color;
    burst(enemy.x, enemy.y, color, enemy.type === 'boss' ? 60 : 16, enemy.type === 'boss' ? 420 : 260);
    dropShards(enemy);
    if (enemy.type === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        state.enemies.push(createEnemy('mite', enemy.x + (i === 0 ? -14 : 14), enemy.y, random));
      }
    }
    if (enemy.type === 'boss') {
      state.boss = null;
      state.shake = 0.6;
      if (state.wave === 10) {
        state.won = true;
        return EVENT_WIN;
      }
    }
    return 0;
  }

  function rollLevelChoices() {
    const available = UPGRADES.filter((u) => (state.player.upgrades[u.id] ?? 0) < u.max);
    const pool = [...available];
    const choices = [];
    while (choices.length < 3 && pool.length > 0) {
      const pick = Math.floor(random() * pool.length);
      choices.push(pool.splice(pick, 1)[0]);
    }
    return choices;
  }

  function applyUpgrade(upgrade) {
    const p = state.player;
    p.upgrades[upgrade.id] = (p.upgrades[upgrade.id] ?? 0) + 1;
    const u = {
      fireRate: p.fireRate, damage: p.damage, projectiles: p.projectiles,
      speed: p.speed, maxHp: p.maxHp, magnet: p.magnet, pierce: p.pierce, heal: 0,
    };
    upgrade.apply(u);
    p.fireRate = u.fireRate; p.damage = u.damage; p.projectiles = u.projectiles;
    p.speed = u.speed; p.magnet = u.magnet; p.pierce = u.pierce;
    if (u.heal) {
      p.maxHp = u.maxHp;
      p.hp = Math.min(p.maxHp, p.hp + u.heal);
    } else {
      p.maxHp = u.maxHp;
    }
  }

  function startWave(n) {
    state.wave = n;
    state.spawnQueue = waveRoster(n);
    // Shuffle the roster with the world's own random.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
    }
    if (BOSS_WAVES.includes(n)) {
      state.spawnQueue.push('boss');
    }
    state.spawnTimer = 0.5;
    state.waveState = 'spawning';
  }

  function spawnOne(type) {
    // Enemies arrive from a random edge, outside the player's view of the field.
    const edge = Math.floor(random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = -30; y = random() * FIELD.height; }
    if (edge === 1) { x = FIELD.width + 30; y = random() * FIELD.height; }
    if (edge === 2) { y = -30; x = random() * FIELD.width; }
    if (edge === 3) { y = FIELD.height + 30; x = random() * FIELD.width; }
    const enemy = createEnemy(type, x, y, random);
    if (type === 'boss') {
      enemy.hp = ENEMIES.boss.hp * (state.wave === 10 ? 1.7 : 1);
      enemy.maxHp = enemy.hp;
      state.boss = enemy;
    }
    state.enemies.push(enemy);
    return enemy;
  }

  function hurtPlayer(damage, sfx) {
    const p = state.player;
    if (p.invuln > 0 || state.over || state.won) return 0;
    p.hp -= damage;
    p.invuln = PLAYER.invuln;
    state.shake = Math.max(state.shake, 0.35);
    burst(p.x, p.y, '#ff5d73', 14, 300);
    sfx?.hurt();
    if (p.hp <= 0) {
      p.hp = 0;
      state.over = true;
      burst(p.x, p.y, '#4fe3ff', 50, 420);
      burst(p.x, p.y, '#ffffff', 30, 300);
      sfx?.explode();
      return EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function stepEnemy(enemy, dt, sfx) {
    const p = state.player;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.touchTimer = Math.max(0, enemy.touchTimer - dt);
    let mx = 0;
    let my = 0;
    if (enemy.type === 'spitter') {
      // Keep a shooting distance: close in when far, back off when near.
      const want = 260;
      const dir = dist > want + 40 ? 1 : dist < want - 40 ? -1 : 0;
      mx = (dx / dist) * dir;
      my = (dy / dist) * dir;
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && dist < 520) {
        enemy.shootTimer = 2.3;
        const angle = Math.atan2(dy, dx);
        state.ebullets.push(createBullet(enemy.x, enemy.y, angle, enemy.damage, 0, false));
      }
    } else if (enemy.type === 'dart') {
      enemy.wobble += dt * 6;
      const wob = Math.sin(enemy.wobble) * 0.5;
      const nx = dx / dist;
      const ny = dy / dist;
      mx = nx - ny * wob;
      my = ny + nx * wob;
    } else if (enemy.type === 'boss') {
      mx = dx / dist;
      my = dy / dist;
      enemy.burstTimer -= dt;
      if (enemy.burstTimer <= 0) {
        enemy.burstTimer = enemy.enraged ? 2.2 : 3.4;
        const count = enemy.enraged ? 16 : 12;
        for (let i = 0; i < count; i += 1) {
          const angle = (i / count) * Math.PI * 2 + enemy.wobble;
          state.ebullets.push(createBullet(enemy.x, enemy.y, angle, 10, 0, false));
        }
        sfx?.bossAlarm();
      }
      enemy.spawnTimer -= dt;
      if (enemy.spawnTimer <= 0) {
        enemy.spawnTimer = 6;
        for (let i = 0; i < 3; i += 1) state.enemies.push(createEnemy('drone', enemy.x, enemy.y, random));
      }
      if (!enemy.enraged && enemy.hp < enemy.maxHp * 0.3) {
        enemy.enraged = true;
        enemy.speed *= 1.5;
      }
    } else {
      mx = dx / dist;
      my = dy / dist;
    }
    const speed = enemy.speed;
    enemy.x += mx * speed * dt;
    enemy.y += my * speed * dt;
    enemy.angle = Math.atan2(dy, dx);
    // Touch damage, throttled per enemy.
    if (dist < enemy.radius + PLAYER.radius && enemy.touchTimer <= 0) {
      enemy.touchTimer = PLAYER.touchDamageCooldown;
      return hurtPlayer(enemy.damage, sfx);
    }
    return 0;
  }

  function stepBullets(dt, sfx) {
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -40 || b.x > FIELD.width + 40 || b.y < -40 || b.y > FIELD.height + 40;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const e = state.enemies[j];
          if (b.hit.has(e)) continue;
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          if (dx * dx + dy * dy < (e.radius + b.radius) * (e.radius + b.radius)) {
            b.hit.add(e);
            e.hp -= b.damage;
            e.flash = 0.12;
            // Knockback, heavier for light enemies.
            const kb = e.type === 'brute' || e.type === 'boss' ? 14 : 46;
            e.x += Math.cos(b.angle) * kb;
            e.y += Math.sin(b.angle) * kb;
            state.floaters.push(createFloater(b.x, b.y - 8, String(Math.round(b.damage)), '#ffffff'));
            burst(b.x, b.y, '#ffe66d', 3, 140);
            sfx?.hit();
            if (e.hp <= 0) events |= killEnemy(j, true);
            if (b.hit.size > b.pierce) { dead = true; break; }
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      const p = state.player;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (b.life <= 0 || b.x < -40 || b.x > FIELD.width + 40 || b.y < -40 || b.y > FIELD.height + 40) {
        state.ebullets.splice(i, 1);
      } else if (dx * dx + dy * dy < (PLAYER.radius + b.radius) * (PLAYER.radius + b.radius)) {
        state.ebullets.splice(i, 1);
        events |= hurtPlayer(b.damage, sfx);
      }
    }
    return events;
  }

  function stepShards(dt, sfx) {
    const p = state.player;
    for (let i = state.shards.length - 1; i >= 0; i -= 1) {
      const s = state.shards[i];
      s.life -= dt;
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < p.magnet) {
        const pull = 640;
        s.vx += (dx / dist) * pull * dt;
        s.vy += (dy / dist) * pull * dt;
      } else {
        s.vx *= 0.98;
        s.vy *= 0.98;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (dist < PLAYER.radius + 10) {
        state.shards.splice(i, 1);
        p.xp += s.value;
        sfx?.pickup();
        if (p.xp >= p.xpNext) {
          p.xp -= p.xpNext;
          p.level += 1;
          p.xpNext = xpForLevel(p.level);
          state.levelUp = { choices: rollLevelChoices() };
          sfx?.levelup();
          return EVENT_LEVEL;
        }
      } else if (s.life <= 0) {
        state.shards.splice(i, 1);
      }
    }
    return 0;
  }

  return {
    state,
    reset() {
      state.time = 0; state.score = 0; state.kills = 0; state.shotsFired = 0;
      state.wave = 0; state.waveState = 'idle'; state.spawnQueue = [];
      state.spawnTimer = 0; state.clearTimer = 0;
      state.player = createPlayer(FIELD.width / 2, FIELD.height / 2);
      state.enemies = []; state.bullets = []; state.ebullets = []; state.shards = [];
      state.particles = []; state.floaters = [];
      state.levelUp = null; state.boss = null; state.won = false; state.over = false;
      state.shake = 0;
    },
    startRun() {
      this.reset();
      startWave(1);
    },
    chooseUpgrade(index) {
      if (!state.levelUp) return false;
      const choice = state.levelUp.choices[index];
      if (!choice) return false;
      applyUpgrade(choice);
      state.levelUp = null;
      return true;
    },
    step(dt, input, sfx) {
      if (state.over || state.won || state.levelUp) return 0;
      let events = 0;
      state.time += dt;
      const p = state.player;
      p.invuln = Math.max(0, p.invuln - dt);
      p.touchTimer = Math.max(0, p.touchTimer - dt);
      state.shake = Math.max(0, state.shake - dt * 1.4);

      // Movement: accelerate toward the input, drag when idle.
      p.vx += input.x * PLAYER.accel * dt;
      p.vy += input.y * PLAYER.accel * dt;
      const drag = Math.exp(-PLAYER.drag * dt);
      if (input.x === 0) p.vx *= drag;
      if (input.y === 0) p.vy *= drag;
      const speed = Math.hypot(p.vx, p.vy);
      const max = p.speed;
      if (speed > max) { p.vx = (p.vx / speed) * max; p.vy = (p.vy / speed) * max; }
      p.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, p.x + p.vx * dt));
      p.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, p.y + p.vy * dt));
      p.angle = Math.atan2(input.ay - p.y, input.ax - p.x);

      // Firing: a volley of projectiles toward the aim point.
      p.fireTimer -= dt;
      if (input.firing && p.fireTimer <= 0) {
        p.fireTimer = 1 / p.fireRate;
        const n = p.projectiles;
        for (let i = 0; i < n; i += 1) {
          const off = (i - (n - 1) / 2) * PLAYER.spread;
          const angle = p.angle + off;
          state.bullets.push(createBullet(
            p.x + Math.cos(angle) * (PLAYER.radius + 8),
            p.y + Math.sin(angle) * (PLAYER.radius + 8),
            angle, p.damage, p.pierce, true,
          ));
        }
        state.shotsFired += 1;
        sfx?.shoot();
      }

      // Waves: feed the queue, then wait for the field to clear.
      if (state.waveState === 'spawning') {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = spawnInterval(state.wave);
          // Later waves arrive in pairs, so the field gets properly busy.
          const burst = state.wave >= 3 && random() < 0.4 ? 2 : 1;
          for (let n = 0; n < burst; n += 1) {
            const type = state.spawnQueue.shift();
            if (!type) break;
            spawnOne(type);
            if (type === 'boss') { events |= EVENT_BOSS; sfx?.bossAlarm(); }
          }
          if (state.spawnQueue.length === 0) state.waveState = 'fighting';
        }
      } else if (state.waveState === 'fighting' && state.enemies.length === 0) {
        state.waveState = 'clear';
        state.clearTimer = 2.5;
        state.score += 50 + state.wave * 25;
        events |= EVENT_WAVE_CLEAR;
      } else if (state.waveState === 'clear') {
        state.clearTimer -= dt;
        if (state.clearTimer <= 0) startWave(state.wave + 1);
      }

      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        events |= stepEnemy(state.enemies[i], dt, sfx);
        if (state.over) break;
      }
      if (!state.over) events |= stepBullets(dt, sfx);
      if (!state.over) events |= stepShards(dt, sfx);

      // Particles and floating text fade on their own clock.
      for (let i = state.particles.length - 1; i >= 0; i -= 1) {
        const pt = state.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.985;
        pt.vy *= 0.985;
        if (pt.life <= 0) state.particles.splice(i, 1);
      }
      for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
        const f = state.floaters[i];
        f.life -= dt;
        f.y -= 34 * dt;
        if (f.life <= 0) state.floaters.splice(i, 1);
      }
      if (state.won) events |= EVENT_WIN;
      return events;
    },
  };
}

// Re-exported for tests and the screenshot autopilot.
export { STEP };
