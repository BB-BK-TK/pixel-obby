"use strict";

/* =================================================================
   OBBYVERSE — endless procedurally-generated obbies
   ================================================================= */

/* ---------------- SAVE DATA ---------------- */
const SAVE_KEY = "obbyverse-save-v1";

const defaultSave = () => ({
  xp: 0,
  level: 1,            // current obby (highest reached)
  deaths: 0,
  owned: ["normal"],
  equipped: "normal",
});

let save = defaultSave();
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) save = Object.assign(defaultSave(), JSON.parse(raw));
} catch (e) { /* corrupted save -> fresh start */ }

function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

/* ---------------- SKINS ---------------- */
const SKINS = [
  { id: "normal",  name: "Normal Pixel", cost: 0,    style: { fill: "#e8e8e8" } },
  { id: "red",     name: "Red Pixel",    cost: 100,  style: { fill: "#ef5350" } },
  { id: "blue",    name: "Blue Pixel",   cost: 100,  style: { fill: "#42a5f5" } },
  { id: "green",   name: "Green Pixel",  cost: 100,  style: { fill: "#66bb6a" } },
  { id: "sunset",  name: "Sunset",       cost: 250,  style: { grad: ["#ff9966", "#ff5e62"] } },
  { id: "ocean",   name: "Ocean",        cost: 250,  style: { grad: ["#00c6ff", "#0072ff"] } },
  { id: "smiley",  name: "Smiley",       cost: 400,  style: { fill: "#ffd54f", face: "smile" } },
  { id: "ninja",   name: "Ninja",        cost: 500,  style: { fill: "#263238", face: "ninja" } },
  { id: "ghost",   name: "Ghost",        cost: 600,  style: { fill: "#cfd8ff", alpha: 0.55, face: "ghost" } },
  { id: "neon",    name: "Neon",         cost: 800,  style: { fill: "#00ffcc", glow: "#00ffcc" } },
  { id: "gold",    name: "Gold",         cost: 1000, style: { grad: ["#ffe259", "#ffa751"], glow: "#ffd54f" } },
  { id: "rainbow", name: "Rainbow",      cost: 1500, style: { rainbow: true } },
  { id: "galaxy",  name: "Galaxy",       cost: 2000, style: { grad: ["#41295a", "#2F0743"], stars: true, glow: "#b388ff" } },
];
const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

function drawSkin(ctx, skin, x, y, size, t) {
  const st = skin.style;
  ctx.save();
  ctx.globalAlpha = st.alpha ?? 1;
  if (st.glow) { ctx.shadowColor = st.glow; ctx.shadowBlur = size * 0.6; }

  if (st.rainbow) {
    ctx.fillStyle = `hsl(${(t * 90) % 360}, 95%, 60%)`;
  } else if (st.grad) {
    const g = ctx.createLinearGradient(x, y, x + size, y + size);
    g.addColorStop(0, st.grad[0]);
    g.addColorStop(1, st.grad[1]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = st.fill;
  }
  ctx.fillRect(x, y, size, size);
  ctx.shadowBlur = 0;

  // subtle pixel border
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.strokeRect(x, y, size, size);

  if (st.stars) {
    ctx.fillStyle = "#fff";
    const sr = mulberry32(99);
    for (let i = 0; i < 6; i++) {
      const sx = x + sr() * size, sy = y + sr() * size;
      const tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.7);
      ctx.globalAlpha = (st.alpha ?? 1) * tw;
      ctx.fillRect(sx, sy, size * 0.07, size * 0.07);
    }
    ctx.globalAlpha = st.alpha ?? 1;
  }

  // faces
  const e = size * 0.16; // eye size
  if (st.face === "smile") {
    ctx.fillStyle = "#3e2723";
    ctx.fillRect(x + size * 0.22, y + size * 0.28, e, e);
    ctx.fillRect(x + size * 0.62, y + size * 0.28, e, e);
    ctx.fillRect(x + size * 0.25, y + size * 0.65, size * 0.5, size * 0.1);
  } else if (st.face === "ninja") {
    ctx.fillStyle = "#b71c1c";
    ctx.fillRect(x, y + size * 0.26, size, size * 0.22);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + size * 0.2, y + size * 0.32, e, size * 0.1);
    ctx.fillRect(x + size * 0.64, y + size * 0.32, e, size * 0.1);
  } else if (st.face === "ghost") {
    ctx.fillStyle = "#1a237e";
    ctx.fillRect(x + size * 0.22, y + size * 0.3, e, e * 1.4);
    ctx.fillRect(x + size * 0.62, y + size * 0.3, e, e * 1.4);
    ctx.fillRect(x + size * 0.36, y + size * 0.68, e * 1.6, e);
  }
  ctx.restore();
}

