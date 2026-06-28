"use strict";

/* ============================================================
   PIXEL OBBY
   Endless obstacle courses that get harder every level.
   Finish an obby -> +100 XP. Spend XP on skins in the Market.
   ============================================================ */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const XP_PER_OBBY = 100;

/* ---------------- Sound ---------------- */
// Lazily created on first user gesture (browsers block audio before that).
let audioCtx = null;

function unlockAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

// A cartoony duck "quack": a sawtooth that pitch-drops through a lowpass,
// played as two quick syllables.
function playQuack() {
  if (!audioCtx || audioCtx.state !== "running") return;
  const now = audioCtx.currentTime;

  const syllable = (start, f0, f1, dur, peak) => {
    const osc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, start);
    filter.Q.value = 6;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  };

  syllable(now, 520, 300, 0.12, 0.25);
  syllable(now + 0.13, 470, 250, 0.14, 0.2);
}

/* ---------------- Save data ---------------- */

const SAVE_KEY = "pixelObbySave";

let save = {
  xp: 0,
  level: 1,
  owned: ["classic"],
  skin: "classic",
  seenTutorial: false,
  ownedItems: [],
  equipped: { hat: null, back: null, feet: null, charm: null },
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      save.xp = data.xp || 0;
      save.level = data.level || 1;
      save.owned = Array.isArray(data.owned) && data.owned.length ? data.owned : ["classic"];
      save.skin = data.skin || "classic";
      save.seenTutorial = !!data.seenTutorial;
      save.ownedItems = Array.isArray(data.ownedItems) ? data.ownedItems : [];
      save.equipped = data.equipped || { hat: null, back: null, feet: null, charm: null };
      // move old consumable items into owned list
      if (data.items && typeof data.items === "object") {
        for (const [id, n] of Object.entries(data.items)) {
          for (let i = 0; i < n; i++) {
            if (!save.ownedItems.includes(id)) save.ownedItems.push(id);
          }
        }
      }
    }
  } catch (e) { /* corrupted save -> start fresh */ }
}

function ownsItem(id) { return save.ownedItems.includes(id); }
function getEquipped(slot) {
  const id = save.equipped[slot];
  return id ? ITEMS.find(i => i.id === id) : null;
}
function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) { /* storage unavailable -> play without saving */ }
}

/* ---------------- Skins ---------------- */

const SKINS = [
  { id: "classic", name: "Classic", price: 0,    body: "#e8e8e8" },
  { id: "red",     name: "Red",     price: 100,  body: "#e84d4d" },
  { id: "blue",    name: "Blue",    price: 100,  body: "#4d7de8" },
  { id: "green",   name: "Green",   price: 100,  body: "#52c45a" },
  { id: "purple",  name: "Purple",  price: 100,  body: "#b06aff" },
  { id: "orange",  name: "Orange",  price: 100,  body: "#ff9d2e" },
  { id: "pink",    name: "Pink",    price: 100,  body: "#ff8de8" },
  { id: "cyan",    name: "Cyan",    price: 100,  body: "#4dffe8" },
  { id: "teal",    name: "Teal",    price: 100,  body: "#2aa198" },
  { id: "brown",   name: "Brown",   price: 100,  body: "#8a5a30" },
  { id: "lime",    name: "Lime",    price: 100,  body: "#aef359" },
  { id: "silver",  name: "Silver",  price: 100,  body: "#c0c8d0" },
  { id: "ninja",   name: "Ninja",   price: 300,  body: "#23232e", desc: "Shadow clones in the air!" },
  { id: "slime",   name: "Slime",   price: 300,  body: "#6ee84d", desc: "Leaves goo behind!" },
  { id: "cactus",  name: "Cactus",  price: 350,  body: "#3fae5a", desc: "Leaves sand piles on every block!" },
  { id: "bee",     name: "Bee",     price: 400,  body: "#ffd84d", desc: "Buzzing wings + pollen trail!" },
  { id: "frog",    name: "Frog",    price: 400,  body: "#52c45a", desc: "Stretches when it jumps!" },
  { id: "puppy",   name: "Puppy",   price: 400,  body: "#d2a679", desc: "Wags its tail + floats hearts!" },
  { id: "tiger",   name: "Tiger",   price: 400,  body: "#ff9d2e", desc: "Striped and fierce!" },
  { id: "bear",    name: "Bear",    price: 400,  body: "#8a5a30", desc: "Honey drips when you run!" },
  { id: "penguin", name: "Penguin", price: 420,  body: "#23232e", desc: "Slides with snowy puffs!" },
  { id: "bunny",   name: "Bunny",   price: 450,  body: "#f5f5f5", desc: "Fluffy puffs when hopping!" },
  { id: "chick",   name: "Chick",   price: 450,  body: "#ffd84d", desc: "Sheds tiny feathers in the air!" },
  { id: "fox",     name: "Fox",     price: 450,  body: "#e86d2d", desc: "Bushy tail + autumn leaves!" },
  { id: "mouse",   name: "Mouse",   price: 420,  body: "#b8b8c0", desc: "Drops cheese crumbs!" },
  { id: "monkey",  name: "Monkey",  price: 430,  body: "#a06a3a", desc: "Leafy jungle trail!" },
  { id: "pig",     name: "Pig",     price: 450,  body: "#ff9db0", desc: "Floats little hearts!" },
  { id: "cow",     name: "Cow",     price: 460,  body: "#f5f5f5", desc: "Spotted and cute!" },
  { id: "lion",    name: "Lion",    price: 480,  body: "#e8a23d", desc: "King of the mane!" },
  { id: "wolf",    name: "Wolf",    price: 480,  body: "#6b7787", desc: "Howls puffs in the air!" },
  { id: "robot",   name: "Robot",   price: 500,  body: "#9aa7b8", desc: "Turns into a UFO when jumping!" },
  { id: "ghost",   name: "Ghost",   price: 500,  body: "#f0f0ff", desc: "Fades away when standing still!" },
  { id: "cat",     name: "Cat",     price: 500,  body: "#e8954d", desc: "Leaves paw prints!" },
  { id: "duck",    name: "Duck",    price: 500,  body: "#ffe14d", desc: "QUACKS when it jumps!" },
  { id: "owl",     name: "Owl",     price: 500,  body: "#c4a882", desc: "Sheds soft feathers!" },
  { id: "fish",    name: "Fish",    price: 550,  body: "#4d9de8", desc: "Blows bubbles!" },
  { id: "zombie",  name: "Zombie",  price: 550,  body: "#7a9e6a", desc: "Ooze drips behind you!" },
  { id: "mushroom",name: "Mushroom",price: 500,  body: "#e84d4d", desc: "Puffs magic spores!" },
  { id: "snake",   name: "Snake",   price: 520,  body: "#52c45a", desc: "Flicks its tongue!" },
  { id: "crab",    name: "Crab",    price: 560,  body: "#e84d4d", desc: "Snappy with bubbles!" },
  { id: "snowman", name: "Snowman", price: 560,  body: "#ffffff", desc: "Leaves snow puffs!" },
  { id: "fire",    name: "Fire",    price: 600,  body: "#ff6b2d", desc: "Always on fire!" },
  { id: "ice",     name: "Ice",     price: 600,  body: "#aee3ff", desc: "Sparkles with frost!" },
  { id: "astronaut", name: "Astronaut", price: 650, body: "#e8e8f0", desc: "Shoots tiny star particles!" },
  { id: "dino",    name: "Dino",    price: 600,  body: "#52c45a", desc: "Stomps up dust!" },
  { id: "shark",   name: "Shark",   price: 620,  body: "#7da0b8", desc: "Trails bubbles!" },
  { id: "clown",   name: "Clown",   price: 650,  body: "#ffffff", desc: "Tosses confetti!" },
  { id: "octopus", name: "Octopus", price: 680,  body: "#b06aff", desc: "Squirts ink!" },
  { id: "skeleton",name: "Skeleton",price: 700,  body: "#e8e8e8", desc: "Rattles bone bits!" },
  { id: "alien",   name: "Alien",   price: 700,  body: "#6ee84d", desc: "Glows and blinks big eyes!" },
  { id: "panda",   name: "Panda",   price: 700,  body: "#f5f5f5", desc: "Bamboo leaves drift around it!" },
  { id: "unicorn", name: "Unicorn", price: 750,  body: "#ffe8f8", desc: "Magical horn sparkles!" },
  { id: "pumpkin", name: "Pumpkin", price: 800,  body: "#ff8c00", desc: "Spooky rising embers!" },
  { id: "vampire", name: "Vampire", price: 850,  body: "#2d1a3a", desc: "Bats flutter around you!" },
  { id: "star",    name: "Star",    price: 900,  body: "#ffe14d", desc: "Bursts with star sparkles!" },
  { id: "devil",   name: "Devil",   price: 900,  body: "#e84d4d", desc: "Breathes embers!" },
  { id: "angel",   name: "Angel",   price: 950,  body: "#ffffff", desc: "Drifts soft feathers!" },
  { id: "knight",  name: "Knight",  price: 1000, body: "#9aa7b8", desc: "Shiny royal guard!" },
  { id: "gold",    name: "Gold",    price: 1000, body: "#ffd84d", desc: "Always sparkling!" },
  { id: "phoenix", name: "Phoenix", price: 1100, body: "#ff6b2d", desc: "Wing flames when you move!" },
  { id: "shadow",  name: "Shadow",  price: 1200, body: "#1a1a24", desc: "Trails dark smoke!" },
  { id: "crystal", name: "Crystal", price: 1300, body: "#c8b8ff", desc: "Refracts rainbow light!" },
  { id: "mermaid", name: "Mermaid", price: 1100, body: "#4dffe8", desc: "Bubbles from the sea!" },
  { id: "yeti",    name: "Yeti",    price: 1200, body: "#e8f0ff", desc: "Frosty snow trail!" },
  { id: "diamond", name: "Diamond", price: 1600, body: "#aee3ff", desc: "Dazzling rainbow shine!" },
  { id: "king",    name: "King",    price: 1500, body: "#f0e6d2", desc: "Rains royal confetti!" },
  { id: "dragon",  name: "Dragon",  price: 1800, body: "#3fae5a", desc: "Breathes fire as it runs!" },
  { id: "rainbow", name: "Rainbow", price: 2000, body: "#fff",    desc: "Leaves a rainbow trail!" },
];

/* ---------------- Wearable items (stay on until you change them) ---------------- */

const ITEM_SLOTS = ["hat", "back", "feet", "charm"];
const SLOT_LABELS = { hat: "Hat", back: "Back", feet: "Feet", charm: "Charm" };

const ITEMS = [
  { id: "magichat",    name: "Magic Hat",    price: 300, slot: "hat",   fx: "sparkle", fxColor: "#b06aff" },
  { id: "wizardhat",   name: "Wizard Hat",   price: 350, slot: "hat",   fx: "sparkle", fxColor: "#4d7de8" },
  { id: "cowboyhat",   name: "Cowboy Hat",   price: 280, slot: "hat",   fx: null },
  { id: "partyhat",    name: "Party Hat",    price: 200, slot: "hat",   fx: "confetti" },
  { id: "crown",       name: "Gold Crown",   price: 500, slot: "hat",   fx: "sparkle", fxColor: "#ffd84d" },
  { id: "beanie",      name: "Beanie",       price: 150, slot: "hat",   fx: null },
  { id: "piratehat",   name: "Pirate Hat",   price: 320, slot: "hat",   fx: null },
  { id: "viking",      name: "Viking Helm",  price: 400, slot: "hat",   fx: null },
  { id: "headphones",  name: "Headphones",   price: 220, slot: "hat",   fx: null },
  { id: "santahat",    name: "Santa Hat",    price: 240, slot: "hat",   fx: "sparkle", fxColor: "#ff5050" },
  { id: "gogglehat",   name: "Goggles",      price: 260, slot: "hat",   fx: null },
  { id: "horns",       name: "Devil Horns",  price: 290, slot: "hat",   fx: null },
  { id: "baseballcap", name: "Baseball Cap", price: 170, slot: "hat",   fx: null },
  { id: "chefhat",     name: "Chef Hat",     price: 180, slot: "hat",   fx: null },
  { id: "tophat",      name: "Top Hat",      price: 380, slot: "hat",   fx: "sparkle", fxColor: "#ffd84d" },
  { id: "halo",        name: "Golden Halo",  price: 480, slot: "hat",   fx: "sparkle", fxColor: "#ffd84d" },
  { id: "cape",        name: "Hero Cape",    price: 250, slot: "back",  fx: null },
  { id: "wings",       name: "Angel Wings",  price: 450, slot: "back",  fx: "sparkle", fxColor: "#fff" },
  { id: "backpack",    name: "Backpack",     price: 180, slot: "back",  fx: null },
  { id: "fairywings",  name: "Fairy Wings",  price: 550, slot: "back",  fx: "sparkle", fxColor: "#ff8de8" },
  { id: "jetpack",     name: "Jetpack",      price: 600, slot: "back",  fx: "fire" },
  { id: "scarf",       name: "Winter Scarf", price: 200, slot: "back",  fx: null },
  { id: "rainbowcape", name: "Rainbow Cape", price: 380, slot: "back",  fx: "confetti" },
  { id: "batwings",    name: "Bat Wings",    price: 420, slot: "back",  fx: null },
  { id: "dragonwings", name: "Dragon Wings", price: 650, slot: "back",  fx: "fire" },
  { id: "speedboots",  name: "Speed Boots",  price: 120, slot: "feet",  fx: null },
  { id: "springshoes", name: "Spring Shoes", price: 160, slot: "feet",  fx: null },
  { id: "rocketboots", name: "Rocket Boots", price: 400, slot: "feet",  fx: "fire" },
  { id: "fluffyboots", name: "Fluffy Boots", price: 200, slot: "feet",  fx: null },
  { id: "rollerskates",name: "Roller Skates",price: 280, slot: "feet",  fx: "sparkle", fxColor: "#ff5050" },
  { id: "slippers",    name: "Cozy Slippers",price: 140, slot: "feet",  fx: null },
  { id: "moonboots",   name: "Moon Boots",   price: 320, slot: "feet",  fx: "sparkle", fxColor: "#aee3ff" },
  { id: "iceskates",   name: "Ice Skates",   price: 340, slot: "feet",  fx: "sparkle", fxColor: "#aee3ff" },
  { id: "goldenshoes", name: "Golden Shoes", price: 450, slot: "feet",  fx: "sparkle", fxColor: "#ffd84d" },
  { id: "shieldcharm", name: "Shield Charm", price: 150, slot: "charm", fx: null },
  { id: "doublejump",  name: "Jump Charm",   price: 200, slot: "charm", fx: null },
  { id: "magnet",      name: "XP Magnet",    price: 250, slot: "charm", fx: null },
  { id: "luckycharm",  name: "Lucky Clover", price: 300, slot: "charm", fx: null },
  { id: "heartcharm",  name: "Heart Charm",  price: 180, slot: "charm", fx: "hearts" },
  { id: "bubblecharm", name: "Bubble Charm", price: 190, slot: "charm", fx: "bubbles" },
  { id: "snowcharm",   name: "Snow Charm",   price: 210, slot: "charm", fx: "sparkle", fxColor: "#ffffff" },
  { id: "starcharm",   name: "Star Charm",   price: 220, slot: "charm", fx: "sparkle", fxColor: "#ffe14d" },
  { id: "firecharm",   name: "Fire Charm",   price: 240, slot: "charm", fx: "fire" },
  { id: "mooncharm",   name: "Moon Charm",   price: 260, slot: "charm", fx: "sparkle", fxColor: "#aee3ff" },
  { id: "boltcharm",   name: "Bolt Charm",   price: 270, slot: "charm", fx: "sparkle", fxColor: "#ffd84d" },
  { id: "gemcharm",    name: "Gem Charm",    price: 320, slot: "charm", fx: "sparkle", fxColor: "#ff8de8" },
];

