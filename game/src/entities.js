// Factories for everything that moves: the player, shots, enemies, shards,
// particles and floating score text. Nothing here knows about the screen;
// world.js decides how they move and collide, render.js decides how they look.
import { ENEMIES, PLAYER } from './config.js';

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, angle: -Math.PI / 2,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    level: 1, xp: 0, xpNext: 6,
    fireTimer: 0, invuln: 0, touchTimer: 0,
    fireRate: PLAYER.fireRate, damage: PLAYER.bulletDamage,
    projectiles: PLAYER.projectiles, pierce: PLAYER.pierce,
    speed: PLAYER.maxSpeed, magnet: PLAYER.magnet,
    upgrades: {}, // upgrade id -> stacks taken
  };
}

export function createBullet(x, y, angle, damage, pierce, friendly) {
  return {
    x, y, angle, damage, pierce, friendly,
    speed: friendly ? PLAYER.bulletSpeed : 240,
    radius: friendly ? PLAYER.bulletRadius : 7,
    life: friendly ? 1.1 : 6,
    hit: new Set(),
  };
}

export function createEnemy(type, x, y, random) {
  const spec = ENEMIES[type];
  const enemy = {
    type, x, y, radius: spec.radius, hp: spec.hp, maxHp: spec.hp,
    speed: spec.speed * (0.9 + random() * 0.2),
    damage: spec.damage, score: spec.score, xp: spec.xp,
    angle: 0, wobble: random() * Math.PI * 2, shootTimer: 1.5 + random(),
    touchTimer: 0, flash: 0, spawnTimer: 0,
  };
  if (type === 'boss') {
    enemy.hp = spec.hp;
    enemy.maxHp = spec.hp;
    enemy.burstTimer = 3;
    enemy.spawnTimer = 5;
    enemy.enraged = false;
  }
  return enemy;
}

export function createShard(x, y, value, random) {
  const angle = random() * Math.PI * 2;
  const speed = 40 + random() * 60;
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, value, life: 25 };
}

export function createParticle(x, y, color, count, random, speed = 220) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const v = speed * (0.3 + random() * 0.7);
    parts.push({
      x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
      life: 0.35 + random() * 0.4, maxLife: 0.75, color, size: 2 + random() * 3,
    });
  }
  return parts;
}

export function createFloater(x, y, text, color) {
  return { x, y, text, color, life: 0.8, maxLife: 0.8 };
}
