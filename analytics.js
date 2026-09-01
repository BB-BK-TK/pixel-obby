"use strict";

(function () {
  const hud = document.getElementById("hud");
  const complete = document.getElementById("complete");
  const levelGrid = document.getElementById("level-grid");
  const hudLevels = document.getElementById("btn-hud-levels");
  const levelsBack = document.getElementById("btn-levels-back");

  if (!hud || !complete || !window.MutationObserver) return;

  let hudWasVisible = !hud.classList.contains("hidden");
  let completeWasVisible = !complete.classList.contains("hidden");
  let suppressNextPlayingTransition = false;

  function currentObbyNumber() {
    const text = document.getElementById("hud-level")?.textContent || "";
    const match = text.match(/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function track(name, details = {}) {
    window.PixelObbyCloud?.track?.(name, details);
  }

  // Opening MY OBBIES from an active run pauses the game. Going BACK simply
  // resumes that same run, so do not count that transition as a fresh start.
  hudLevels?.addEventListener("click", () => {
    suppressNextPlayingTransition = true;
  });

  // Choosing a level from the grid is a real new run, even if the grid was
  // opened from the in-game HUD.
  levelGrid?.addEventListener("click", (event) => {
    if (event.target.closest(".level-btn")) suppressNextPlayingTransition = false;
  });

  levelsBack?.addEventListener("click", () => {
    // The suppression flag is intentionally left in place here; the observer
    // consumes it when the HUD becomes visible again.
  });

  const hudObserver = new MutationObserver(() => {
    const visible = !hud.classList.contains("hidden");
    if (visible && !hudWasVisible) {
      if (suppressNextPlayingTransition) {
        suppressNextPlayingTransition = false;
      } else {
        track("game_start", { obbyNumber: currentObbyNumber() });
      }
    }
    hudWasVisible = visible;
  });

  const completeObserver = new MutationObserver(() => {
    const visible = !complete.classList.contains("hidden");
    if (visible && !completeWasVisible) {
      track("obby_complete", { obbyNumber: currentObbyNumber() });
    }
    completeWasVisible = visible;
  });

  hudObserver.observe(hud, { attributes: true, attributeFilter: ["class"] });
  completeObserver.observe(complete, { attributes: true, attributeFilter: ["class"] });
})();