function drawItemIcon(c, x, y, s, itemId) {
  const u = s / 28;
  if (itemId === "magichat") {
    c.fillStyle = "#4a2a8a"; c.fillRect(x + 4 * u, y + 10 * u, 20 * u, 5 * u);
    c.fillStyle = "#6b3fbf"; c.fillRect(x + 6 * u, y + 2 * u, 16 * u, 10 * u);
    c.fillStyle = "#ffd84d"; c.fillRect(x + 12 * u, y, 4 * u, 4 * u);
  } else if (itemId === "wizardhat") {
    c.fillStyle = "#2d2d4d"; c.fillRect(x + 4 * u, y + 12 * u, 20 * u, 5 * u);
    c.fillStyle = "#4a4a7a"; c.fillRect(x + 10 * u, y, 8 * u, 14 * u);
  } else if (itemId === "cowboyhat") {
    c.fillStyle = "#8a5a30"; c.fillRect(x + 2 * u, y + 12 * u, 24 * u, 4 * u);
    c.fillRect(x + 8 * u, y + 6 * u, 12 * u, 8 * u);
  } else if (itemId === "partyhat") {
    c.fillStyle = "#ff5050"; c.fillRect(x + 10 * u, y + 2 * u, 8 * u, 16 * u);
    c.fillStyle = "#ffd84d"; c.fillRect(x + 12 * u, y, 4 * u, 4 * u);
  } else if (itemId === "crown") {
    c.fillStyle = "#ffd84d"; c.fillRect(x + 4 * u, y + 12 * u, 20 * u, 5 * u);
    c.fillRect(x + 4 * u, y + 6 * u, 4 * u, 6 * u);
    c.fillRect(x + 12 * u, y + 4 * u, 4 * u, 8 * u);
    c.fillRect(x + 20 * u, y + 6 * u, 4 * u, 6 * u);
  } else if (itemId === "beanie") {
    c.fillStyle = "#e84d4d"; c.fillRect(x + 4 * u, y + 8 * u, 20 * u, 12 * u);
    c.fillRect(x + 2 * u, y + 18 * u, 24 * u, 4 * u);
  } else if (itemId === "piratehat") {
    c.fillStyle = "#23232e"; c.fillRect(x + 2 * u, y + 12 * u, 24 * u, 4 * u);
    c.fillRect(x + 6 * u, y + 6 * u, 16 * u, 8 * u);
    c.fillStyle = "#fff"; c.fillRect(x + 20 * u, y + 4 * u, 4 * u, 8 * u);
  } else if (itemId === "viking") {
    c.fillStyle = "#9aa7b8"; c.fillRect(x + 4 * u, y + 10 * u, 20 * u, 10 * u);
    c.fillStyle = "#e8954d"; c.fillRect(x + 2 * u, y + 6 * u, 6 * u, 8 * u);
    c.fillRect(x + 20 * u, y + 6 * u, 6 * u, 8 * u);
  } else if (itemId === "headphones") {
    c.fillStyle = "#23232e"; c.fillRect(x + 4 * u, y + 8 * u, 20 * u, 4 * u);
    c.fillRect(x + 2 * u, y + 8 * u, 6 * u, 10 * u);
    c.fillRect(x + 20 * u, y + 8 * u, 6 * u, 10 * u);
  } else if (itemId === "cape") {
    c.fillStyle = "#e84d4d"; c.fillRect(x + 8 * u, y + 4 * u, 12 * u, 22 * u);
    c.fillRect(x + 2 * u, y + 8 * u, 6 * u, 16 * u);
    c.fillRect(x + 20 * u, y + 8 * u, 6 * u, 16 * u);
  } else if (itemId === "wings" || itemId === "fairywings") {
    c.fillStyle = itemId === "fairywings" ? "#ff8de8" : "#fff";
    c.fillRect(x, y + 8 * u, 10 * u, 14 * u);
    c.fillRect(x + 18 * u, y + 8 * u, 10 * u, 14 * u);
  } else if (itemId === "backpack") {
    c.fillStyle = "#52c45a"; c.fillRect(x + 8 * u, y + 6 * u, 12 * u, 18 * u);
    c.fillStyle = "#3e9c2e"; c.fillRect(x + 10 * u, y + 2 * u, 8 * u, 6 * u);
  } else if (itemId === "jetpack") {
    c.fillStyle = "#9aa7b8"; c.fillRect(x + 8 * u, y + 6 * u, 12 * u, 16 * u);
    c.fillStyle = "#ff6b2d"; c.fillRect(x + 4 * u, y + 18 * u, 6 * u, 6 * u);
    c.fillRect(x + 18 * u, y + 18 * u, 6 * u, 6 * u);
  } else if (itemId === "scarf") {
    c.fillStyle = "#4d7de8"; c.fillRect(x + 6 * u, y + 10 * u, 16 * u, 6 * u);
    c.fillRect(x + 18 * u, y + 14 * u, 6 * u, 10 * u);
  } else if (itemId === "speedboots" || itemId === "rocketboots" || itemId === "fluffyboots" || itemId === "rollerskates") {
    const col = itemId === "rocketboots" ? "#e84d4d" : itemId === "fluffyboots" ? "#f5f5f5" : "#e8954d";
    c.fillStyle = col; c.fillRect(x + 4 * u, y + 12 * u, 9 * u, 12 * u);
    c.fillRect(x + 15 * u, y + 12 * u, 9 * u, 12 * u);
    if (itemId === "rollerskates") {
      c.fillStyle = "#ff5050"; c.fillRect(x + 4 * u, y + 22 * u, 9 * u, 3 * u);
      c.fillRect(x + 15 * u, y + 22 * u, 9 * u, 3 * u);
    }
  } else if (itemId === "springshoes") {
    c.fillStyle = "#52c45a"; c.fillRect(x + 4 * u, y + 14 * u, 9 * u, 10 * u);
    c.fillRect(x + 15 * u, y + 14 * u, 9 * u, 10 * u);
    c.fillStyle = "#ffd84d"; c.fillRect(x + 6 * u, y + 10 * u, 5 * u, 6 * u);
    c.fillRect(x + 17 * u, y + 10 * u, 5 * u, 6 * u);
  } else if (itemId === "shieldcharm") {
    c.fillStyle = "#4d7de8"; c.fillRect(x + 6 * u, y + 4 * u, 16 * u, 20 * u);
    c.fillStyle = "#aee3ff"; c.fillRect(x + 10 * u, y + 8 * u, 8 * u, 12 * u);
  } else if (itemId === "doublejump") {
    c.fillStyle = "#7CFC00"; c.fillRect(x + 12 * u, y + 2 * u, 4 * u, 10 * u);
    c.fillRect(x + 6 * u, y + 10 * u, 16 * u, 4 * u);
    c.fillRect(x + 8 * u, y + 16 * u, 12 * u, 4 * u);
  } else if (itemId === "magnet") {
    c.fillStyle = "#e84d4d"; c.fillRect(x + 6 * u, y + 8 * u, 6 * u, 14 * u);
    c.fillRect(x + 16 * u, y + 8 * u, 6 * u, 14 * u);
    c.fillRect(x + 6 * u, y + 20 * u, 16 * u, 6 * u);
    c.fillStyle = "#ffd84d"; c.fillRect(x + 11 * u, y + 2 * u, 6 * u, 6 * u);
  } else if (itemId === "luckycharm") {
    c.fillStyle = "#52c45a"; c.fillRect(x + 10 * u, y + 4 * u, 8 * u, 8 * u);
    c.fillRect(x + 6 * u, y + 10 * u, 16 * u, 8 * u);
    c.fillRect(x + 10 * u, y + 16 * u, 8 * u, 8 * u);
  } else if (itemId === "heartcharm") {
    c.fillStyle = "#ff6b9d"; c.fillRect(x + 8 * u, y + 6 * u, 4 * u, 4 * u);
    c.fillRect(x + 16 * u, y + 6 * u, 4 * u, 4 * u);
    c.fillRect(x + 6 * u, y + 10 * u, 16 * u, 6 * u);
    c.fillRect(x + 10 * u, y + 16 * u, 8 * u, 4 * u);
  } else if (itemId === "bubblecharm") {
    c.strokeStyle = "#aee3ff"; c.lineWidth = 2;
    c.strokeRect(x + 8 * u, y + 6 * u, 12 * u, 12 * u);
    c.strokeRect(x + 12 * u, y + 14 * u, 8 * u, 8 * u);
  } else if (itemId === "chefhat") {
    c.fillStyle = "#fff"; c.fillRect(x + 4 * u, y + 10 * u, 20 * u, 12 * u);
    c.fillRect(x + 2 * u, y + 4 * u, 24 * u, 8 * u);
    c.fillStyle = "#e8e8e8"; c.fillRect(x + 6 * u, y + 6 * u, 16 * u, 4 * u);
  } else if (itemId === "baseballcap") {
    c.fillStyle = "#4d7de8"; c.fillRect(x + 4 * u, y + 8 * u, 20 * u, 10 * u);
    c.fillRect(x + 2 * u, y + 14 * u, 24 * u, 4 * u);
    c.fillStyle = "#ffd84d"; c.fillRect(x + 10 * u, y + 10 * u, 8 * u, 4 * u);
  } else if (itemId === "santahat") {
    c.fillStyle = "#ff5050"; c.fillRect(x + 6 * u, y + 4 * u, 16 * u, 14 * u);
    c.fillRect(x + 2 * u, y + 16 * u, 24 * u, 4 * u);
    c.fillStyle = "#fff"; c.fillRect(x + 18 * u, y + 2 * u, 6 * u, 6 * u);
    c.fillStyle = "#ffd84d"; c.fillRect(x + 19 * u, y + 3 * u, 4 * u, 4 * u);
  } else if (itemId === "gogglehat") {
    c.fillStyle = "#23232e"; c.fillRect(x + 4 * u, y + 10 * u, 9 * u, 7 * u);
    c.fillRect(x + 15 * u, y + 10 * u, 9 * u, 7 * u);
    c.fillStyle = "#4d7de8"; c.fillRect(x + 6 * u, y + 12 * u, 5 * u, 3 * u);
    c.fillRect(x + 17 * u, y + 12 * u, 5 * u, 3 * u);
    c.fillStyle = "#9aa7b8"; c.fillRect(x + 13 * u, y + 12 * u, 2 * u, 3 * u);
  } else if (itemId === "horns") {
    c.fillStyle = "#e84d4d"; c.fillRect(x + 5 * u, y + 2 * u, 5 * u, 10 * u);
    c.fillRect(x + 18 * u, y + 2 * u, 5 * u, 10 * u);
    c.fillStyle = "#ff5050"; c.fillRect(x + 4 * u, y, 7 * u, 4 * u);
    c.fillRect(x + 17 * u, y, 7 * u, 4 * u);
  } else if (itemId === "tophat") {
    c.fillStyle = "#23232e"; c.fillRect(x + 4 * u, y + 12 * u, 20 * u, 5 * u);
    c.fillRect(x + 8 * u, y, 12 * u, 14 * u);
    c.fillStyle = "#ffd84d"; c.fillRect(x + 4 * u, y + 14 * u, 20 * u, 2 * u);
  } else if (itemId === "halo") {
    c.strokeStyle = "#ffd84d"; c.lineWidth = 3;
    c.strokeRect(x + 4 * u, y + 4 * u, 20 * u, 6 * u);
    c.fillStyle = "#fff"; c.fillRect(x + 12 * u, y + 2 * u, 4 * u, 3 * u);
  } else if (itemId === "rainbowcape") {
    const cols = ["#ff5050", "#ff9d2e", "#ffd84d", "#52c45a", "#4d7de8", "#b06aff"];
    for (let i = 0; i < 6; i++) {
      c.fillStyle = cols[i]; c.fillRect(x + 8 * u, y + (4 + i * 3) * u, 12 * u, 3 * u);
    }
    c.fillRect(x + 2 * u, y + 8 * u, 6 * u, 14 * u);
    c.fillRect(x + 20 * u, y + 8 * u, 6 * u, 14 * u);
  } else if (itemId === "batwings") {
    c.fillStyle = "#2d1a3a";
    c.fillRect(x, y + 6 * u, 10 * u, 16 * u);
    c.fillRect(x + 18 * u, y + 6 * u, 10 * u, 16 * u);
    c.fillStyle = "#4a2a8a";
    c.fillRect(x + 2 * u, y + 10 * u, 6 * u, 10 * u);
    c.fillRect(x + 20 * u, y + 10 * u, 6 * u, 10 * u);
  } else if (itemId === "dragonwings") {
    c.fillStyle = "#8a2020";
    c.fillRect(x - 2 * u, y + 6 * u, 12 * u, 16 * u);
    c.fillRect(x + 18 * u, y + 6 * u, 12 * u, 16 * u);
    c.fillStyle = "#ff6b2d";
    c.fillRect(x + 1 * u, y + 10 * u, 7 * u, 10 * u);
    c.fillRect(x + 20 * u, y + 10 * u, 7 * u, 10 * u);
  } else if (itemId === "slippers") {
    c.fillStyle = "#b06aff"; c.fillRect(x + 4 * u, y + 14 * u, 9 * u, 10 * u);
    c.fillRect(x + 15 * u, y + 14 * u, 9 * u, 10 * u);
    c.fillStyle = "#fff"; c.fillRect(x + 6 * u, y + 16 * u, 5 * u, 4 * u);
    c.fillRect(x + 17 * u, y + 16 * u, 5 * u, 4 * u);
  } else if (itemId === "moonboots") {
    c.fillStyle = "#e8e8f0"; c.fillRect(x + 4 * u, y + 12 * u, 9 * u, 12 * u);
    c.fillRect(x + 15 * u, y + 12 * u, 9 * u, 12 * u);
    c.fillStyle = "#aee3ff"; c.fillRect(x + 5 * u, y + 22 * u, 7 * u, 4 * u);
    c.fillRect(x + 16 * u, y + 22 * u, 7 * u, 4 * u);
  } else if (itemId === "iceskates") {
    c.fillStyle = "#4d7de8"; c.fillRect(x + 4 * u, y + 12 * u, 9 * u, 10 * u);
    c.fillRect(x + 15 * u, y + 12 * u, 9 * u, 10 * u);
    c.fillStyle = "#aee3ff"; c.fillRect(x + 2 * u, y + 22 * u, 11 * u, 3 * u);
    c.fillRect(x + 15 * u, y + 22 * u, 11 * u, 3 * u);
  } else if (itemId === "goldenshoes") {
    c.fillStyle = "#ffd84d"; c.fillRect(x + 4 * u, y + 12 * u, 9 * u, 12 * u);
    c.fillRect(x + 15 * u, y + 12 * u, 9 * u, 12 * u);
    c.fillStyle = "#fff"; c.fillRect(x + 6 * u, y + 14 * u, 4 * u, 6 * u);
    c.fillRect(x + 17 * u, y + 14 * u, 4 * u, 6 * u);
  } else if (itemId === "snowcharm") {
    c.fillStyle = "#aee3ff"; c.fillRect(x + 12 * u, y + 2 * u, 4 * u, 4 * u);
    c.fillRect(x + 6 * u, y + 8 * u, 16 * u, 4 * u);
    c.fillRect(x + 2 * u, y + 14 * u, 24 * u, 4 * u);
    c.fillRect(x + 8 * u, y + 20 * u, 12 * u, 4 * u);
  } else if (itemId === "starcharm") {
    c.fillStyle = "#ffe14d"; c.fillRect(x + 12 * u, y, 4 * u, 8 * u);
    c.fillRect(x + 6 * u, y + 6 * u, 16 * u, 4 * u);
    c.fillRect(x + 8 * u, y + 12 * u, 12 * u, 4 * u);
    c.fillRect(x + 10 * u, y + 18 * u, 8 * u, 4 * u);
  } else if (itemId === "firecharm") {
    c.fillStyle = "#ff6b2d"; c.fillRect(x + 12 * u, y + 4 * u, 4 * u, 10 * u);
    c.fillRect(x + 8 * u, y + 10 * u, 12 * u, 4 * u);
    c.fillStyle = "#ffd84d"; c.fillRect(x + 10 * u, y + 16 * u, 8 * u, 6 * u);
  } else if (itemId === "mooncharm") {
    c.fillStyle = "#aee3ff"; c.fillRect(x + 8 * u, y + 6 * u, 12 * u, 14 * u);
    c.fillStyle = "#1a1a2e"; c.fillRect(x + 14 * u, y + 8 * u, 8 * u, 12 * u);
  } else if (itemId === "boltcharm") {
    c.fillStyle = "#ffd84d"; c.fillRect(x + 12 * u, y + 2 * u, 4 * u, 8 * u);
    c.fillRect(x + 8 * u, y + 8 * u, 8 * u, 4 * u);
    c.fillRect(x + 10 * u, y + 12 * u, 4 * u, 6 * u);
    c.fillRect(x + 14 * u, y + 16 * u, 6 * u, 4 * u);
  } else if (itemId === "gemcharm") {
    c.fillStyle = "#ff8de8"; c.fillRect(x + 10 * u, y + 4 * u, 8 * u, 8 * u);
    c.fillRect(x + 6 * u, y + 10 * u, 16 * u, 8 * u);
    c.fillRect(x + 10 * u, y + 16 * u, 8 * u, 8 * u);
    c.fillStyle = "#fff"; c.fillRect(x + 12 * u, y + 6 * u, 3 * u, 4 * u);
  }
}

