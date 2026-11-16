// Everything the player sees: the starfield, the ship, every enemy, the HUD
// and the title / pause / level-up / game-over / victory screens. It reads the
// world's state and never changes it.
import { FIELD, PALETTE, FONT, ENEMIES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    stars.push({
      x: (i * 137.5) % FIELD.width,
      y: (i * 89.3) % FIELD.height,
      size: 0.6 + ((i * 7) % 10) / 10,
      twinkle: (i * 0.37) % 1,
    });
  }

  function fit() {
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const ox = (canvas.width - FIELD.width * scale) / 2;
    const oy = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
  }

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, '#0a0e24');
    g.addColorStop(0.6, '#070a18');
    g.addColorStop(1, '#12081f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); ctx.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); ctx.stroke();
    }
    for (const s of stars) {
      const a = 0.25 + 0.55 * Math.abs(Math.sin(time * 0.7 + s.twinkle * 6));
      ctx.globalAlpha = a;
      ctx.fillStyle = PALETTE.star;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawShip(p, time) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // Engine flame, flickering with time.
    const flame = 10 + Math.sin(time * 30) * 4;
    ctx.fillStyle = 'rgba(255, 159, 67, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-12, 7); ctx.lineTo(-12 - flame, 0); ctx.lineTo(-12, -7);
    ctx.closePath(); ctx.fill();
    // Hull: a swept arrow in neon cyan, brighter while invulnerable.
    ctx.globalAlpha = p.invuln > 0 && Math.floor(time * 12) % 2 === 0 ? 0.45 : 1;
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 14;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-12, 11); ctx.lineTo(-6, 0); ctx.lineTo(-12, -11);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath(); ctx.arc(2, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawEnemy(e, time) {
    const spec = ENEMIES[e.type];
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = spec.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : spec.color;
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 2;
    const r = e.radius;
    if (e.type === 'drone') {
      ctx.rotate(e.angle);
      ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.8, r * 0.8); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.8, -r * 0.8); ctx.closePath(); ctx.fill();
    } else if (e.type === 'dart') {
      ctx.rotate(e.angle + Math.PI / 4);
      ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    } else if (e.type === 'brute') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + time * 0.4;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2b0a12';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'spitter') {
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.fillStyle = '#efe9ff';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'splitter') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0f3d36';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    } else if (e.type === 'mite') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'boss') {
      ctx.rotate(time * 0.5);
      ctx.beginPath();
      const spikes = 10;
      for (let i = 0; i < spikes * 2; i += 1) {
        const a = (i / (spikes * 2)) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r * 0.72;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.rotate(-time * 0.5);
      ctx.fillStyle = '#2b0a12';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8fa3';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Health bar over anything that can take more than one hit.
    if (e.maxHp > 30 && e.hp < e.maxHp) {
      const w = r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - r - 12, w, 5);
      ctx.fillStyle = spec.color;
      ctx.fillRect(e.x - w / 2, e.y - r - 12, w * (e.hp / e.maxHp), 5);
    }
  }

  function drawHUD(state) {
    const p = state.player;
    ctx.save();
    // Top-left: hull bar and XP bar.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(18, 16, 250, 18);
    ctx.fillStyle = p.hp < p.maxHp * 0.3 ? PALETTE.hpLow : PALETTE.hp;
    ctx.fillRect(18, 16, 250 * (p.hp / p.maxHp), 18);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(18, 16, 250, 18);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`HULL ${Math.ceil(p.hp)} / ${p.maxHp}`, 26, 29);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(18, 40, 250, 8);
    ctx.fillStyle = PALETTE.xp;
    ctx.fillRect(18, 40, 250 * Math.min(1, p.xp / p.xpNext), 8);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`LEVEL ${p.level}`, 18, 62);
    // Top-centre: wave and score.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(`WAVE ${Math.max(1, state.wave)}`, FIELD.width / 2, 34);
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`SCORE ${state.score}`, FIELD.width / 2, 60);
    // Top-right: kills and time.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(`KILLS ${state.kills}`, FIELD.width - 18, 30);
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`${mins}:${String(secs).padStart(2, '0')}`, FIELD.width - 18, 50);
    // Boss bar.
    if (state.boss) {
      const b = state.boss;
      const w = 420;
      const x = (FIELD.width - w) / 2;
      const y = FIELD.height - 34;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = PALETTE.boss;
      ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 14);
      ctx.strokeStyle = PALETTE.boss;
      ctx.strokeRect(x, y, w, 14);
      ctx.fillStyle = '#ffb3c1';
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(b.enraged ? 'DREADNOUGHT — ENRAGED' : 'DREADNOUGHT', FIELD.width / 2, y - 6);
    }
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  function centred(text, y, font, color) {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.fillText(text, FIELD.width / 2, y);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(4, 6, 16, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    centred('NEON VOID', 210, `bold 84px ${FONT}`, '#4fe3ff');
    ctx.save();
    ctx.shadowColor = '#4fe3ff';
    ctx.shadowBlur = 24;
    centred('NEON VOID', 210, `bold 84px ${FONT}`, '#bff4ff');
    ctx.restore();
    centred('Survive the swarm. Level up. Slay the Dreadnought.', 258, `20px ${FONT}`, PALETTE.text);
    centred('WASD / arrows to fly  ·  Mouse to aim  ·  Hold click or Space to fire', 300, `16px ${FONT}`, PALETTE.muted);
    centred('P pause  ·  M mute  ·  R restart  ·  1 / 2 / 3 pick an upgrade', 328, `16px ${FONT}`, PALETTE.muted);
    centred('Defeat the wave 10 boss to win — then keep flying, endless.', 366, `16px ${FONT}`, PALETTE.muted);
    panel(FIELD.width / 2 - 170, 410, 340, 62);
    centred(best > 0 ? `BEST SCORE  ${best}` : 'NO FLIGHTS YET — BE THE FIRST', 448, `bold 18px ${FONT}`, PALETTE.gold);
    centred('PRESS SPACE OR CLICK TO LAUNCH', 520, `bold 20px ${FONT}`, '#4fe3ff');
  }

  function drawLevelUp(state) {
    const choices = state.levelUp.choices;
    ctx.fillStyle = 'rgba(4, 6, 16, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    centred(`LEVEL ${state.player.level} — CHOOSE AN UPGRADE`, 150, `bold 34px ${FONT}`, PALETTE.gold);
    centred('Click a card, or press 1, 2 or 3', 188, `16px ${FONT}`, PALETTE.muted);
    const w = 260;
    const h = 170;
    const gap = 30;
    const total = choices.length * w + (choices.length - 1) * gap;
    let x = (FIELD.width - total) / 2;
    const y = 240;
    choices.forEach((c, i) => {
      panel(x, y, w, h);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`[ ${i + 1} ]`, x + w / 2, y + 34);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText(c.name, x + w / 2, y + 72);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `15px ${FONT}`;
      ctx.fillText(c.desc, x + w / 2, y + 104);
      const stacks = state.player.upgrades[c.id] ?? 0;
      ctx.fillText(`owned: ${stacks} / ${c.max}`, x + w / 2, y + 136);
      x += w + gap;
    });
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4, 6, 16, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    centred('PAUSED', 300, `bold 56px ${FONT}`, PALETTE.text);
    centred('Press P or Space to resume  ·  R to restart', 350, `18px ${FONT}`, PALETTE.muted);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(20, 4, 10, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    centred('SHIP DESTROYED', 240, `bold 58px ${FONT}`, '#ff5d73');
    centred(`You reached wave ${state.wave}  ·  ${state.kills} kills  ·  ${Math.floor(state.time)}s`, 300, `20px ${FONT}`, PALETTE.text);
    centred(`SCORE  ${state.score}`, 350, `bold 30px ${FONT}`, PALETTE.gold);
    centred(best > state.score ? `BEST  ${best}` : 'NEW BEST!', 392, `bold 20px ${FONT}`, PALETTE.gold);
    centred('PRESS SPACE OR CLICK TO FLY AGAIN', 460, `bold 18px ${FONT}`, '#4fe3ff');
  }

  function drawWin(state, best) {
    ctx.fillStyle = 'rgba(4, 16, 10, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    centred('DREADNOUGHT DESTROYED', 220, `bold 52px ${FONT}`, '#2ee6a8');
    centred('Campaign complete — the Void is yours. Endless flight continues.', 272, `20px ${FONT}`, PALETTE.text);
    centred(`SCORE  ${state.score}   ·   WAVE ${state.wave}   ·   ${state.kills} KILLS`, 322, `bold 24px ${FONT}`, PALETTE.gold);
    centred(`BEST  ${Math.max(best, state.score)}`, 362, `bold 18px ${FONT}`, PALETTE.muted);
    centred('PRESS SPACE OR CLICK TO KEEP FLYING', 430, `bold 18px ${FONT}`, '#4fe3ff');
  }

  return {
    /** Paint one frame. `screen` is one of the SCREEN_* constants. */
    draw(state, screen, best) {
      const time = state.time;
      // Back the canvas with real pixels: without this the browser stretches
      // the default 300x150 surface and every line of text goes blurry.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      fit();
      const shake = state.shake > 0 ? state.shake * 8 : 0;
      const sx = shake > 0 ? (Math.sin(time * 91) * shake) : 0;
      const sy = shake > 0 ? (Math.cos(time * 113) * shake) : 0;
      ctx.save();
      ctx.translate(sx, sy);
      drawBackground(time);
      // Shards, enemies, bullets, player, particles, floaters.
      for (const s of state.shards) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(time * 3 + s.x);
        ctx.fillStyle = PALETTE.shard;
        ctx.shadowColor = PALETTE.shard;
        ctx.shadowBlur = 8;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      }
      for (const e of state.enemies) drawEnemy(e, time);
      for (const b of state.ebullets) {
        ctx.fillStyle = '#ff5d73';
        ctx.shadowColor = '#ff5d73';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      for (const b of state.bullets) {
        ctx.strokeStyle = PALETTE.bullet;
        ctx.lineWidth = 3;
        ctx.shadowColor = PALETTE.bullet;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      if (!state.over) drawShip(state.player, time);
      for (const pt of state.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      for (const f of state.floaters) {
        ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
        ctx.fillStyle = f.color;
        ctx.font = `bold 14px ${FONT}`;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // Screens and HUD sit above the shake.
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(state);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_WIN) drawWin(state, best);
      if (state.levelUp && screen === SCREEN_PLAY) drawLevelUp(state);
      // Low-hull warning vignette.
      const p = state.player;
      if (!state.over && p.hp > 0 && p.hp < p.maxHp * 0.3 && screen === SCREEN_PLAY) {
        const pulse = 0.12 + 0.08 * Math.sin(time * 6);
        const g = ctx.createRadialGradient(
          FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
          FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
        );
        g.addColorStop(0, 'rgba(255, 46, 99, 0)');
        g.addColorStop(1, `rgba(255, 46, 99, ${pulse})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
    },
  };
}