/* ---------------- SEEDED RNG ---------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- LEVEL GENERATOR ----------------
   Every obby is generated from its number, so obby #582,113
   is always the same course — and always harder than #582,112. */
function generateLevel(n) {
  const rng = mulberry32(n * 747796405 + 2891336453);
  const rand = (a, b) => a + rng() * (b - a);

  // difficulty: grows fast early, keeps creeping up forever
  const d = Math.min(40, 6 * Math.sqrt(n)) + Math.min(20, n * 0.05);

  const segCount = Math.min(30, 8 + Math.floor(n * 0.6));
  const gapMin = 45 + Math.min(60, d * 1.6);
  const gapMax = Math.min(150, 75 + d * 1.9);
  const wMin = Math.max(44, 130 - d * 2.2);
  const wMax = Math.max(72, 190 - d * 2.6);
  const riseMax = Math.min(80, 25 + d * 1.4);
  const movingChance = Math.min(0.45, d * 0.012);
  const lavaChance = Math.min(0.35, d * 0.010);
  const moveSpeed = 0.8 + Math.min(2.2, d * 0.05);

  const platforms = [];
  const PH = 22; // platform thickness

  let x = 0;
  let y = 0;

  // start pad
  platforms.push({ x: -40, y, w: 200, h: PH, type: "start" });
  x = 160;

  let sinceCheckpoint = 0;

  for (let i = 0; i < segCount; i++) {
    let gap = rand(gapMin, gapMax);
    let dy = rand(-riseMax, 90);
    if (y + dy > 260) dy = -riseMax;     // keep the course in a vertical band
    if (y + dy < -260) dy = 60;
    if (dy < 0) gap = Math.min(gap, 150 - (-dy) * 0.7); // higher jumps = shorter gaps
    const w = rand(wMin, wMax);

    x += gap;
    y += dy;

    const roll = rng();
    sinceCheckpoint++;
    const isCheckpoint = sinceCheckpoint >= 6 && i < segCount - 1;

    if (isCheckpoint) {
      sinceCheckpoint = 0;
      const cw = Math.max(w, 90);
      platforms.push({ x, y, w: cw, h: PH, type: "checkpoint" });
      x += cw;
    } else if (roll < lavaChance) {
      // lava brick in the middle of the gap — clear it or burn
      const lw = rand(40, 70);
      platforms.push({ x: x - gap / 2 - lw / 2, y: y + rand(10, 50), w: lw, h: PH, type: "lava" });
      platforms.push({ x, y, w, h: PH, type: "solid" });
      x += w;
    } else if (roll < lavaChance + movingChance) {
      const axis = rng() < 0.6 ? "x" : "y";
      const range = axis === "x" ? rand(40, 80) : rand(30, 55);
      platforms.push({
        x, y, w: Math.max(w, 70), h: PH, type: "solid",
        move: { axis, range, speed: moveSpeed * rand(0.7, 1.3), phase: rng() * Math.PI * 2, baseX: x, baseY: y },
      });
      x += Math.max(w, 70) + (axis === "x" ? range : 0);
    } else {
      platforms.push({ x, y, w, h: PH, type: "solid" });
      x += w;
    }
  }

  // finish pad
  x += rand(gapMin, Math.min(gapMax, 120));
  platforms.push({ x, y, w: 170, h: PH, type: "finish" });

  let killY = 0;
  for (const p of platforms) killY = Math.max(killY, p.y);

  return { n, platforms, killY: killY + 420, endX: x + 170 };
}