// worn on the torso — drawn after the avatar, not behind it
const BACK_ON_BODY = { scarf: 1, backpack: 1, jetpack: 1 };

// map each slot to a spot on the 28×28 player sprite (icons are laid out for market preview)
function itemDrawPos(px, py, s, slot, itemId) {
  const u = s / 28;
  if (slot === "hat") {
    // icon y where the hat rests on the head (brim / band / base)
    const seatY = {
      headphones: 8,
      partyhat: 16,
      beanie: 20,
      crown: 12,
      viking: 14,
      magichat: 12,
      wizardhat: 12,
      cowboyhat: 14,
      piratehat: 14,
      chefhat: 16,
      baseballcap: 12,
      santahat: 14,
      gogglehat: 10,
      horns: 8,
      tophat: 14,
      halo: 6,
    };
    const headTop = itemId === "halo" ? 0 : 4; // halo floats above the head
    const anchor = seatY[itemId] ?? 12;
    return { x: px, y: py + (headTop - anchor) * u };
  }
  if (slot === "feet") return { x: px, y: py + 4 * u };
  if (slot === "charm") return { x: px + 8 * u, y: py + 10 * u };
  if (slot === "back") {
    if (itemId === "scarf") return { x: px, y: py + 7 * u };
    if (itemId === "backpack") return { x: px + 2 * u, y: py + 5 * u };
    if (itemId === "jetpack") return { x: px, y: py + 4 * u };
    if (itemId === "cape") return { x: px, y: py + 2 * u };
    if (itemId === "rainbowcape") return { x: px, y: py + 2 * u };
    return { x: px, y: py + 1 * u }; // wings, batwings, dragonwings
  }
  return { x: px, y: py };
}

function drawEquippedSlot(c, px, py, s, slot) {
  const id = save.equipped[slot];
  if (!id) return;
  const p = itemDrawPos(px, py, s, slot, id);
  drawItemIcon(c, p.x, p.y, s, id);
}

