# Pixel Obby

An endless obby (obstacle course) game. Every obby is harder than the one before — and there are millions of them, because each one is generated from its level number.

## How to play

Just open `index.html` in any browser (double-click it). No install needed.

## Play on your phone

1. Double-click `play-on-phone.bat` (keep that window open)
2. It prints an address like `http://192.168.x.x:8000`
3. On your phone (same Wi-Fi as the PC), type that address into the browser
4. Optional: in the browser menu choose **Add to Home Screen** — the game
   installs like a real app with its own icon, runs fullscreen, and even
   works offline afterwards

Your phone and PC each keep their own save (XP and skins).

- **Move**: A / D or the arrow keys, or the on-screen ◀ ▶ buttons
- **Jump**: SPACE, W, ↑, or the on-screen JUMP button
- Reach the **red flag** at the end to finish the obby
- Red platforms are **checkpoints** — they turn green once you touch them, and if you fall you go back to the last green one
- Watch out for **spikes** and **moving platforms** (they show up in later obbies)
- From obby #10, glowing **lava blocks** float in the middle of jumps — touch one and you burn back to your checkpoint

## XP and the Market

- Finishing a new obby gives you **+100 XP**
- From the menu, **MY OBBIES** lets you replay any obby you reached — replays give **+25 XP**
- In the **MARKET**, switch to **ITEMS** to buy hats, capes, boots and charms — they stay **worn** on your avatar until you change them (looks only, no powers)
- You start as a plain pixel — open the **Market** to buy new skins with your XP
- Your XP, level and skins are saved automatically in your browser

## Files

- `index.html` — the page, menus and buttons
- `style.css` — how everything looks
- `game.js` — the game itself (physics, level generator, market, saving)