/* ---------------- DOM / SCREENS ---------------- */
const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");

const screens = { menu: $("screen-menu"), market: $("screen-market"), game: $("screen-game") };
function showScreen(name) {
  for (const k in screens) screens[k].classList.toggle("active", k === name);
}

function refreshStatChips() {
  $("menu-xp").textContent = save.xp;
  $("menu-level").textContent = save.level;
  $("market-xp").textContent = save.xp;
  $("hud-xp").textContent = save.xp;
  $("hud-level").textContent = game.level ? game.level.n : save.level;
  $("hud-deaths").textContent = game.deaths;
}

/* ---------------- INPUT ---------------- */
const input = { left: false, right: false, jump: false, jumpBuffered: 0 };

addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { input.jump = true; input.jumpBuffered = 8; }
  if (e.code === "Escape" && game.state === "playing") pauseGame();
});
addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") input.jump = false;
});

function bindHoldButton(el, prop) {
  const down = (e) => {
    e.preventDefault();
    el.classList.add("pressed");
    input[prop] = true;
    if (prop === "jump") input.jumpBuffered = 8;
  };
  const up = (e) => {
    e.preventDefault();
    el.classList.remove("pressed");
    input[prop] = false;
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerleave", up);
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}
bindHoldButton($("btn-left"), "left");
bindHoldButton($("btn-right"), "right");
bindHoldButton($("btn-jump"), "jump");

/* ---------------- GAME STATE ---------------- */
const PLAYER_SIZE = 28;
const GRAV = 0.7;
const JUMP_V = -14.2;
const MOVE_ACC = 0.9;
const MAX_SPD = 4.6;

const game = {
  state: "menu",       // menu | market | playing | paused | win
  level: null,
  deaths: 0,
  time: 0,
  player: null,
  camX: 0, camY: 0,
  particles: [],
};

function makePlayer(spawn) {
  return {
    x: spawn.x, y: spawn.y,
    vx: 0, vy: 0,
    grounded: false,
    coyote: 0,
    standingOn: null,
    spawnX: spawn.x, spawnY: spawn.y,
  };
}

function startLevel(n) {
  game.level = generateLevel(n);
  const start = game.level.platforms[0];
  game.player = makePlayer({ x: start.x + 60, y: start.y - PLAYER_SIZE - 1 });
  game.deaths = 0;
  game.time = 0;
  game.particles = [];
  game.state = "playing";
  $("overlay-pause").classList.remove("active");
  $("overlay-win").classList.remove("active");
  game.camX = game.player.x;
  game.camY = game.player.y;
  refreshStatChips();
  showScreen("game");
}

function pauseGame() {
  game.state = "paused";
  $("overlay-pause").classList.add("active");
}
function resumeGame() {
  game.state = "playing";
  $("overlay-pause").classList.remove("active");
}

function die() {
  const p = game.player;
  spawnBurst(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, "#ff5252", 22);
  game.deaths++;
  save.deaths++;
  persist();
  p.x = p.spawnX; p.y = p.spawnY;
  p.vx = 0; p.vy = 0;
  refreshStatChips();
}

function winLevel() {
  game.state = "win";
  save.xp += 100;
  save.level = Math.max(save.level, game.level.n + 1);
  persist();
  $("win-level").textContent = game.level.n;
  $("win-stats").textContent = `Deaths: ${game.deaths} · Time: ${game.time.toFixed(1)}s · Next obby is harder!`;
  $("overlay-win").classList.add("active");
  spawnBurst(game.player.x + PLAYER_SIZE / 2, game.player.y, "#ffd54f", 40);
  refreshStatChips();
}

/* ---------------- PARTICLES ---------------- */
function spawnBurst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 5;
    game.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
      life: 1, color,
      size: 3 + Math.random() * 4,
    });
  }
}