function drawSkin(c, x, y, s, skinId, t) {
  const u = s / 28; // unit so all skins scale
  let body = "#e8e8e8";
  const skin = SKINS.find(k => k.id === skinId);
  if (skin) body = skin.body;

  if (skinId === "rainbow") body = `hsl(${(t * 120) % 360}, 90%, 60%)`;
  if (skinId === "ghost") c.globalAlpha *= 0.6; // multiply so the idle fade still applies

  // body
  c.fillStyle = body;
  c.fillRect(x, y, s, s);
  // outline
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.fillRect(x, y + s - 3 * u, s, 3 * u);

  if (skinId === "ninja") {
    c.fillStyle = "#d43c3c";
    c.fillRect(x, y + 6 * u, s, 5 * u); // headband
    c.fillStyle = "#fff";
    c.fillRect(x + 6 * u, y + 13 * u, 5 * u, 4 * u);
    c.fillRect(x + 17 * u, y + 13 * u, 5 * u, 4 * u);
  } else if (skinId === "robot") {
    c.fillStyle = "#444c5c";
    c.fillRect(x + 12 * u, y - 6 * u, 4 * u, 6 * u);   // antenna
    c.fillStyle = "#ff5050";
    c.fillRect(x + 11 * u, y - 10 * u, 6 * u, 5 * u);  // antenna light
    c.fillStyle = "#1de9ff";
    c.fillRect(x + 5 * u, y + 9 * u, 7 * u, 7 * u);
    c.fillRect(x + 16 * u, y + 9 * u, 7 * u, 7 * u);
  } else if (skinId === "slime") {
    c.fillStyle = "#3e9c2e";
    c.fillRect(x + 6 * u, y + 9 * u, 4 * u, 6 * u);
    c.fillRect(x + 18 * u, y + 9 * u, 4 * u, 6 * u);
    c.fillRect(x + 9 * u, y + 19 * u, 10 * u, 3 * u); // smile
  } else if (skinId === "gold") {
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillRect(x + 4 * u, y + 3 * u, 4 * u, 10 * u);  // shine
    c.fillStyle = "#7a5b00";
    c.fillRect(x + 7 * u, y + 12 * u, 5 * u, 5 * u);
    c.fillRect(x + 16 * u, y + 12 * u, 5 * u, 5 * u);
  } else if (skinId === "bee") {
    c.fillStyle = "#23232e";
    c.fillRect(x, y + 9 * u, s, 4 * u);   // stripes
    c.fillRect(x, y + 18 * u, s, 4 * u);
    const flap = Math.abs(Math.sin(t * 22)) * 4 * u;
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillRect(x - 6 * u, y - 2 * u - flap, 7 * u, 7 * u); // wings
    c.fillRect(x + s - u, y - 2 * u - flap, 7 * u, 7 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 2 * u, 4 * u, 4 * u);
    c.fillRect(x + 18 * u, y + 2 * u, 4 * u, 4 * u);
  } else if (skinId === "frog") {
    c.fillStyle = "#3e9c2e";
    c.fillRect(x + 2 * u, y - 6 * u, 8 * u, 7 * u);   // eye bumps
    c.fillRect(x + 18 * u, y - 6 * u, 8 * u, 7 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 4 * u, y - 4 * u, 5 * u, 5 * u);
    c.fillRect(x + 20 * u, y - 4 * u, 5 * u, 5 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y - 3 * u, 3 * u, 3 * u);
    c.fillRect(x + 22 * u, y - 3 * u, 3 * u, 3 * u);
    c.fillRect(x + 7 * u, y + 16 * u, 14 * u, 3 * u); // wide smile
  } else if (skinId === "cat") {
    c.fillStyle = "#b86a2e";
    c.fillRect(x + 2 * u, y - 6 * u, 6 * u, 7 * u);   // ears
    c.fillRect(x + 20 * u, y - 6 * u, 6 * u, 7 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillRect(x + 12 * u, y + 17 * u, 4 * u, 3 * u); // nose
    c.fillStyle = "#fff";
    c.fillRect(x - 4 * u, y + 18 * u, 7 * u, 2 * u);  // whiskers
    c.fillRect(x + 25 * u, y + 18 * u, 7 * u, 2 * u);
  } else if (skinId === "fire") {
    c.fillStyle = "#ffd84d";
    for (let i = 0; i < 4; i++) {                     // flickering flames
      const fh = (4 + Math.abs(Math.sin(t * 10 + i * 2)) * 6) * u;
      c.fillRect(x + (2 + i * 7) * u, y - fh, 4 * u, fh);
    }
    c.fillStyle = "#ffe680";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 6 * u);
  } else if (skinId === "ice") {
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.fillRect(x + 3 * u, y + 3 * u, 4 * u, 12 * u);  // icy shine
    c.fillStyle = "#2d5d8f";
    c.fillRect(x + 7 * u, y + 10 * u, 5 * u, 6 * u);
    c.fillRect(x + 17 * u, y + 10 * u, 5 * u, 6 * u);
  } else if (skinId === "alien") {
    const g = (3 + Math.sin(t * 4) * 2) * u;          // pulsing glow
    c.fillStyle = "rgba(124,252,0,0.25)";
    c.fillRect(x - g, y - g, s + g * 2, s + g * 2);
    c.fillStyle = body;
    c.fillRect(x, y, s, s);
    c.fillStyle = "#3e9c2e";
    c.fillRect(x + 12 * u, y - 7 * u, 3 * u, 7 * u);  // antenna
    c.fillRect(x + 10 * u, y - 11 * u, 7 * u, 5 * u);
    const blink = (t % 3) > 2.8;                      // blinks every 3s
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 4 * u, y + 8 * u, 8 * u, blink ? 2 * u : 10 * u);
    c.fillRect(x + 16 * u, y + 8 * u, 8 * u, blink ? 2 * u : 10 * u);
  } else if (skinId === "pumpkin") {
    c.fillStyle = "#2e7d32";
    c.fillRect(x + 11 * u, y - 6 * u, 5 * u, 6 * u);  // stem
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 5 * u, y + 8 * u, 7 * u, 5 * u);   // carved eyes
    c.fillRect(x + 16 * u, y + 8 * u, 7 * u, 5 * u);
    c.fillRect(x + 5 * u, y + 17 * u, 18 * u, 3 * u); // jagged mouth
    c.fillRect(x + 8 * u, y + 20 * u, 4 * u, 3 * u);
    c.fillRect(x + 16 * u, y + 20 * u, 4 * u, 3 * u);
  } else if (skinId === "star") {
    c.fillStyle = "#fff";                             // diamond shine
    c.beginPath();
    c.moveTo(x + 14 * u, y + 4 * u);
    c.lineTo(x + 21 * u, y + 12 * u);
    c.lineTo(x + 14 * u, y + 20 * u);
    c.lineTo(x + 7 * u, y + 12 * u);
    c.fill();
    c.fillStyle = "#b8860b";
    c.fillRect(x + 10 * u, y + 9 * u, 3 * u, 5 * u);
    c.fillRect(x + 15 * u, y + 9 * u, 3 * u, 5 * u);
  } else if (skinId === "puppy") {
    c.fillStyle = "#8a5a30";                          // floppy ears
    c.fillRect(x - 3 * u, y - 2 * u, 6 * u, 12 * u);
    c.fillRect(x + s - 3 * u, y - 2 * u, 6 * u, 12 * u);
    const wag = Math.sin(t * 12) * 4 * u;             // wagging tail
    c.fillRect(x - 9 * u, y + 12 * u + wag, 6 * u, 4 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 8 * u, 5 * u, 6 * u);
    c.fillRect(x + 17 * u, y + 8 * u, 5 * u, 6 * u);
    c.fillRect(x + 11 * u, y + 16 * u, 6 * u, 4 * u); // nose
    c.fillStyle = "#ff8de8";
    c.fillRect(x + 12 * u, y + 22 * u, 4 * u, 4 * u); // tongue
  } else if (skinId === "bunny") {
    c.fillStyle = "#f5f5f5";                          // tall ears
    c.fillRect(x + 5 * u, y - 12 * u, 6 * u, 13 * u);
    c.fillRect(x + 17 * u, y - 12 * u, 6 * u, 13 * u);
    c.fillStyle = "#ffb3d9";                          // pink inner ears
    c.fillRect(x + 7 * u, y - 9 * u, 2 * u, 8 * u);
    c.fillRect(x + 19 * u, y - 9 * u, 2 * u, 8 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 9 * u, 4 * u, 5 * u);
    c.fillRect(x + 18 * u, y + 9 * u, 4 * u, 5 * u);
    c.fillStyle = "#ffb3d9";
    c.fillRect(x + 12 * u, y + 15 * u, 4 * u, 3 * u); // pink nose
  } else if (skinId === "chick") {
    c.fillStyle = "#ff9d2e";
    c.fillRect(x + 12 * u, y - 4 * u, 4 * u, 4 * u);  // tuft
    c.fillRect(x + 11 * u, y + 14 * u, 6 * u, 4 * u); // beak
    const wf = Math.abs(Math.sin(t * 14)) * 4 * u;    // flapping winglets
    c.fillStyle = "#ffd84d";
    c.fillRect(x - 5 * u, y + 10 * u - wf, 5 * u, 8 * u);
    c.fillRect(x + s, y + 10 * u - wf, 5 * u, 8 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 7 * u, 4 * u, 5 * u);
    c.fillRect(x + 18 * u, y + 7 * u, 4 * u, 5 * u);
  } else if (skinId === "duck") {
    c.fillStyle = "#ff9d2e";                          // flat bill
    c.fillRect(x + 8 * u, y + 14 * u, 12 * u, 5 * u);
    c.fillRect(x + 10 * u, y + 19 * u, 8 * u, 2 * u);
    c.fillRect(x + 13 * u, y - 4 * u, 3 * u, 4 * u);  // head feather
    const wig = Math.sin(t * 10) * 2 * u;             // wiggling tail feather
    c.fillStyle = "#fff3b0";
    c.fillRect(x - 6 * u, y + 6 * u + wig, 6 * u, 5 * u);
    c.fillRect(x + 9 * u, y + 23 * u, 10 * u, 3 * u); // belly patch
    c.fillStyle = "#1a1a2e";                          // eyes
    c.fillRect(x + 6 * u, y + 6 * u, 4 * u, 5 * u);
    c.fillRect(x + 18 * u, y + 6 * u, 4 * u, 5 * u);
  } else if (skinId === "fish") {
    const swish = Math.sin(t * 8) * 2 * u;            // swishing tail fin
    c.fillStyle = "#2d5d8f";
    c.fillRect(x - 7 * u, y + 8 * u + swish, 7 * u, 12 * u);
    c.fillRect(x + 8 * u, y - 5 * u, 12 * u, 5 * u);  // top fin
    c.fillStyle = "#7db8e8";                          // gill lines
    c.fillRect(x + 5 * u, y + 8 * u, 2 * u, 12 * u);
    c.fillRect(x + 10 * u, y + 6 * u, 2 * u, 16 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 16 * u, y + 8 * u, 7 * u, 7 * u);  // big eye
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 19 * u, y + 10 * u, 4 * u, 4 * u);
  } else if (skinId === "panda") {
    c.fillStyle = "#23232e";
    c.fillRect(x + 1 * u, y - 5 * u, 7 * u, 6 * u);   // ears
    c.fillRect(x + 20 * u, y - 5 * u, 7 * u, 6 * u);
    c.fillRect(x + 4 * u, y + 7 * u, 8 * u, 8 * u);   // eye patches
    c.fillRect(x + 16 * u, y + 7 * u, 8 * u, 8 * u);
    c.fillRect(x + 11 * u, y + 17 * u, 6 * u, 4 * u); // nose
    c.fillStyle = "#fff";
    c.fillRect(x + 6 * u, y + 9 * u, 3 * u, 3 * u);   // eye shine
    c.fillRect(x + 18 * u, y + 9 * u, 3 * u, 3 * u);
  } else if (skinId === "cactus") {
    c.fillStyle = "#2e7d32";
    for (let i = 0; i < 5; i++) {
      c.fillRect(x - 2 * u, y + (4 + i * 5) * u, 3 * u, 4 * u);
      c.fillRect(x + s - u, y + (6 + i * 5) * u, 3 * u, 4 * u);
    }
    c.fillStyle = "#ff6b9d";
    c.fillRect(x + 10 * u, y - 5 * u, 8 * u, 5 * u);  // flower
    c.fillStyle = "#ffd84d";
    c.fillRect(x + 12 * u, y - 3 * u, 4 * u, 3 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 7 * u, y + 10 * u, 4 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 10 * u, 4 * u, 5 * u);
    c.fillRect(x + 11 * u, y + 17 * u, 6 * u, 3 * u); // smile
  } else if (skinId === "tiger") {
    c.fillStyle = "#23232e";
    c.fillRect(x, y + 8 * u, s, 3 * u);               // stripes
    c.fillRect(x, y + 14 * u, s, 3 * u);
    c.fillRect(x, y + 20 * u, s, 3 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 4 * u, y + 12 * u, 6 * u, 5 * u);  // muzzle
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 8 * u, 5 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 8 * u, 5 * u, 5 * u);
    c.fillRect(x + 12 * u, y + 15 * u, 4 * u, 3 * u); // nose
    c.fillStyle = "#ff9d2e";
    c.fillRect(x + 2 * u, y + 17 * u, 6 * u, 2 * u);  // whiskers
    c.fillRect(x + 20 * u, y + 17 * u, 6 * u, 2 * u);
  } else if (skinId === "bear") {
    c.fillStyle = "#6b4423";
    c.fillRect(x + 2 * u, y - 5 * u, 7 * u, 6 * u);   // round ears
    c.fillRect(x + 19 * u, y - 5 * u, 7 * u, 6 * u);
    c.fillStyle = "#d2a679";
    c.fillRect(x + 8 * u, y + 12 * u, 12 * u, 8 * u); // snout
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 8 * u, 5 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 8 * u, 5 * u, 5 * u);
    c.fillRect(x + 12 * u, y + 14 * u, 4 * u, 3 * u);
  } else if (skinId === "penguin") {
    c.fillStyle = "#fff";
    c.fillRect(x + 7 * u, y + 10 * u, 14 * u, 16 * u); // belly
    c.fillStyle = "#ff9d2e";
    c.fillRect(x + 10 * u, y + 14 * u, 8 * u, 5 * u);  // beak
    c.fillRect(x - 4 * u, y + 14 * u, 5 * u, 10 * u);  // flipper
    c.fillRect(x + s - u, y + 14 * u, 5 * u, 10 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 6 * u, y + 6 * u, 4 * u, 5 * u);    // eye patches
    c.fillRect(x + 18 * u, y + 6 * u, 4 * u, 5 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 7 * u, y + 7 * u, 3 * u, 4 * u);
    c.fillRect(x + 18 * u, y + 7 * u, 3 * u, 4 * u);
  } else if (skinId === "fox") {
    c.fillStyle = "#fff";
    c.fillRect(x + 4 * u, y + 12 * u, 6 * u, 6 * u);   // cheek fluff
    c.fillRect(x + 18 * u, y + 12 * u, 6 * u, 6 * u);
    const tail = Math.sin(t * 10) * 3 * u;
    c.fillStyle = "#e86d2d";
    c.fillRect(x - 10 * u, y + 10 * u + tail, 8 * u, 12 * u); // bushy tail
    c.fillStyle = "#fff";
    c.fillRect(x - 8 * u, y + 12 * u + tail, 4 * u, 6 * u);
    c.fillStyle = "#23232e";
    c.fillRect(x + 3 * u, y - 5 * u, 6 * u, 7 * u);    // pointy ears
    c.fillRect(x + 19 * u, y - 5 * u, 6 * u, 7 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 8 * u, 5 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 8 * u, 5 * u, 5 * u);
    c.fillRect(x + 11 * u, y + 15 * u, 6 * u, 4 * u);  // nose
  } else if (skinId === "owl") {
    c.fillStyle = "#8a6a42";
    c.fillRect(x + 2 * u, y - 8 * u, 7 * u, 9 * u);    // ear tufts
    c.fillRect(x + 19 * u, y - 8 * u, 7 * u, 9 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 4 * u, y + 6 * u, 9 * u, 10 * u);   // big eyes
    c.fillRect(x + 15 * u, y + 6 * u, 9 * u, 10 * u);
    c.fillStyle = "#ff9d2e";
    c.fillRect(x + 11 * u, y + 16 * u, 6 * u, 4 * u);  // beak
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 7 * u, y + 9 * u, 5 * u, 5 * u);
    c.fillRect(x + 16 * u, y + 9 * u, 5 * u, 5 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 8 * u, y + 10 * u, 2 * u, 2 * u);   // eye shine
    c.fillRect(x + 17 * u, y + 10 * u, 2 * u, 2 * u);
  } else if (skinId === "zombie") {
    c.fillStyle = "#5a7a4a";
    c.fillRect(x + 3 * u, y + 4 * u, 22 * u, 3 * u);   // forehead stitch
    c.fillStyle = "#3a4a32";
    c.fillRect(x + 8 * u, y + 7 * u, 12 * u, 2 * u);
    c.fillStyle = "#ff5050";
    c.fillRect(x + 5 * u, y + 9 * u, 6 * u, 6 * u);    // droopy eye
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillRect(x + 7 * u, y + 11 * u, 3 * u, 3 * u);
    c.fillStyle = "#6ee84d";
    c.fillRect(x + 9 * u, y + 18 * u, 10 * u, 3 * u);  // dripping mouth
    c.fillRect(x + 11 * u, y + 21 * u, 3 * u, 4 * u);
  } else if (skinId === "astronaut") {
    c.fillStyle = "#9aa7b8";
    c.fillRect(x + 2 * u, y + 18 * u, 24 * u, 8 * u);  // suit base
    c.fillStyle = "#1a2a4a";
    c.fillRect(x + 5 * u, y + 4 * u, 18 * u, 14 * u);  // visor
    c.fillStyle = "#4d7de8";
    c.fillRect(x + 8 * u, y + 7 * u, 12 * u, 8 * u);   // visor reflection
    c.fillStyle = "#fff";
    c.fillRect(x + 10 * u, y + 8 * u, 4 * u, 3 * u);
    c.fillStyle = "#e84d4d";
    c.fillRect(x + 11 * u, y + 20 * u, 6 * u, 4 * u);  // chest badge
    c.fillStyle = "#6b7787";
    c.fillRect(x - 4 * u, y + 10 * u, 5 * u, 12 * u);  // backpack
  } else if (skinId === "unicorn") {
    c.fillStyle = "#ff8de8";
    c.fillRect(x + 3 * u, y - 3 * u, 4 * u, 5 * u);    // mane
    c.fillRect(x + 10 * u, y - 5 * u, 4 * u, 6 * u);
    c.fillRect(x + 17 * u, y - 3 * u, 4 * u, 5 * u);
    c.fillStyle = "#b06aff";
    c.fillRect(x + 12 * u, y - 12 * u, 4 * u, 10 * u); // horn
    c.fillStyle = "#ffd84d";
    c.fillRect(x + 11 * u, y - 14 * u, 6 * u, 3 * u);
    c.fillStyle = "#4d7de8";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 6 * u);    // sparkly eyes
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillStyle = "#ff8de8";
    c.fillRect(x + 11 * u, y + 17 * u, 6 * u, 3 * u);  // nose
  } else if (skinId === "vampire") {
    c.fillStyle = "#1a0a24";
    c.fillRect(x + 3 * u, y - 2 * u, 22 * u, 6 * u);   // hair
    c.fillStyle = "#e84d4d";
    c.fillRect(x + 4 * u, y + 14 * u, 20 * u, 10 * u); // cape collar
    c.fillStyle = "#ff5050";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 5 * u);    // red eyes
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 5 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 10 * u, y + 16 * u, 3 * u, 5 * u);  // fangs
    c.fillRect(x + 15 * u, y + 16 * u, 3 * u, 5 * u);
  } else if (skinId === "phoenix") {
    const flap = Math.abs(Math.sin(t * 16)) * 5 * u;
    c.fillStyle = "#ffd84d";
    c.fillRect(x - 8 * u, y + 4 * u - flap, 9 * u, 14 * u);  // wings
    c.fillRect(x + s - u, y + 4 * u - flap, 9 * u, 14 * u);
    c.fillStyle = "#ff6b2d";
    c.fillRect(x - 6 * u, y + 6 * u - flap, 5 * u, 10 * u);
    c.fillRect(x + s + u, y + 6 * u - flap, 5 * u, 10 * u);
    c.fillStyle = "#ffd84d";
    c.fillRect(x + 10 * u, y - 6 * u, 8 * u, 6 * u);   // crest
    c.fillStyle = "#fff";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 8 * u, y + 10 * u, 3 * u, 4 * u);
    c.fillRect(x + 17 * u, y + 10 * u, 3 * u, 4 * u);
  } else if (skinId === "crystal") {
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.fillRect(x + 3 * u, y + 2 * u, 4 * u, 14 * u);   // facet shine
    c.fillRect(x + 14 * u, y + 6 * u, 3 * u, 16 * u);
    c.fillStyle = "#9b7bff";
    c.fillRect(x + 6 * u, y + 4 * u, 16 * u, 3 * u);
    c.fillRect(x + 8 * u, y + 18 * u, 12 * u, 3 * u);
    c.fillStyle = "#6b4fd4";
    c.fillRect(x + 7 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillRect(x + 16 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 8 * u, y + 10 * u, 2 * u, 2 * u);
    c.fillRect(x + 17 * u, y + 10 * u, 2 * u, 2 * u);
  } else if (skinId === "dragon") {
    c.fillStyle = "#2e7d32";                          // horns
    c.fillRect(x + 3 * u, y - 6 * u, 5 * u, 6 * u);
    c.fillRect(x + 12 * u, y - 9 * u, 5 * u, 9 * u);
    c.fillRect(x + 21 * u, y - 6 * u, 5 * u, 6 * u);
    c.fillStyle = "#ffd84d";                          // fierce eyes
    c.fillRect(x + 6 * u, y + 8 * u, 6 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 8 * u, 6 * u, 5 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 9 * u, y + 9 * u, 3 * u, 3 * u);
    c.fillRect(x + 18 * u, y + 9 * u, 3 * u, 3 * u);
    c.fillStyle = "#23232e";                          // nostrils
    c.fillRect(x + 8 * u, y + 18 * u, 3 * u, 3 * u);
    c.fillRect(x + 17 * u, y + 18 * u, 3 * u, 3 * u);
  } else if (skinId === "shadow") {
    // purple aura outline so the pitch-black body shows against the dark sky
    c.fillStyle = "#7a4ab0";
    c.fillRect(x - 2 * u, y - 2 * u, s + 4 * u, 2 * u);
    c.fillRect(x - 2 * u, y + s, s + 4 * u, 2 * u);
    c.fillRect(x - 2 * u, y, 2 * u, s);
    c.fillRect(x + s, y, 2 * u, s);
    c.fillStyle = "#b06aff";                          // glowing purple eyes
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 6 * u);
  } else if (skinId === "king") {
    c.fillStyle = "#ffd84d";                          // crown
    c.fillRect(x + 4 * u, y - 5 * u, 20 * u, 5 * u);
    c.fillRect(x + 4 * u, y - 10 * u, 4 * u, 5 * u);
    c.fillRect(x + 12 * u, y - 10 * u, 4 * u, 5 * u);
    c.fillRect(x + 20 * u, y - 10 * u, 4 * u, 5 * u);
    c.fillStyle = "#e84d4d";
    c.fillRect(x + 13 * u, y - 4 * u, 3 * u, 3 * u);  // jewel
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillRect(x + 9 * u, y + 18 * u, 10 * u, 2 * u); // smile
  } else if (skinId === "mouse") {
    c.fillStyle = "#a0a0b0";
    c.fillRect(x + 1 * u, y - 6 * u, 9 * u, 9 * u);   // big ears
    c.fillRect(x + 18 * u, y - 6 * u, 9 * u, 9 * u);
    c.fillStyle = "#ffb3d9";
    c.fillRect(x + 3 * u, y - 4 * u, 5 * u, 5 * u);
    c.fillRect(x + 20 * u, y - 4 * u, 5 * u, 5 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 10 * u, 4 * u, 5 * u);
    c.fillRect(x + 18 * u, y + 10 * u, 4 * u, 5 * u);
    c.fillStyle = "#ffb3d9";
    c.fillRect(x + 12 * u, y + 16 * u, 4 * u, 3 * u); // nose
  } else if (skinId === "monkey") {
    c.fillStyle = "#7a4a28";
    c.fillRect(x - 3 * u, y + 4 * u, 7 * u, 7 * u);   // ears
    c.fillRect(x + s - 4 * u, y + 4 * u, 7 * u, 7 * u);
    c.fillStyle = "#d2a679";
    c.fillRect(x + 5 * u, y + 10 * u, 18 * u, 12 * u); // face patch
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 7 * u, y + 9 * u, 4 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 9 * u, 4 * u, 5 * u);
    c.fillRect(x + 12 * u, y + 16 * u, 4 * u, 3 * u); // nose
  } else if (skinId === "pig") {
    c.fillStyle = "#f07a96";
    c.fillRect(x + 2 * u, y - 3 * u, 6 * u, 6 * u);   // ears
    c.fillRect(x + 20 * u, y - 3 * u, 6 * u, 6 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 9 * u, 4 * u, 4 * u);
    c.fillRect(x + 18 * u, y + 9 * u, 4 * u, 4 * u);
    c.fillStyle = "#f07a96";
    c.fillRect(x + 9 * u, y + 15 * u, 10 * u, 7 * u); // snout
    c.fillStyle = "#c25a73";
    c.fillRect(x + 11 * u, y + 17 * u, 2 * u, 3 * u);
    c.fillRect(x + 15 * u, y + 17 * u, 2 * u, 3 * u);
  } else if (skinId === "cow") {
    c.fillStyle = "#23232e";
    c.fillRect(x + 2 * u, y + 3 * u, 7 * u, 6 * u);   // spots
    c.fillRect(x + 18 * u, y + 16 * u, 8 * u, 6 * u);
    c.fillStyle = "#f5f5f5";
    c.fillRect(x - 2 * u, y + 4 * u, 5 * u, 5 * u);   // ears
    c.fillRect(x + s - 3 * u, y + 4 * u, 5 * u, 5 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 9 * u, 4 * u, 4 * u);
    c.fillRect(x + 18 * u, y + 9 * u, 4 * u, 4 * u);
    c.fillStyle = "#ffb3d9";
    c.fillRect(x + 9 * u, y + 15 * u, 10 * u, 6 * u); // muzzle
  } else if (skinId === "lion") {
    c.fillStyle = "#b5731f";                          // mane ring
    c.fillRect(x - 4 * u, y - 4 * u, s + 8 * u, 5 * u);
    c.fillRect(x - 4 * u, y + s - u, s + 8 * u, 5 * u);
    c.fillRect(x - 4 * u, y - 4 * u, 5 * u, s + 8 * u);
    c.fillRect(x + s - u, y - 4 * u, 5 * u, s + 8 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 5 * u);
    c.fillStyle = "#5a3a1a";
    c.fillRect(x + 11 * u, y + 16 * u, 6 * u, 4 * u); // muzzle
  } else if (skinId === "wolf") {
    c.fillStyle = "#4a5560";
    c.fillRect(x + 2 * u, y - 6 * u, 6 * u, 8 * u);   // ears
    c.fillRect(x + 20 * u, y - 6 * u, 6 * u, 8 * u);
    c.fillStyle = "#c0c8d0";
    c.fillRect(x + 9 * u, y + 14 * u, 10 * u, 8 * u); // snout
    c.fillStyle = "#ffd84d";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 5 * u);   // eyes
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 5 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 12 * u, y + 15 * u, 4 * u, 3 * u); // nose
  } else if (skinId === "mushroom") {
    c.fillStyle = "#fff";
    c.fillRect(x + 4 * u, y + 3 * u, 5 * u, 5 * u);   // cap spots
    c.fillRect(x + 16 * u, y + 5 * u, 5 * u, 5 * u);
    c.fillRect(x + 11 * u, y + 2 * u, 4 * u, 4 * u);
    c.fillStyle = "#f0e0c0";
    c.fillRect(x + 6 * u, y + 17 * u, 16 * u, 9 * u); // stem
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 8 * u, y + 18 * u, 4 * u, 5 * u);
    c.fillRect(x + 16 * u, y + 18 * u, 4 * u, 5 * u);
  } else if (skinId === "snake") {
    c.fillStyle = "#3e9c2e";
    c.fillRect(x + 4 * u, y + 4 * u, s - 8 * u, 3 * u); // pattern
    c.fillRect(x + 4 * u, y + 14 * u, s - 8 * u, 3 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 8 * u, 4 * u, 5 * u);
    c.fillRect(x + 18 * u, y + 8 * u, 4 * u, 5 * u);
    const tongue = (t % 0.6) < 0.3 ? 6 * u : 2 * u;  // flick
    c.fillStyle = "#ff5050";
    c.fillRect(x + 13 * u, y + 20 * u, 2 * u, tongue);
  } else if (skinId === "crab") {
    c.fillStyle = "#c23030";
    c.fillRect(x - 6 * u, y + 12 * u, 7 * u, 6 * u);  // claws
    c.fillRect(x + s - u, y + 12 * u, 7 * u, 6 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 7 * u, y + 2 * u, 3 * u, 6 * u);   // eye stalks
    c.fillRect(x + 18 * u, y + 2 * u, 3 * u, 6 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 7 * u, y + 2 * u, 3 * u, 3 * u);
    c.fillRect(x + 18 * u, y + 2 * u, 3 * u, 3 * u);
    c.fillRect(x + 9 * u, y + 16 * u, 10 * u, 2 * u); // mouth
  } else if (skinId === "snowman") {
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 7 * u, y + 8 * u, 4 * u, 4 * u);   // coal eyes
    c.fillRect(x + 17 * u, y + 8 * u, 4 * u, 4 * u);
    c.fillRect(x + 11 * u, y + 18 * u, 3 * u, 3 * u); // coal buttons
    c.fillRect(x + 11 * u, y + 23 * u, 3 * u, 3 * u);
    c.fillStyle = "#ff8c00";
    c.fillRect(x + 13 * u, y + 12 * u, 7 * u, 3 * u); // carrot nose
  } else if (skinId === "dino") {
    c.fillStyle = "#2e7d32";
    c.fillRect(x + 4 * u, y - 5 * u, 4 * u, 5 * u);   // back spikes
    c.fillRect(x + 12 * u, y - 6 * u, 4 * u, 6 * u);
    c.fillRect(x + 20 * u, y - 5 * u, 4 * u, 5 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 8 * u, 5 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 8 * u, 5 * u, 5 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 7 * u, y + 18 * u, 14 * u, 3 * u); // teeth
  } else if (skinId === "shark") {
    c.fillStyle = "#5a7a90";
    c.fillRect(x + 9 * u, y - 7 * u, 8 * u, 7 * u);   // dorsal fin
    c.fillStyle = "#dfe8ee";
    c.fillRect(x + 5 * u, y + 16 * u, 18 * u, 8 * u); // belly
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 8 * u, 4 * u, 4 * u);
    c.fillRect(x + 18 * u, y + 8 * u, 4 * u, 4 * u);
    c.fillStyle = "#fff";
    c.fillRect(x + 7 * u, y + 17 * u, 14 * u, 2 * u); // teeth
  } else if (skinId === "clown") {
    c.fillStyle = "#ff5050";
    c.fillRect(x - 2 * u, y + 4 * u, 5 * u, 6 * u);   // hair
    c.fillRect(x + s - 3 * u, y + 4 * u, 5 * u, 6 * u);
    c.fillStyle = "#4d7de8";
    c.fillRect(x + 6 * u, y + 8 * u, 4 * u, 4 * u);   // eyes
    c.fillRect(x + 18 * u, y + 8 * u, 4 * u, 4 * u);
    c.fillStyle = "#ff5050";
    c.fillRect(x + 11 * u, y + 13 * u, 6 * u, 5 * u); // red nose
    c.fillRect(x + 8 * u, y + 20 * u, 12 * u, 3 * u); // smile
  } else if (skinId === "octopus") {
    c.fillStyle = "#9b4fe0";
    for (let i = 0; i < 4; i++) {
      const wig = Math.sin(t * 6 + i) * 2 * u;        // wiggling tentacles
      c.fillRect(x + (2 + i * 6) * u, y + s - 2 * u + wig, 4 * u, 6 * u);
    }
    c.fillStyle = "#fff";
    c.fillRect(x + 6 * u, y + 9 * u, 6 * u, 6 * u);
    c.fillRect(x + 16 * u, y + 9 * u, 6 * u, 6 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 8 * u, y + 11 * u, 3 * u, 3 * u);
    c.fillRect(x + 18 * u, y + 11 * u, 3 * u, 3 * u);
  } else if (skinId === "skeleton") {
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 5 * u, y + 7 * u, 6 * u, 7 * u);   // eye sockets
    c.fillRect(x + 17 * u, y + 7 * u, 6 * u, 7 * u);
    c.fillRect(x + 9 * u, y + 16 * u, 2 * u, 8 * u);  // ribs
    c.fillRect(x + 13 * u, y + 16 * u, 2 * u, 8 * u);
    c.fillRect(x + 17 * u, y + 16 * u, 2 * u, 8 * u);
    c.fillRect(x + 10 * u, y + 15 * u, 8 * u, 2 * u); // teeth line
  } else if (skinId === "devil") {
    c.fillStyle = "#8a1a1a";
    c.fillRect(x + 3 * u, y - 6 * u, 4 * u, 7 * u);   // horns
    c.fillRect(x + 21 * u, y - 6 * u, 4 * u, 7 * u);
    c.fillStyle = "#ffd84d";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 5 * u);   // glowing eyes
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 5 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 8 * u, y + 17 * u, 12 * u, 3 * u); // grin
  } else if (skinId === "angel") {
    c.fillStyle = "#ffd84d";
    c.fillRect(x + 8 * u, y - 7 * u, 12 * u, 3 * u);  // halo
    c.fillStyle = "#f0f0ff";
    c.fillRect(x - 4 * u, y + 8 * u, 5 * u, 10 * u);  // wings
    c.fillRect(x + s - u, y + 8 * u, 5 * u, 10 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 10 * u, 5 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 10 * u, 5 * u, 5 * u);
  } else if (skinId === "knight") {
    c.fillStyle = "#e84d4d";
    c.fillRect(x + 11 * u, y - 6 * u, 4 * u, 7 * u);  // plume
    c.fillStyle = "#6b7787";
    c.fillRect(x + 3 * u, y + 3 * u, 22 * u, 6 * u);  // helmet brow
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 11 * u, 16 * u, 4 * u); // visor slit
    c.fillStyle = "#c0c8d0";
    c.fillRect(x + 4 * u, y + 18 * u, 20 * u, 3 * u);
  } else if (skinId === "mermaid") {
    c.fillStyle = "#ff8de8";
    c.fillRect(x + 1 * u, y + 2 * u, 5 * u, 14 * u);  // hair
    c.fillRect(x + 22 * u, y + 2 * u, 5 * u, 14 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 7 * u, y + 9 * u, 4 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 9 * u, 4 * u, 5 * u);
    c.fillStyle = "#2aa198";
    c.fillRect(x + 4 * u, y + s - 2 * u, 20 * u, 5 * u); // tail fin
  } else if (skinId === "yeti") {
    c.fillStyle = "#d8e4f0";
    c.fillRect(x - 3 * u, y + 4 * u, 5 * u, 16 * u);  // side fluff
    c.fillRect(x + s - 2 * u, y + 4 * u, 5 * u, 16 * u);
    c.fillStyle = "#c0d0e0";
    c.fillRect(x + 4 * u, y - 4 * u, 5 * u, 5 * u);   // horns
    c.fillRect(x + 19 * u, y - 4 * u, 5 * u, 5 * u);
    c.fillStyle = "#1a1a2e";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 5 * u);
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 5 * u);
    c.fillStyle = "#4d7de8";
    c.fillRect(x + 9 * u, y + 18 * u, 10 * u, 3 * u); // mouth
  } else if (skinId === "diamond") {
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillRect(x + 4 * u, y + 2 * u, 4 * u, 16 * u);  // facet shine
    c.fillRect(x + 13 * u, y + 5 * u, 3 * u, 14 * u);
    c.fillStyle = "#7db8e8";
    c.fillRect(x + 6 * u, y + 4 * u, 16 * u, 3 * u);
    c.fillRect(x + 8 * u, y + 19 * u, 12 * u, 3 * u);
    c.fillStyle = "#2d5d8f";
    c.fillRect(x + 7 * u, y + 9 * u, 5 * u, 5 * u);
    c.fillRect(x + 16 * u, y + 9 * u, 5 * u, 5 * u);
  } else {
    // default eyes
    c.fillStyle = skinId === "ninja" ? "#fff" : "#1a1a2e";
    c.fillRect(x + 6 * u, y + 9 * u, 5 * u, 6 * u);
    c.fillRect(x + 17 * u, y + 9 * u, 5 * u, 6 * u);
  }

  c.globalAlpha = 1;
}

