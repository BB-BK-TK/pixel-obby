// Headless smoke test for game.js (run: node test_headless.js)
const fs = require("fs");

function makeCtx() {
  return new Proxy({ globalAlpha: 1 }, {
    get: (t, k) => (k in t ? t[k] : () => makeCtx()),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}
function makeEl() {
  return {
    width: 960, height: 540,
    getContext: () => makeCtx(),
    classList: { toggle() {}, add() {} },
    addEventListener() {},
    appendChild() {},
    textContent: "", innerHTML: "",
    disabled: false,
    blur() {},
  };
}
const els = {};
global.document = {
  getElementById: (id) => (els[id] = els[id] || makeEl()),
  createElement: () => makeEl(),
  activeElement: null,
};
global.window = { addEventListener() {} };
global.localStorage = { getItem: () => null, setItem() {} };
global.requestAnimationFrame = () => {};
global.navigator = {};
global.location = { protocol: "file:" };

const src = fs.readFileSync("game.js", "utf8");

const test = `
let failed = 0;
function check(label, ok) {
  console.log((ok ? "PASS" : "FAIL") + " - " + label);
  if (!ok) failed++;
}

// --- can the player land on the start platform? (the reported glitch) ---
loadLevel(1);
setState("playing");
for (let i = 0; i < 120; i++) { updatePlatforms(1/60); updatePlayer(1/60); }
check("player lands on start platform", player.grounded === true);
check("player rests on top (y = -28)", Math.abs(player.y + 28) < 0.01);

// --- moving works ---
const x0 = player.x;
input.right = true;
for (let i = 0; i < 30; i++) { updatePlatforms(1/60); updatePlayer(1/60); }
input.right = false;
check("player moves right when holding right", player.x > x0 + 50);

// --- jumping works ---
input.jump = true; input.jumpPressed = true;
let minY = player.y;
let leftGround = false;
for (let i = 0; i < 90; i++) {
  updatePlatforms(1/60); updatePlayer(1/60);
  if (!player.grounded) leftGround = true;
  minY = Math.min(minY, player.y);
}
input.jump = false;
check("jump leaves the ground", leftGround);
check("jump gains decent height", minY < -28 - 60);
check("player lands again after jump", player.grounded === true);

// --- every obby stays physically beatable ---
let genOk = true;
for (const n of [1, 2, 3, 5, 10, 25, 50, 100, 500, 5000, 1000000]) {
  const w = generateLevel(n);
  for (let i = 1; i < w.platforms.length; i++) {
    const a = w.platforms[i - 1], b = w.platforms[i];
    const gap = b.baseX - (a.baseX + a.w);
    const rise = a.baseY - b.baseY;
    if (gap > 150 || rise > 76) { genOk = false; console.log("  bad jump in obby " + n, gap, rise); }
  }
}
check("jumps possible in obbies up to #1,000,000", genOk);

// --- regression: obby #5 block 3 (a moving block) must not yank the player ---
loadLevel(5);
check("obby 5 block 3 is a moving block", !!world.platforms[3].mover);
let yanked = false;
for (let timing = 0; timing < 30; timing++) {
  loadLevel(5);
  state = "playing";
  world.time = timing * 0.15;
  updatePlatforms(0.0001);
  const from = world.platforms[2], onto = world.platforms[3];
  player.x = from.x + from.w - 28; player.y = from.y - 28;
  player.vx = 0; player.vy = 0;
  player.grounded = true; player.groundPlat = from;
  input.right = true; input.jump = true; input.jumpPressed = true;
  let px = player.x;
  for (let f = 0; f < 90; f++) {
    updatePlatforms(1 / 60);
    updatePlayer(1 / 60);
    if (player.y > world.killY - 40) break; // missed and fell: not what we test
    if (player.x < px - 0.5) yanked = true;  // moving right, yet pushed backwards
    px = player.x;
  }
  input.right = false; input.jump = false;
}
check("jumping onto obby 5 block 3 never yanks the player backwards", !yanked);

// --- avatar specials (independent from items) ---
save.skin = "duck";
loadLevel(1);
state = "playing";
for (let i = 0; i < 120; i++) { updatePlatforms(1 / 60); updatePlayer(1 / 60); updateSkinEffects(1 / 60); }
wasGrounded = true;
input.jump = true; input.jumpPressed = true;
for (let i = 0; i < 20; i++) { updatePlatforms(1 / 60); updatePlayer(1 / 60); updateSkinEffects(1 / 60); }
input.jump = false;
check("duck quacks on jump", particles.some(p => p.kind === "quack"));

particles = [];
save.skin = "cat";
loadLevel(1);
state = "playing";
input.right = true;
for (let i = 0; i < 40; i++) { updatePlatforms(1 / 60); updatePlayer(1 / 60); updateSkinEffects(1 / 60); }
input.right = false;
check("cat leaves paw prints", particles.some(p => p.kind === "paw"));
save.skin = "classic";

// --- wearable items: magic hat sparkles while equipped ---
save.ownedItems = ["magichat"];
save.equipped = { hat: "magichat", back: null, feet: null, charm: null };
loadLevel(1);
state = "playing";
for (let i = 0; i < 30; i++) { updatePlatforms(1 / 60); updatePlayer(1 / 60); updateItemEffects(1 / 60); }
check("magic hat leaves sparkle particles", particles.some(p => p.kind === "spark"));
save.equipped.hat = null;
check("unequipped hat clears slot", save.equipped.hat === null);
save.ownedItems = [];
save.equipped = { hat: null, back: null, feet: null, charm: null };

// --- lava blocks: only after obby #9, and they burn on touch ---
let lavaEarly = false;
for (let n = 1; n <= 9; n++) if (generateLevel(n).lava.length > 0) lavaEarly = true;
check("no lava in obbies 1-9", !lavaEarly);

let lavaLevel = 0;
for (let n = 10; n <= 30; n++) if (generateLevel(n).lava.length > 0) { lavaLevel = n; break; }
check("lava shows up in obbies 10+", lavaLevel > 0);

if (lavaLevel) {
  loadLevel(lavaLevel);
  state = "playing";
  const lv = world.lava[0];
  player.x = lv.x + lv.w / 2 - 14; player.y = lv.y - 10; player.vx = 0; player.vy = 0;
  updatePlatforms(1 / 60);
  updatePlayer(1 / 60);
  check("touching lava sends you back to the checkpoint",
    player.x === world.checkpoint.x && player.y === world.checkpoint.y);

  // lava must never overlap a platform you need to stand on
  let lavaClear = true;
  for (let n = 10; n <= 60; n++) {
    const w = generateLevel(n);
    for (const l of w.lava) {
      for (const p of w.platforms) {
        if (l.x < p.x + p.w && l.x + l.w > p.x && l.y < p.y + p.h && l.y + l.h > p.y) lavaClear = false;
      }
    }
  }
  check("lava never overlaps platforms (obbies 10-60)", lavaClear);
}

// --- finishing awards XP and advances level ---
loadLevel(save.level);
const xpBefore = save.xp, lvlBefore = save.level;
completeObby();
check("+100 XP on completion", save.xp === xpBefore + 100);
check("next obby unlocked", save.level === lvlBefore + 1);

// --- replaying an old obby gives +25 XP and keeps progress ---
loadLevel(1);
const xpBefore2 = save.xp, lvlBefore2 = save.level;
completeObby();
check("replay gives +25 XP", save.xp === xpBefore2 + 25);
check("replay does not change progress", save.level === lvlBefore2);

process.exit(failed ? 1 : 0);
`;

eval(src + "\n" + test);
