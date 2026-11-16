// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, game over and victory. A level-up opens a card overlay over
// play and the world waits for a pick.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|levelup|boss (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createSound } from './audio.js';
import { createWorld, EVENT_HIT, EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_LEVEL, EVENT_BOSS, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const sound = createSound();
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    sound.unlock();
    sound.startMusic();
    world.startRun();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Survive the swarm.');
  }

  function endGame(won) {
    if (won) {
      screen = SCREEN_WIN;
      sound.victory();
      announce(`Victory! Score ${world.state.score}.`);
    } else {
      screen = SCREEN_OVER;
      sound.stopMusic();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function handleEvents(events) {
    if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_BOSS) announce('Warning: Dreadnought approaching.');
    else if (events & EVENT_WAVE_CLEAR) announce(`Wave ${world.state.wave} cleared.`);
    else if (events & EVENT_LEVEL) announce(`Level ${world.state.player.level}. Choose an upgrade.`);
    else if (events & EVENT_HIT) announce(`Hull ${Math.ceil(world.state.player.hp)}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      sound.unlock();
      const muted = sound.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      sound.click();
      startGame();
      return;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        sound.click();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }

  function pickUpgrade() {
    if (!world.state.levelUp) return;
    const byKey = input.numberChoice();
    if (byKey >= 1 && byKey <= world.state.levelUp.choices.length) {
      sound.click();
      world.chooseUpgrade(byKey - 1);
      return;
    }
    // A click on a card: cards are laid out by the renderer, three across.
    // Only a real click picks one; hovering over a card does nothing.
    const m = input.takeClick();
    if (m) {
      const choices = world.state.levelUp.choices;
      const w = 260;
      const h = 170;
      const gap = 30;
      const total = choices.length * w + (choices.length - 1) * gap;
      let x = (1280 - total) / 2;
      const y = 240;
      for (let i = 0; i < choices.length; i += 1) {
        if (m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h) {
          sound.click();
          world.chooseUpgrade(i);
          return;
        }
        x += w + gap;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // The title drifts: the world idles so the starfield shimmers.
      world.step(STEP, { x: 0, y: 0, ax: world.state.player.x + 100, ay: world.state.player.y, firing: false }, null);
      renderer.draw(world.state, screen, best);
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (world.state.levelUp) {
        pickUpgrade();
        renderer.draw(world.state, screen, best);
        return;
      }
      while (accumulator >= STEP) {
        const aim = input.aim();
        const dir = input.direction();
        const events = world.step(STEP, { x: dir.x, y: dir.y, ax: aim.x, ay: aim.y, firing: input.firing() }, sound);
        handleEvents(events);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
      renderer.draw(world.state, screen, best);
      return;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the swarm in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Void. Press Space or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