function drawUFO(c, x, y, s, t) {
  const u = s / 28;
  c.fillStyle = "#9fe8ff";
  c.fillRect(x + 8 * u, y, 12 * u, 9 * u);
  c.fillStyle = "#444c5c";
  c.fillRect(x + 11 * u, y + 3 * u, 6 * u, 4 * u);
  c.fillStyle = "#9aa7b8";
  c.fillRect(x - 2 * u, y + 9 * u, 32 * u, 9 * u);
  c.fillStyle = "#6b7787";
  c.fillRect(x + 3 * u, y + 18 * u, 22 * u, 4 * u);
  for (let i = 0; i < 4; i++) {
    c.fillStyle = (Math.floor(t * 6) + i) % 2 === 0 ? "#ff5050" : "#ffd84d";
    c.fillRect(x + (1 + i * 8) * u, y + 11 * u, 4 * u, 5 * u);
  }
}

/* ---------------- Avatar + item effects (particles) ---------------- */

let particles = [];
let fxTimer = 0;
let skinFxTimer = 0;
let idleTime = 0;
let wasGrounded = true;

function spawnParticle(p) {
  particles.push(p);
  if (particles.length > 150) particles.shift();
}

// Cactus sand: each platform keeps a map of (local x -> pile height) that
// builds up where the cactus stands and persists for the rest of the obby.
const SAND_BUCKET = 5;   // pile spacing along the block
const SAND_MAX = 9;      // tallest a pile can grow
function depositSand(plat, footX) {
  if (!plat.sand) plat.sand = {};
  let local = Math.round((footX - plat.x) / SAND_BUCKET) * SAND_BUCKET;
  local = clamp(local, SAND_BUCKET, Math.max(SAND_BUCKET, plat.w - SAND_BUCKET));
  const grown = (plat.sand[local] || 0) + 0.9;
  plat.sand[local] = Math.min(SAND_MAX, Math.max(grown, 3)); // first touch leaves a small mound
}

function updateItemEffects(dt) {
  if (state === "playing") {
    const moving = Math.abs(player.vx) > 1 || Math.abs(player.vy) > 1;
    fxTimer -= dt;
    if (fxTimer <= 0) {
      fxTimer = 0.12;
      for (const slot of ITEM_SLOTS) {
        const it = getEquipped(slot);
        if (!it || !it.fx) continue;
        if (it.fx === "fire" && !moving) continue;
        if (it.fx === "sparkle") {
          spawnParticle({
            x: player.x - 6 + Math.random() * (P_SIZE + 12),
            y: player.y - 6 + Math.random() * (P_SIZE + 12),
            life: 0.8, decay: 1.2, color: it.fxColor || "#fff",
            size: 6, kind: "spark",
          });
        } else if (it.fx === "fire") {
          const dir = player.vx > 0 ? 1 : player.vx < 0 ? -1 : -1;
          spawnParticle({
            x: player.x + P_SIZE / 2 + dir * 14, y: player.y + 16,
            vx: dir * 70, vy: -15 + Math.random() * 20,
            life: 0.6, decay: 1.4,
            color: Math.random() < 0.5 ? "#ff6b2d" : "#ffd84d",
            size: 7, kind: "blob",
          });
        } else if (it.fx === "confetti") {
          const cols = ["#ff5050", "#4d7de8", "#ffd84d", "#7CFC00", "#ff8de8"];
          spawnParticle({
            x: player.x - 6 + Math.random() * (P_SIZE + 12),
            y: player.y - 10, vy: 40, life: 0.8, decay: 1.1,
            color: cols[Math.floor(Math.random() * cols.length)],
            size: 5, kind: "blob",
          });
        } else if (it.fx === "hearts") {
          spawnParticle({
            x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y - 4,
            vy: -35, life: 0.9, decay: 1.1, color: "#ff6b9d", kind: "heart",
          });
        } else if (it.fx === "bubbles") {
          spawnParticle({
            x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + 4,
            vy: -45, life: 0.9, decay: 1.0, color: "#aee3ff", size: 7, kind: "bubble",
          });
        }
      }
    }
  }
  for (const p of particles) {
    p.life -= p.decay * dt;
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
  }
  particles = particles.filter(p => p.life > 0);
}