function updateParticles() {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const pt = game.particles[i];
    pt.x += pt.vx; pt.y += pt.vy;
    pt.vy += 0.25;
    pt.life -= 0.025;
    if (pt.life <= 0) game.particles.splice(i, 1);
  }
}

/* ---------------- PHYSICS ---------------- */
function platformRect(p) {
  if (!p.move) return p;
  const t = game.time * p.move.speed;
  const off = Math.sin(t + p.move.phase) * p.move.range;
  return {
    ...p,
    x: p.move.axis === "x" ? p.move.baseX + off : p.move.baseX,
    y: p.move.axis === "y" ? p.move.baseY + off : p.move.baseY,
  };
}

function overlaps(ax, ay, aw, ah, b) {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

function stepPhysics() {
  const p = game.player;
  const lvl = game.level;
  game.time += 1 / 60;

  // --- carry player with the platform they're standing on
  if (p.standingOn && p.standingOn.move) {
    const before = p.standingOn._lastRect;
    const now = platformRect(p.standingOn);
    if (before) {
      p.x += now.x - before.x;
      p.y += now.y - before.y;
    }
  }
  for (const pl of lvl.platforms) if (pl.move) pl._lastRect = platformRect(pl);

  // --- horizontal movement
  if (input.left) p.vx -= MOVE_ACC;
  if (input.right) p.vx += MOVE_ACC;
  if (!input.left && !input.right) p.vx *= p.grounded ? 0.72 : 0.95;
  p.vx = Math.max(-MAX_SPD, Math.min(MAX_SPD, p.vx));
  if (Math.abs(p.vx) < 0.05) p.vx = 0;

  // --- jumping (with coyote time + buffer)
  if (p.grounded) p.coyote = 7; else if (p.coyote > 0) p.coyote--;
  if (input.jumpBuffered > 0) input.jumpBuffered--;
  if (input.jumpBuffered > 0 && p.coyote > 0) {
    p.vy = JUMP_V;
    p.coyote = 0;
    input.jumpBuffered = 0;
    p.grounded = false;
    spawnBurst(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE, "rgba(255,255,255,.7)", 6);
  }
  // variable jump height
  if (!input.jump && p.vy < -5) p.vy = -5;

  // --- gravity
  p.vy += GRAV;
  p.vy = Math.min(p.vy, 18);

  const rects = lvl.platforms.map(platformRect);

  // --- move X and resolve
  p.x += p.vx;
  for (const r of rects) {
    if (r.type === "lava") continue;
    if (overlaps(p.x, p.y, PLAYER_SIZE, PLAYER_SIZE, r)) {
      if (p.vx > 0) p.x = r.x - PLAYER_SIZE;
      else if (p.vx < 0) p.x = r.x + r.w;
      p.vx = 0;
    }
  }

  // --- move Y and resolve
  p.y += p.vy;
  p.grounded = false;
  p.standingOn = null;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.type === "lava") continue;
    if (overlaps(p.x, p.y, PLAYER_SIZE, PLAYER_SIZE, r)) {
      if (p.vy > 0) {
        p.y = r.y - PLAYER_SIZE;
        p.vy = 0;
        p.grounded = true;
        p.standingOn = lvl.platforms[i];
      } else if (p.vy < 0) {
        p.y = r.y + r.h;
        p.vy = 0;
      }
    }
  }

  // --- lava + checkpoints + finish (slightly generous overlap)
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const touching = overlaps(p.x + 2, p.y + 2, PLAYER_SIZE - 4, PLAYER_SIZE - 2, { x: r.x, y: r.y - 2, w: r.w, h: r.h + 2 });
    if (!touching) continue;
    if (r.type === "lava") { die(); return; }
    if (r.type === "checkpoint" && (p.spawnX !== r.x + 20 || p.spawnY !== r.y - PLAYER_SIZE - 1)) {
      const isNew = !lvl.platforms[i]._activated;
      lvl.platforms[i]._activated = true;
      p.spawnX = r.x + 20;
      p.spawnY = r.y - PLAYER_SIZE - 1;
      if (isNew) spawnBurst(r.x + r.w / 2, r.y, "#00e676", 14);
    }
    if (r.type === "finish" && p.grounded) { winLevel(); return; }
  }

  // --- fell off the world
  if (p.y > lvl.killY) { die(); return; }
}