function updateSkinEffects(dt) {
  if (state !== "playing") return;
  const moving = Math.abs(player.vx) > 1 || Math.abs(player.vy) > 1;
  idleTime = moving ? 0 : idleTime + dt;

  if (save.skin === "duck" && wasGrounded && !player.grounded && player.vy < -200) {
    spawnParticle({ x: player.x + P_SIZE / 2, y: player.y - 12, vy: -30, life: 1.1, decay: 1, kind: "quack" });
    playQuack();
  }
  wasGrounded = player.grounded;

  // cactus drops sand that piles up on whatever block it stands on
  if (save.skin === "cactus" && player.grounded && player.groundPlat) {
    depositSand(player.groundPlat, player.x + P_SIZE / 2);
  }

  skinFxTimer -= dt;
  if (skinFxTimer > 0) return;
  skinFxTimer = 0.05;

  if (save.skin === "slime") {
    skinFxTimer = moving ? 0.05 : 0.45;
    spawnParticle({ x: player.x + 6 + Math.random() * (P_SIZE - 12), y: player.y + P_SIZE - 5, life: 1, decay: 1.1, color: "#6ee84d", size: 9, kind: "blob" });
  } else if (save.skin === "ninja" && !player.grounded) {
    skinFxTimer = 0.055;
    spawnParticle({ x: player.x, y: player.y, life: 0.5, decay: 2.0, kind: "clone" });
  } else if (save.skin === "ghost") {
    skinFxTimer = 0.3;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + Math.random() * 12, vy: -35, life: 0.8, decay: 1.1, color: "#f0f0ff", size: 5, kind: "blob" });
  } else if (save.skin === "gold") {
    skinFxTimer = 0.11;
    spawnParticle({ x: player.x - 6 + Math.random() * (P_SIZE + 12), y: player.y - 6 + Math.random() * (P_SIZE + 12), life: 0.8, decay: 1.2, color: Math.random() < 0.5 ? "#ffffff" : "#ffd84d", size: 6, kind: "spark" });
  } else if (save.skin === "rainbow" && moving) {
    skinFxTimer = 0.045;
    spawnParticle({ x: player.x + P_SIZE / 2, y: player.y + P_SIZE / 2, life: 0.7, decay: 1.6, color: `hsl(${(performance.now() / 1000 * 120) % 360}, 90%, 60%)`, size: 14, kind: "blob" });
  } else if (save.skin === "bee" && moving) {
    skinFxTimer = 0.09;
    spawnParticle({ x: player.x + P_SIZE / 2, y: player.y + P_SIZE / 2, life: 0.6, decay: 1.6, color: "#ffd84d", size: 5, kind: "blob" });
  } else if (save.skin === "cat" && player.grounded && moving) {
    skinFxTimer = 0.14;
    spawnParticle({ x: player.x + P_SIZE / 2, y: player.y + P_SIZE - 2, life: 2.2, decay: 1, kind: "paw" });
  } else if (save.skin === "fire") {
    skinFxTimer = 0.07;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + Math.random() * 8, vy: -45, life: 0.7, decay: 1.4, color: Math.random() < 0.5 ? "#ff6b2d" : "#ffd84d", size: 7, kind: "blob" });
  } else if (save.skin === "ice") {
    skinFxTimer = 0.22;
    spawnParticle({ x: player.x - 4 + Math.random() * (P_SIZE + 8), y: player.y - 4 + Math.random() * (P_SIZE + 8), life: 0.8, decay: 1.2, color: Math.random() < 0.5 ? "#ffffff" : "#aee3ff", size: 6, kind: "spark" });
  } else if (save.skin === "alien") {
    skinFxTimer = 0.35;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + Math.random() * 10, vy: -30, life: 0.7, decay: 1.2, color: "#7CFC00", size: 5, kind: "blob" });
  } else if (save.skin === "pumpkin") {
    skinFxTimer = 0.13;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + Math.random() * P_SIZE, vy: -35, life: 0.8, decay: 1.2, color: Math.random() < 0.5 ? "#ff8c00" : "#ff5050", size: 5, kind: "spark" });
  } else if (save.skin === "star") {
    skinFxTimer = 0.12;
    spawnParticle({ x: player.x - 8 + Math.random() * (P_SIZE + 16), y: player.y - 8 + Math.random() * (P_SIZE + 16), life: 0.8, decay: 1.2, color: Math.random() < 0.5 ? "#ffffff" : "#ffe14d", size: 9, kind: "spark" });
  } else if (save.skin === "shadow" && (moving || !player.grounded)) {
    skinFxTimer = 0.05;
    spawnParticle({ x: player.x + P_SIZE / 2, y: player.y + P_SIZE / 2, life: 0.6, decay: 1.3, color: "#5d3f8f", size: 12, kind: "blob" });
  } else if (save.skin === "puppy" && moving) {
    skinFxTimer = 0.2;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y - 4, vy: -40, life: 0.9, decay: 1.1, color: "#ff6b9d", kind: "heart" });
  } else if (save.skin === "bunny" && !player.grounded) {
    skinFxTimer = 0.07;
    spawnParticle({ x: player.x + P_SIZE / 2, y: player.y + P_SIZE - 4, life: 0.6, decay: 1.4, color: "#ffffff", size: 8, kind: "blob" });
  } else if (save.skin === "chick" && !player.grounded) {
    skinFxTimer = 0.1;
    spawnParticle({ x: player.x - 4 + Math.random() * (P_SIZE + 8), y: player.y + Math.random() * P_SIZE, vy: 25, life: 0.8, decay: 1.1, color: Math.random() < 0.5 ? "#ffd84d" : "#fff3b0", size: 5, kind: "blob" });
  } else if (save.skin === "fish") {
    skinFxTimer = 0.25;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + 4, vy: -50, life: 0.9, decay: 1.0, color: "#aee3ff", size: 7, kind: "bubble" });
  } else if (save.skin === "panda") {
    skinFxTimer = 0.3;
    spawnParticle({ x: player.x - 10 + Math.random() * (P_SIZE + 20), y: player.y - 14, vy: 30, life: 1, decay: 0.9, color: "#52c45a", size: 6, kind: "blob" });
  } else if (save.skin === "dragon" && moving) {
    skinFxTimer = 0.06;
    const dir = player.vx > 0 ? 1 : player.vx < 0 ? -1 : (Math.random() < 0.5 ? 1 : -1);
    spawnParticle({ x: player.x + P_SIZE / 2 + dir * 18, y: player.y + 15 + Math.random() * 6, vx: dir * 90, vy: -10 + Math.random() * 20, life: 0.6, decay: 1.5, color: Math.random() < 0.5 ? "#ff6b2d" : "#ffd84d", size: 8, kind: "blob" });
  } else if (save.skin === "king") {
    skinFxTimer = 0.14;
    const confetti = ["#ff5050", "#4d7de8", "#ffd84d", "#7CFC00", "#ff8de8"];
    spawnParticle({ x: player.x - 6 + Math.random() * (P_SIZE + 12), y: player.y - 12 + Math.random() * 10, vy: 50, life: 0.8, decay: 1.1, color: confetti[Math.floor(Math.random() * confetti.length)], size: 5, kind: "blob" });
  } else if (save.skin === "cactus" && moving) {
    skinFxTimer = 0.18;
    spawnParticle({ x: player.x + Math.random() * P_SIZE, y: player.y + P_SIZE - 4, vy: 20, life: 0.7, decay: 1.2, color: Math.random() < 0.5 ? "#e8c87a" : "#d2a679", size: 5, kind: "blob" });
  } else if (save.skin === "bear" && player.grounded && moving) {
    skinFxTimer = 0.22;
    spawnParticle({ x: player.x + 6 + Math.random() * (P_SIZE - 12), y: player.y + P_SIZE - 2, vy: 30, life: 0.9, decay: 1.0, color: "#ffd84d", size: 6, kind: "blob" });
  } else if (save.skin === "penguin" && player.grounded && moving) {
    skinFxTimer = 0.1;
    spawnParticle({ x: player.x + P_SIZE / 2, y: player.y + P_SIZE - 2, life: 0.5, decay: 1.5, color: "#ffffff", size: 7, kind: "blob" });
  } else if (save.skin === "fox" && moving) {
    skinFxTimer = 0.16;
    const leaf = ["#e86d2d", "#ff9d2e", "#ffd84d", "#8a5a30"];
    spawnParticle({ x: player.x - 8 + Math.random() * (P_SIZE + 16), y: player.y + Math.random() * P_SIZE, vy: 25, life: 0.8, decay: 1.1, color: leaf[Math.floor(Math.random() * leaf.length)], size: 5, kind: "blob" });
  } else if (save.skin === "owl") {
    skinFxTimer = 0.28;
    spawnParticle({ x: player.x - 6 + Math.random() * (P_SIZE + 12), y: player.y + Math.random() * P_SIZE, vy: 30, life: 0.9, decay: 1.0, color: Math.random() < 0.5 ? "#f5f5f5" : "#c4a882", size: 5, kind: "blob" });
  } else if (save.skin === "zombie" && moving) {
    skinFxTimer = 0.2;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + P_SIZE - 4, vy: 35, life: 0.9, decay: 1.0, color: "#6ee84d", size: 6, kind: "blob" });
  } else if (save.skin === "astronaut") {
    skinFxTimer = 0.2;
    spawnParticle({ x: player.x - 8 + Math.random() * (P_SIZE + 16), y: player.y - 8 + Math.random() * (P_SIZE + 16), life: 0.8, decay: 1.2, color: Math.random() < 0.5 ? "#ffffff" : "#4d7de8", size: 6, kind: "spark" });
  } else if (save.skin === "unicorn") {
    skinFxTimer = 0.1;
    const magic = ["#ff8de8", "#b06aff", "#ffd84d", "#4d7de8"];
    spawnParticle({ x: player.x - 6 + Math.random() * (P_SIZE + 12), y: player.y - 6 + Math.random() * (P_SIZE + 12), life: 0.8, decay: 1.2, color: magic[Math.floor(Math.random() * magic.length)], size: 7, kind: "spark" });
  } else if (save.skin === "vampire") {
    skinFxTimer = 0.25;
    spawnParticle({ x: player.x - 10 + Math.random() * (P_SIZE + 20), y: player.y - 14 + Math.random() * 8, vy: -25, life: 0.7, decay: 1.2, color: "#2d1a3a", size: 6, kind: "blob" });
  } else if (save.skin === "phoenix" && moving) {
    skinFxTimer = 0.06;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + Math.random() * 10, vy: -50, life: 0.7, decay: 1.4, color: Math.random() < 0.5 ? "#ff6b2d" : "#ffd84d", size: 8, kind: "blob" });
  } else if (save.skin === "crystal") {
    skinFxTimer = 0.1;
    spawnParticle({ x: player.x - 8 + Math.random() * (P_SIZE + 16), y: player.y - 8 + Math.random() * (P_SIZE + 16), life: 0.8, decay: 1.2, color: `hsl(${Math.random() * 360}, 80%, 70%)`, size: 7, kind: "spark" });
  } else if (save.skin === "mouse" && moving) {
    skinFxTimer = 0.2;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + P_SIZE - 4, vy: 20, life: 0.8, decay: 1.1, color: "#ffd84d", size: 4, kind: "blob" });
  } else if (save.skin === "monkey" && moving) {
    skinFxTimer = 0.16;
    const leaf = ["#52c45a", "#3e9c2e", "#8a5a30"];
    spawnParticle({ x: player.x - 6 + Math.random() * (P_SIZE + 12), y: player.y + Math.random() * P_SIZE, vy: 25, life: 0.8, decay: 1.1, color: leaf[Math.floor(Math.random() * leaf.length)], size: 5, kind: "blob" });
  } else if (save.skin === "pig" && moving) {
    skinFxTimer = 0.2;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y - 4, vy: -35, life: 0.9, decay: 1.1, color: "#ff9db0", kind: "heart" });
  } else if (save.skin === "wolf" && !player.grounded) {
    skinFxTimer = 0.1;
    spawnParticle({ x: player.x + P_SIZE / 2, y: player.y, vy: -25, life: 0.6, decay: 1.4, color: "#c0c8d0", size: 5, kind: "blob" });
  } else if (save.skin === "mushroom" && moving) {
    skinFxTimer = 0.18;
    spawnParticle({ x: player.x - 6 + Math.random() * (P_SIZE + 12), y: player.y + Math.random() * P_SIZE, vy: -20, life: 0.9, decay: 1.1, color: Math.random() < 0.5 ? "#ffd84d" : "#fff", size: 4, kind: "spark" });
  } else if (save.skin === "crab") {
    skinFxTimer = 0.28;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + 4, vy: -40, life: 0.9, decay: 1.0, color: "#aee3ff", size: 6, kind: "bubble" });
  } else if (save.skin === "snowman" && moving) {
    skinFxTimer = 0.12;
    spawnParticle({ x: player.x + P_SIZE / 2, y: player.y + P_SIZE - 2, life: 0.5, decay: 1.5, color: "#ffffff", size: 6, kind: "blob" });
  } else if (save.skin === "dino" && player.grounded && moving) {
    skinFxTimer = 0.16;
    spawnParticle({ x: player.x + P_SIZE / 2, y: player.y + P_SIZE - 2, vy: 25, life: 0.7, decay: 1.2, color: "#caa56a", size: 6, kind: "blob" });
  } else if (save.skin === "shark") {
    skinFxTimer = 0.25;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + 4, vy: -45, life: 0.9, decay: 1.0, color: "#aee3ff", size: 7, kind: "bubble" });
  } else if (save.skin === "clown" && moving) {
    skinFxTimer = 0.14;
    const cc2 = ["#ff5050", "#4d7de8", "#ffd84d", "#7CFC00", "#ff8de8"];
    spawnParticle({ x: player.x - 6 + Math.random() * (P_SIZE + 12), y: player.y - 10, vy: 45, life: 0.8, decay: 1.1, color: cc2[Math.floor(Math.random() * cc2.length)], size: 5, kind: "blob" });
  } else if (save.skin === "octopus") {
    skinFxTimer = 0.3;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + P_SIZE - 4, vy: 20, life: 0.9, decay: 1.0, color: "#6b2fb0", size: 7, kind: "blob" });
  } else if (save.skin === "skeleton" && moving) {
    skinFxTimer = 0.2;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + P_SIZE - 4, vy: 15, life: 0.7, decay: 1.2, color: "#e8e8e8", size: 4, kind: "blob" });
  } else if (save.skin === "devil") {
    skinFxTimer = 0.1;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + Math.random() * 8, vy: -40, life: 0.7, decay: 1.3, color: Math.random() < 0.5 ? "#ff5050" : "#8a1a1a", size: 6, kind: "blob" });
  } else if (save.skin === "angel") {
    skinFxTimer = 0.22;
    spawnParticle({ x: player.x - 6 + Math.random() * (P_SIZE + 12), y: player.y + Math.random() * P_SIZE, vy: 25, life: 1.0, decay: 0.9, color: "#ffffff", size: 5, kind: "blob" });
  } else if (save.skin === "mermaid") {
    skinFxTimer = 0.26;
    spawnParticle({ x: player.x + 4 + Math.random() * (P_SIZE - 8), y: player.y + 4, vy: -45, life: 0.9, decay: 1.0, color: "#aee3ff", size: 7, kind: "bubble" });
  } else if (save.skin === "yeti" && moving) {
    skinFxTimer = 0.14;
    spawnParticle({ x: player.x - 6 + Math.random() * (P_SIZE + 12), y: player.y + Math.random() * P_SIZE, vy: 20, life: 0.7, decay: 1.2, color: Math.random() < 0.5 ? "#ffffff" : "#d8e4f0", size: 5, kind: "blob" });
  } else if (save.skin === "diamond") {
    skinFxTimer = 0.1;
    spawnParticle({ x: player.x - 8 + Math.random() * (P_SIZE + 16), y: player.y - 8 + Math.random() * (P_SIZE + 16), life: 0.8, decay: 1.2, color: `hsl(${Math.random() * 360}, 80%, 75%)`, size: 7, kind: "spark" });
  }
}