/* ---------------- RENDER ---------------- */
function resize() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener("resize", resize);
resize();

function render() {
  const W = innerWidth, H = innerHeight;
  const lvl = game.level;
  const p = game.player;

  // camera
  const targetX = p.x - W / 2 + 120;
  const targetY = p.y - H / 2;
  game.camX += (targetX - game.camX) * 0.12;
  game.camY += (targetY - game.camY) * 0.08;

  // background — hue shifts a little every obby so each one feels new
  const hue = (200 + lvl.n * 23) % 360;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `hsl(${hue}, 45%, 14%)`);
  g.addColorStop(1, `hsl(${(hue + 40) % 360}, 50%, 26%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // parallax floating squares
  ctx.save();
  const pr = mulberry32(lvl.n * 31 + 5);
  for (let i = 0; i < 24; i++) {
    const px = pr() * 4000, py = pr() * 1400 - 700, ps = 14 + pr() * 50, depth = 0.2 + pr() * 0.3;
    const sx = ((px - game.camX * depth) % (W + 200) + W + 200) % (W + 200) - 100;
    const sy = py - game.camY * depth + H / 2;
    ctx.fillStyle = `hsla(${(hue + 60) % 360}, 60%, 70%, .07)`;
    ctx.fillRect(sx, sy, ps, ps);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-game.camX, -game.camY);

  // platforms
  for (const pl of lvl.platforms) {
    const r = platformRect(pl);
    if (r.x - game.camX > W + 100 || r.x + r.w - game.camX < -100) continue;

    if (r.type === "lava") {
      const lg = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      lg.addColorStop(0, "#ff7043");
      lg.addColorStop(1, "#d32f2f");
      ctx.fillStyle = lg;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // bubbling top
      ctx.fillStyle = "#ffab91";
      for (let bx = r.x + 4; bx < r.x + r.w - 6; bx += 14) {
        const bh = 3 + 2.5 * Math.sin(game.time * 6 + bx * 0.4);
        ctx.fillRect(bx, r.y - bh, 7, bh);
      }
    } else {
      const colors = {
        start: ["#42a5f5", "#1e64b4"],
        finish: ["#ffd54f", "#c79a00"],
        checkpoint: pl._activated ? ["#00e676", "#00913f"] : ["#b388ff", "#6a3dd8"],
        solid: ["#78909c", "#455a64"],
      }[r.type] || ["#78909c", "#455a64"];
      ctx.fillStyle = colors[1];
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = colors[0];
      ctx.fillRect(r.x, r.y, r.w, 6);

      if (r.type === "checkpoint") {
        // flag
        ctx.fillStyle = "#eceff1";
        ctx.fillRect(r.x + r.w / 2 - 2, r.y - 34, 4, 34);
        ctx.fillStyle = pl._activated ? "#00e676" : "#b388ff";
        ctx.fillRect(r.x + r.w / 2 + 2, r.y - 34, 22, 14);
      }
      if (r.type === "finish") {
        // checkered banner
        for (let cx = 0; cx < r.w; cx += 12) {
          ctx.fillStyle = (cx / 12) % 2 ? "#212121" : "#fafafa";
          ctx.fillRect(r.x + cx, r.y - 8, Math.min(12, r.w - cx), 8);
        }
      }
      if (r.type === "start") {
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.font = "bold 13px Segoe UI, sans-serif";
        ctx.fillText(`OBBY #${lvl.n}`, r.x + 20, r.y - 12);
      }
    }

    if (pl.move) {
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      if (pl.move.axis === "x") {
        ctx.moveTo(pl.move.baseX - pl.move.range, r.y + r.h / 2);
        ctx.lineTo(pl.move.baseX + r.w + pl.move.range, r.y + r.h / 2);
      } else {
        ctx.moveTo(r.x + r.w / 2, pl.move.baseY - pl.move.range);
        ctx.lineTo(r.x + r.w / 2, pl.move.baseY + r.h + pl.move.range);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // particles
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // player
  drawSkin(ctx, skinById(save.equipped), p.x, p.y, PLAYER_SIZE, game.time);

  ctx.restore();
}

/* ---------------- MAIN LOOP ---------------- */
let last = performance.now();
let acc = 0;
const STEP = 1000 / 60;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(now - last, 100);
  last = now;

  if (game.state === "playing") {
    acc += dt;
    while (acc >= STEP) {
      stepPhysics();
      updateParticles();
      acc -= STEP;
      if (game.state !== "playing") { acc = 0; break; }
    }
    render();
  } else if (game.state === "win" || game.state === "paused") {
    updateParticles();
    render();
  } else if (game.state === "market") {
    renderMarketPreviews();
  }
}
requestAnimationFrame(loop);

/* ---------------- MARKET ---------------- */
const marketPreviews = [];

function buildMarket() {
  const grid = $("market-grid");
  grid.innerHTML = "";
  marketPreviews.length = 0;

  for (const skin of SKINS) {
    const owned = save.owned.includes(skin.id);
    const equipped = save.equipped === skin.id;

    const card = document.createElement("div");
    card.className = "skin-card" + (equipped ? " equipped" : "");

    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 64;
    marketPreviews.push({ cv, skin });

    const name = document.createElement("div");
    name.className = "skin-name";
    name.textContent = skin.name;

    const cost = document.createElement("div");
    cost.className = "skin-cost";
    cost.textContent = owned ? (equipped ? "✔ Equipped" : "Owned") : `⭐ ${skin.cost} XP`;

    const btn = document.createElement("button");
    if (equipped) {
      btn.className = "skin-btn equipped";
      btn.textContent = "EQUIPPED";
    } else if (owned) {
      btn.className = "skin-btn equip";
      btn.textContent = "EQUIP";
      btn.onclick = () => {
        save.equipped = skin.id;
        persist();
        buildMarket();
      };
    } else {
      btn.className = "skin-btn buy";
      btn.textContent = `BUY · ${skin.cost} XP`;
      btn.disabled = save.xp < skin.cost;
      btn.onclick = () => {
        if (save.xp < skin.cost) return;
        save.xp -= skin.cost;
        save.owned.push(skin.id);
        save.equipped = skin.id;
        persist();
        refreshStatChips();
        buildMarket();
      };
    }

    card.append(cv, name, cost, btn);
    grid.appendChild(card);
  }
  refreshStatChips();
}

function renderMarketPreviews() {
  const t = performance.now() / 1000;
  for (const { cv, skin } of marketPreviews) {
    const c = cv.getContext("2d");
    c.clearRect(0, 0, 64, 64);
    drawSkin(c, skin, 10, 10, 44, t);
  }
}

/* ---------------- UI WIRING ---------------- */
$("btn-play").onclick = () => startLevel(save.level);
$("btn-market").onclick = () => { game.state = "market"; buildMarket(); showScreen("market"); };
$("btn-market-back").onclick = () => { game.state = "menu"; refreshStatChips(); showScreen("menu"); };
$("btn-pause").onclick = pauseGame;
$("btn-resume").onclick = resumeGame;
$("btn-restart").onclick = () => startLevel(game.level.n);
$("btn-quit").onclick = () => { game.state = "menu"; refreshStatChips(); showScreen("menu"); };
$("btn-next").onclick = () => startLevel(game.level.n + 1);
$("btn-win-menu").onclick = () => { game.state = "menu"; refreshStatChips(); showScreen("menu"); };

refreshStatChips();