/* ---------------- Seeded RNG (same level number = same obby) ---------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ---------------- Level generation ---------------- */

const PLAT_H = 22;

let world = null; // current obby

function generateLevel(n) {
  const rng = mulberry32(n * 7919 + 1234567);
  // difficulty 0..1, climbs forever but levels stay beatable
  const d = 1 - 1 / (1 + n * 0.05);

  const count = 12 + Math.min(30, Math.floor(n / 2) + 2);
  const platforms = [];
  const lava = [];

  // start platform
  platforms.push({
    x: -40, y: 0, w: 200, h: PLAT_H, type: "start",
    mover: null, spikes: false, baseX: -40, baseY: 0, dx: 0, dy: 0,
  });

  let x = 160;
  let y = 0;

  for (let i = 1; i <= count; i++) {
    const isCheckpoint = i % 8 === 0 && i < count;
    const last = i === count;

    let w, gap, rise;
    let mover = null;
    let spikes = false;

    if (isCheckpoint || last) {
      w = last ? 170 : 130;
      rise = (rng() * 2 - 1) * 30;
      gap = lerp(50, 80, d) + rng() * 20;
    } else {
      w = clamp(lerp(130, 55, d) + rng() * 45, 50, 175);

      // rise > 0 means the next platform is higher up
      rise = (rng() * 2 - 1) * lerp(35, 80, d);
      rise = clamp(rise, -110, lerp(30, 72, d));

      // keep every jump physically possible: big rises force small gaps
      let gapMax = 148 - Math.max(0, rise) * 1.15;
      gap = lerp(45, gapMax * 0.65, d) + rng() * (gapMax * 0.3);
      gap = clamp(gap, 40, gapMax);

      // moving platforms appear from obby 4
      if (n >= 4 && rng() < lerp(0.05, 0.4, d)) {
        const vertical = rng() < 0.5;
        mover = {
          axis: vertical ? "v" : "h",
          amp: vertical ? lerp(25, 50, d) : lerp(25, 45, d),
          speed: lerp(1.2, 2.4, d) * (rng() < 0.5 ? 1 : -1),
          phase: rng() * Math.PI * 2,
        };
        if (mover.axis === "h") gap = Math.min(gap, 75);
        if (mover.axis === "v") rise = clamp(rise, -60, 30);
      }

      // spikes appear from obby 3, only on platforms wide enough to land safely
      if (n >= 3 && !mover && w >= 95 && rng() < lerp(0.05, 0.38, d)) {
        spikes = true;
      }
    }

    const yBefore = y;
    x += gap;
    y -= rise;

    // lava blocks appear from obby 10: they float in the middle of a jump,
    // a little below the platforms, and burn anyone who falls short
    if (n >= 10 && !isCheckpoint && !last && !mover &&
        gap >= 68 && rng() < lerp(0.2, 0.45, d)) {
      const lw = 30 + rng() * 16;
      lava.push({
        x: Math.round(x - gap + (gap - lw) / 2),
        y: Math.round(Math.max(yBefore, y) + 35),
        w: Math.round(lw),
        h: 26,
      });
    }

    const p = {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: PLAT_H,
      type: last ? "finish" : (isCheckpoint ? "checkpoint" : "normal"),
      mover,
      spikes,
      baseX: Math.round(x),
      baseY: Math.round(y),
      dx: 0,
      dy: 0,
    };
    platforms.push(p);
    x += w;
  }

  const finish = platforms[platforms.length - 1];
  const flag = {
    x: finish.x + finish.w - 46,
    y: finish.y - 64,
    w: 30,
    h: 64,
  };

  let lowest = 0;
  for (const p of platforms) lowest = Math.max(lowest, p.y);

  return {
    n,
    platforms,
    lava,
    flag,
    killY: lowest + 340,
    hue: (n * 47) % 360,
    spawn: { x: 20, y: -40 },
    checkpoint: { x: 20, y: -40 },
    time: 0,
  };
}

/* ---------------- Player & physics ---------------- */

const GRAVITY = 1500;
const MOVE_SPEED = 250;
const JUMP_VEL = 560;
const P_SIZE = 28;

const player = {
  x: 0, y: 0, vx: 0, vy: 0,
  grounded: false,
  groundPlat: null,
  coyote: 0,
  jumpBuffer: 0,
  deadFlash: 0,
};

function respawn() {
  player.x = world.checkpoint.x;
  player.y = world.checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.groundPlat = null;
  player.deadFlash = 0.5;
}

function hurtPlayer() {
  respawn();
}

function loadLevel(n) {
  world = generateLevel(n);
  particles = [];
  respawn();
  player.deadFlash = 0;
  camX = player.x - W * 0.35;
  camY = player.y - H * 0.55;
  document.getElementById("hud-level").textContent = "OBBY #" + n;
  refreshXpLabels();
}

function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function updatePlatforms(dt) {
  world.time += dt;
  for (const p of world.platforms) {
    if (!p.mover) continue;
    const prevX = p.x, prevY = p.y;
    const off = Math.sin(world.time * p.mover.speed + p.mover.phase) * p.mover.amp;
    if (p.mover.axis === "h") p.x = p.baseX + off;
    else p.y = p.baseY + off;
    p.dx = p.x - prevX;
    p.dy = p.y - prevY;
  }
}

function updatePlayer(dt) {
  // ride moving platform
  if (player.grounded && player.groundPlat && player.groundPlat.mover) {
    player.x += player.groundPlat.dx;
    player.y += player.groundPlat.dy;
  }

  // horizontal input
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  player.vx = dir * MOVE_SPEED;

  // jumping (with coyote time + jump buffer so it feels fair)
  player.coyote = player.grounded ? 0.09 : Math.max(0, player.coyote - dt);
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  if (input.jumpPressed) { player.jumpBuffer = 0.12; input.jumpPressed = false; }
  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = -JUMP_VEL;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.grounded = false;
    player.groundPlat = null;
  }
  // variable jump height: release early = shorter hop
  if (!input.jump && player.vy < -200) player.vy = -200;

  player.vy = Math.min(player.vy + GRAVITY * dt, 900);

  // move X, resolve
  player.x += player.vx * dt;
  for (const p of world.platforms) {
    if (overlaps(player.x, player.y, P_SIZE, P_SIZE, p.x, p.y, p.w, p.h)) {
      // an overlap no deeper than this frame's fall/rise plus the block's own
      // movement is a landing (the Y pass below handles it), not a wall hit --
      // treating it as a wall yanked the player sideways on moving blocks
      const sink = Math.max(0, player.vy * dt) + Math.abs(p.dy) + 2;
      const bump = Math.max(0, -player.vy * dt) + Math.abs(p.dy) + 2;
      if (player.y + P_SIZE - p.y < sink || p.y + p.h - player.y < bump) continue; // not a wall
      if (player.vx > 0) player.x = p.x - P_SIZE;
      else if (player.vx < 0) player.x = p.x + p.w;
    }
  }

  // move Y, resolve
  player.y += player.vy * dt;
  player.grounded = false;
  player.groundPlat = null;
  for (const p of world.platforms) {
    if (overlaps(player.x, player.y, P_SIZE, P_SIZE, p.x, p.y, p.w, p.h)) {
      if (player.vy >= 0 && player.y + P_SIZE - p.y < 26 + Math.abs(p.dy)) {
        player.y = p.y - P_SIZE;
        player.vy = 0;
        player.grounded = true;
        player.groundPlat = p;
        if (p.type === "checkpoint") {
          p.touched = true;
          world.checkpoint = { x: p.baseX + p.w / 2 - P_SIZE / 2, y: p.baseY - P_SIZE - 12 };
        }
      } else if (player.vy < 0) {
        player.y = p.y + p.h;
        player.vy = 0;
      }
    }
  }

  // spikes (hitbox slightly smaller than the player so it feels fair)
  for (const p of world.platforms) {
    if (!p.spikes) continue;
    const sx = p.x + 30, sw = p.w - 60, sy = p.y - 13, sh = 13;
    if (overlaps(player.x + 5, player.y + 5, P_SIZE - 10, P_SIZE - 5, sx, sy, sw, sh)) {
      hurtPlayer();
      return;
    }
  }

  // lava blocks burn on any touch (hitbox slightly smaller, like spikes)
  for (const lv of world.lava) {
    if (overlaps(player.x + 4, player.y + 4, P_SIZE - 8, P_SIZE - 8, lv.x, lv.y, lv.w, lv.h)) {
      hurtPlayer();
      return;
    }
  }

  // fell off
  if (player.y > world.killY) { hurtPlayer(); return; }

  // finish flag
  const f = world.flag;
  if (overlaps(player.x, player.y, P_SIZE, P_SIZE, f.x, f.y, f.w, f.h)) {
    completeObby();
  }
}

/* ---------------- Game flow ---------------- */

let state = "menu"; // menu | playing | market | complete | tutorial | levels
let marketReturn = "menu";
let levelsReturn = "menu";
let startAfterTutorial = false;

function completeObby() {
  const replay = world.n < save.level;
  const reward = replay ? 25 : XP_PER_OBBY;
  save.xp += reward;
  if (!replay) save.level += 1;
  writeSave();
  refreshXpLabels();
  document.getElementById("complete-reward").textContent =
    "+" + reward + " XP" + (replay ? " (replay)" : "");
  document.getElementById("complete-next").textContent =
    "Obby #" + (world.n + 1) + " is waiting..." +
    (world.n + 1 === save.level ? " it's a bit harder!" : "");
  setState("complete");
}

function setState(s) {
  state = s;
  document.getElementById("menu").classList.toggle("hidden", s !== "menu");
  document.getElementById("market").classList.toggle("hidden", s !== "market");
  document.getElementById("complete").classList.toggle("hidden", s !== "complete");
  document.getElementById("tutorial").classList.toggle("hidden", s !== "tutorial");
  document.getElementById("levels").classList.toggle("hidden", s !== "levels");
  document.getElementById("hud").classList.toggle("hidden", s !== "playing");
  document.getElementById("touch-controls").classList.toggle("hidden", s !== "playing");
  if (s === "market") { marketTab = "skins"; showMarketTab(); }
  if (s === "levels") buildLevels();
  // drop focus so SPACE jumps instead of re-clicking the last button
  if (s === "playing" && document.activeElement) document.activeElement.blur();
  refreshXpLabels();
}

function buildLevels() {
  const grid = document.getElementById("level-grid");
  grid.innerHTML = "";
  for (let n = 1; n <= save.level; n++) {
    const btn = document.createElement("button");
    btn.className = "level-btn" + (n === save.level ? " current" : "");
    btn.textContent = n === save.level ? n + " ★" : n + " ✓";
    btn.onclick = () => { loadLevel(n); setState("playing"); };
    grid.appendChild(btn);
  }
  // jump to the newest obby so long lists don't need scrolling up
  grid.scrollTop = grid.scrollHeight;
}

function startObby() {
  loadLevel(save.level);
  setState("playing");
}

function refreshXpLabels() {
  document.getElementById("hud-xp").textContent = "XP " + save.xp;
  document.getElementById("menu-xp").textContent = "XP " + save.xp;
  document.getElementById("market-xp").textContent = "Your XP: " + save.xp;
  document.getElementById("menu-level").textContent = "Obby #" + save.level;
}

/* ---------------- Market UI ---------------- */

let marketTab = "skins"; // skins | items

function showMarketTab() {
  document.getElementById("tab-skins").classList.toggle("active", marketTab === "skins");
  document.getElementById("tab-items").classList.toggle("active", marketTab === "items");
  document.getElementById("skin-grid").classList.toggle("hidden", marketTab !== "skins");
  document.getElementById("item-grid").classList.toggle("hidden", marketTab !== "items");
  if (marketTab === "skins") buildMarketSkins();
  else buildMarketItems();
}

function buildMarketSkins() {
  const grid = document.getElementById("skin-grid");
  grid.innerHTML = "";
  for (const skin of SKINS) {
    const owned = save.owned.includes(skin.id);
    const equipped = save.skin === skin.id;

    const card = document.createElement("div");
    card.className = "skin-card" + (equipped ? " equipped" : "");

    // tall canvas with headroom so crowns, antennas, ears and wings aren't cut off
    const cv = document.createElement("canvas");
    cv.width = 48; cv.height = 48;
    const cc = cv.getContext("2d");
    drawSkin(cc, 10, 15, 28, skin.id, 0.4);
    card.appendChild(cv);

    const name = document.createElement("div");
    name.className = "skin-name";
    name.textContent = skin.name;
    card.appendChild(name);

    if (skin.desc) {
      const desc = document.createElement("div");
      desc.className = "skin-desc";
      desc.textContent = skin.desc;
      card.appendChild(desc);
    }

    const price = document.createElement("div");
    price.className = "skin-price";
    price.textContent = owned ? "Owned" : skin.price + " XP";
    card.appendChild(price);

    const btn = document.createElement("button");
    btn.className = "skin-btn";
    if (equipped) {
      btn.textContent = "EQUIPPED";
      btn.classList.add("equipped-btn");
      btn.disabled = false;
    } else if (owned) {
      btn.textContent = "EQUIP";
      btn.classList.add("owned");
      btn.onclick = () => { save.skin = skin.id; writeSave(); buildMarketSkins(); };
    } else {
      btn.textContent = "BUY";
      if (save.xp < skin.price) btn.disabled = true;
      btn.onclick = () => {
        if (save.xp < skin.price) return;
        save.xp -= skin.price;
        save.owned.push(skin.id);
        save.skin = skin.id;
        writeSave();
        buildMarketSkins();
        refreshXpLabels();
      };
    }
    card.appendChild(btn);
    grid.appendChild(card);
  }
}

function buildMarketItems() {
  const grid = document.getElementById("item-grid");
  grid.innerHTML = "";
  for (const item of ITEMS) {
    const owned = ownsItem(item.id);
    const equipped = save.equipped[item.slot] === item.id;

    const card = document.createElement("div");
    card.className = "skin-card item-card" + (equipped ? " equipped" : "");

    const cv = document.createElement("canvas");
    cv.width = 48; cv.height = 48;
    const cc = cv.getContext("2d");
    drawItemIcon(cc, 10, 10, 28, item.id);
    card.appendChild(cv);

    const name = document.createElement("div");
    name.className = "skin-name";
    name.textContent = item.name;
    card.appendChild(name);

    const slot = document.createElement("div");
    slot.className = "skin-desc";
    slot.textContent = SLOT_LABELS[item.slot];
    card.appendChild(slot);

    const price = document.createElement("div");
    price.className = "skin-price";
    price.textContent = owned ? "Owned" : item.price + " XP";
    card.appendChild(price);

    const btn = document.createElement("button");
    btn.className = "skin-btn";
    if (equipped) {
      btn.textContent = "REMOVE";
      btn.classList.add("remove-btn");
      btn.onclick = () => {
        save.equipped[item.slot] = null;
        writeSave();
        buildMarketItems();
      };
    } else if (owned) {
      btn.textContent = "WEAR";
      btn.classList.add("owned");
      btn.onclick = () => {
        save.equipped[item.slot] = item.id;
        writeSave();
        buildMarketItems();
      };
    } else {
      btn.textContent = "BUY";
      if (save.xp < item.price) btn.disabled = true;
      btn.onclick = () => {
        if (save.xp < item.price) return;
        save.xp -= item.price;
        save.ownedItems.push(item.id);
        save.equipped[item.slot] = item.id;
        writeSave();
        buildMarketItems();
        refreshXpLabels();
      };
    }
    card.appendChild(btn);
    grid.appendChild(card);
  }
}

/* ---------------- Input ---------------- */

const input = { left: false, right: false, jump: false, jumpPressed: false };

function pressJump() {
  if (!input.jump) input.jumpPressed = true;
  input.jump = true;
}

window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", (e) => {
  unlockAudio();
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") input.left = true;
  if (k === "arrowright" || k === "d") input.right = true;
  if (k === " " || k === "arrowup" || k === "w") { pressJump(); e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") input.left = false;
  if (k === "arrowright" || k === "d") input.right = false;
  if (k === " " || k === "arrowup" || k === "w") input.jump = false;
});

function bindHold(id, on, off) {
  const el = document.getElementById(id);
  el.addEventListener("pointerdown", (e) => { e.preventDefault(); unlockAudio(); on(); });
  el.addEventListener("pointerup", off);
  el.addEventListener("pointercancel", off);
  el.addEventListener("pointerleave", off);
  // no long-press menu on touch screens
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}
bindHold("btn-left", () => input.left = true, () => input.left = false);
bindHold("btn-right", () => input.right = true, () => input.right = false);
bindHold("btn-jump", pressJump, () => input.jump = false);

/* ---------------- Menu buttons ---------------- */

document.getElementById("btn-play").onclick = () => {
  if (!save.seenTutorial) {
    startAfterTutorial = true;
    setState("tutorial");
  } else {
    startObby();
  }
};
document.getElementById("btn-howto").onclick = () => { startAfterTutorial = false; setState("tutorial"); };
document.getElementById("btn-tutorial-ok").onclick = () => {
  save.seenTutorial = true;
  writeSave();
  if (startAfterTutorial) startObby();
  else setState("menu");
};
document.getElementById("btn-market").onclick = () => { marketReturn = "menu"; setState("market"); };
document.getElementById("btn-market-back").onclick = () => setState(marketReturn);
document.getElementById("tab-skins").onclick = () => { marketTab = "skins"; showMarketTab(); };
document.getElementById("tab-items").onclick = () => { marketTab = "items"; showMarketTab(); };
document.getElementById("btn-levels").onclick = () => { levelsReturn = "menu"; setState("levels"); };
// opening MY OBBIES mid-game pauses; BACK resumes right where you were
document.getElementById("btn-hud-levels").onclick = () => { levelsReturn = "playing"; setState("levels"); };
document.getElementById("btn-complete-levels").onclick = () => { levelsReturn = "complete"; setState("levels"); };
document.getElementById("btn-levels-back").onclick = () => setState(levelsReturn);
document.getElementById("btn-pause").onclick = () => setState("menu");
// continue from whichever obby was just finished (works for replays too)
document.getElementById("btn-next").onclick = () => { loadLevel(world.n + 1); setState("playing"); };
document.getElementById("btn-complete-market").onclick = () => { marketReturn = "complete"; setState("market"); };
document.getElementById("btn-complete-menu").onclick = () => setState("menu");

/* ---------------- Rendering ---------------- */

let camX = 0, camY = 0;

// fixed star field for the background
const stars = (() => {
  const r = mulberry32(424242);
  const arr = [];
  for (let i = 0; i < 90; i++) {
    arr.push({ x: r() * W, y: r() * H, s: 1 + Math.floor(r() * 2), a: 0.25 + r() * 0.6 });
  }
  return arr;
})();

function render(t) {
  // sky
  const hue = world ? world.hue : 230;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `hsl(${hue}, 45%, 12%)`);
  grad.addColorStop(1, `hsl(${hue}, 45%, 24%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // stars with slight parallax
  ctx.fillStyle = "#fff";
  for (const s of stars) {
    const px = ((s.x - camX * 0.1) % W + W) % W;
    const py = ((s.y - camY * 0.1) % H + H) % H;
    ctx.globalAlpha = s.a;
    ctx.fillRect(px, py, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  if (!world) return;

  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));

  // platforms
  for (const p of world.platforms) {
    let top, body;
    if (p.type === "finish") { top = "#ffd84d"; body = "#b8860b"; }
    else if (p.type === "checkpoint") {
      if (p.touched) { top = "#7CFC00"; body = "#2e7d32"; }
      else { top = "#ff5050"; body = "#8b2525"; }
    }
    else if (p.mover) { top = `hsl(${(hue + 180) % 360}, 70%, 65%)`; body = `hsl(${(hue + 180) % 360}, 50%, 35%)`; }
    else { top = `hsl(${hue}, 50%, 55%)`; body = `hsl(${hue}, 40%, 32%)`; }

    ctx.fillStyle = body;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = top;
    ctx.fillRect(p.x, p.y, p.w, 6);

    // cactus sand piles built up on this block
    if (p.sand) {
      for (const k in p.sand) {
        const h = p.sand[k];
        const lx = p.x + Number(k);
        ctx.fillStyle = "#c9a36a";
        ctx.fillRect(lx - 5, p.y - h, 10, h);
        ctx.fillStyle = "#e8c87a";
        ctx.fillRect(lx - 3, p.y - h, 6, Math.max(1, h - 2));
      }
    }

    // spikes
    if (p.spikes) {
      ctx.fillStyle = "#cfd4dc";
      const sx = p.x + 30, sw = p.w - 60;
      const n = Math.floor(sw / 14);
      for (let i = 0; i < n; i++) {
        const bx = sx + i * (sw / n);
        ctx.beginPath();
        ctx.moveTo(bx, p.y);
        ctx.lineTo(bx + sw / n / 2, p.y - 13);
        ctx.lineTo(bx + sw / n, p.y);
        ctx.fill();
      }
    }

    // checkpoint flag marker
    if (p.type === "checkpoint") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(p.x + p.w / 2 - 2, p.y - 34, 4, 34);
      ctx.fillStyle = p.touched ? "#7CFC00" : "#ff5050";
      ctx.fillRect(p.x + p.w / 2 + 2, p.y - 34, 18, 12);
    }
  }

  // lava blocks (bubbling and glowing)
  for (const lv of world.lava) {
    ctx.fillStyle = "rgba(255,90,31,0.25)"; // heat glow
    ctx.fillRect(lv.x - 4, lv.y - 4, lv.w + 8, lv.h + 8);
    ctx.fillStyle = "#8c2410";
    ctx.fillRect(lv.x, lv.y, lv.w, lv.h);
    ctx.fillStyle = "#ff5a1f";
    ctx.fillRect(lv.x, lv.y, lv.w, 9);
    ctx.fillStyle = "#ffd84d";
    for (let i = 0; i < 3; i++) { // bubbles popping up
      const bub = Math.abs(Math.sin(t * 4 + i * 2.1 + lv.x * 0.05)) * 7;
      ctx.fillRect(lv.x + 5 + i * (lv.w - 13) / 2, lv.y + 4 - bub, 4, 4);
    }
  }

  // floating hints turn obby #1 into a mini tutorial
  if (world.n === 1) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.textAlign = "center";
    const start = world.platforms[0];
    ctx.fillText("MOVE: \u25C0 \u25B6  or  A / D", start.x + start.w / 2, start.y - 78);
    ctx.fillText("JUMP: SPACE or the JUMP button", start.x + start.w / 2, start.y - 56);
    const p1 = world.platforms[1];
    if (p1) ctx.fillText("Jump across the gaps!", p1.x + p1.w / 2, p1.y - 56);
    const cp = world.platforms.find(p => p.type === "checkpoint");
    if (cp) ctx.fillText("Checkpoint! Turns green when touched", cp.x + cp.w / 2, cp.y - 56);
    ctx.fillText("Touch the flag: +100 XP!", world.flag.x + 15, world.flag.y - 16);
    ctx.textAlign = "left";
  }

  // finish flag
  const f = world.flag;
  ctx.fillStyle = "#fff";
  ctx.fillRect(f.x + f.w - 6, f.y, 5, f.h);
  ctx.fillStyle = "#e84d4d";
  const wave = Math.sin(t * 4) * 3;
  ctx.beginPath();
  ctx.moveTo(f.x + f.w - 6, f.y);
  ctx.lineTo(f.x + f.w - 36, f.y + 10 + wave);
  ctx.lineTo(f.x + f.w - 6, f.y + 22);
  ctx.fill();

  // skin effects (drawn under the player)
  for (const p of particles) {
    if (p.kind === "clone") {
      ctx.globalAlpha = Math.min(0.4, p.life);
      ctx.fillStyle = "#23232e";
      ctx.fillRect(p.x, p.y, P_SIZE, P_SIZE);
      ctx.fillStyle = "#d43c3c";
      ctx.fillRect(p.x, p.y + 6, P_SIZE, 5);
    } else if (p.kind === "paw") {
      ctx.globalAlpha = Math.min(0.75, p.life);
      ctx.fillStyle = "#241307";
      ctx.fillRect(p.x - 3, p.y - 2, 6, 4);
      ctx.fillRect(p.x - 4, p.y - 6, 3, 3);
      ctx.fillRect(p.x + 1, p.y - 6, 3, 3);
    } else if (p.kind === "quack") {
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.font = "bold 13px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#1a1a2e";
      ctx.fillText("QUACK!", p.x + 1, p.y + 1);
      ctx.fillStyle = "#fff";
      ctx.fillText("QUACK!", p.x, p.y);
      ctx.textAlign = "left";
    } else if (p.kind === "heart") {
      // pixel heart: two bumps + body + tip
      ctx.globalAlpha = Math.min(0.9, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 4, p.y - 4, 3, 3);
      ctx.fillRect(p.x + 1, p.y - 4, 3, 3);
      ctx.fillRect(p.x - 4, p.y - 1, 8, 3);
      ctx.fillRect(p.x - 2, p.y + 2, 4, 2);
    } else if (p.kind === "bubble") {
      // hollow bubble outline
      ctx.globalAlpha = Math.min(0.8, p.life);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      const r = p.size * (0.5 + 0.5 * p.life);
      ctx.strokeRect(p.x - r / 2, p.y - r / 2, r, r);
    } else if (p.kind === "spark") {
      // twinkling plus-shaped sparkle
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      const s = p.size * p.life * 2;
      ctx.fillRect(p.x - s / 2, p.y - 1, s, 2);
      ctx.fillRect(p.x - 1, p.y - s / 2, 2, s);
    } else {
      // soft blob (goo, wisps, rainbow streak)
      ctx.globalAlpha = 0.6 * p.life;
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + 0.6 * p.life);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1;

  // player (blinks while respawning)
  if (player.deadFlash <= 0 || Math.floor(t * 14) % 2 === 0) {
    const px = Math.round(player.x), py = Math.round(player.y);
    const backId = save.equipped.back;
    if (backId && !BACK_ON_BODY[backId]) drawEquippedSlot(ctx, px, py, P_SIZE, "back");
    if (save.skin === "ghost" && state === "playing") {
      ctx.globalAlpha = clamp(1 - (idleTime - 0.5) * 1.2, 0.12, 1);
    }
    if (save.skin === "robot" && !player.grounded && state === "playing") {
      drawUFO(ctx, px, py, P_SIZE, t);
    } else if (save.skin === "frog" && !player.grounded && state === "playing") {
      const sy = clamp(1 + (-player.vy) / 1600, 0.8, 1.3);
      const sx = 1 / sy;
      const cx = px + P_SIZE / 2, fy = py + P_SIZE;
      ctx.save();
      ctx.translate(cx, fy);
      ctx.scale(sx, sy);
      ctx.translate(-cx, -fy);
      drawSkin(ctx, px, py, P_SIZE, save.skin, t);
      ctx.restore();
    } else {
      drawSkin(ctx, px, py, P_SIZE, save.skin, t);
    }
    ctx.globalAlpha = 1;
    if (backId && BACK_ON_BODY[backId]) drawEquippedSlot(ctx, px, py, P_SIZE, "back");
    drawEquippedSlot(ctx, px, py, P_SIZE, "feet");
    drawEquippedSlot(ctx, px, py, P_SIZE, "hat");
    drawEquippedSlot(ctx, px, py, P_SIZE, "charm");
  }

  ctx.restore();
}

/* ---------------- Main loop ---------------- */

let lastT = performance.now();

function frame(now) {
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = Math.min(dt, 0.035); // avoid tunneling after tab-switch

  if (state === "playing" && world) {
    updatePlatforms(dt);
    updatePlayer(dt);
    updateSkinEffects(dt);
    updateItemEffects(dt);
    if (player.deadFlash > 0) player.deadFlash -= dt;

    // camera follows player
    const tx = player.x - W * 0.35;
    const ty = player.y - H * 0.55;
    camX += (tx - camX) * Math.min(1, dt * 8);
    camY += (ty - camY) * Math.min(1, dt * 8);
  }

  render(now / 1000);
  requestAnimationFrame(frame);
}

/* ---------------- Boot ---------------- */

loadSave();
loadLevel(save.level);
setState("menu");
requestAnimationFrame(frame);

// installable app + offline play (only works when served over http, not file://)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
