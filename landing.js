"use strict";
// Preserve old email links, including token fragments, without storing or logging them.
const query = new URLSearchParams(location.search);
const hash = new URLSearchParams(location.hash.slice(1));
if (["code", "access_token", "error", "error_description"].some(key => query.has(key) || hash.has(key))) {
  location.replace(new URL("play/", document.baseURI).href + location.search + location.hash);
} else if (navigator.standalone || window.matchMedia?.("(display-mode: standalone)").matches || window.matchMedia?.("(display-mode: fullscreen)").matches) {
  // Existing installations may still launch the old root start URL.
  location.replace(new URL("play/", document.baseURI).href);
} else if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Set this to the supplied Google Play HTTPS deep link when the listing is ready.
const GOOGLE_PLAY_URL = "";
let installPrompt = null;
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener("DOMContentLoaded", () => {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(navigator.userAgent);
  const button = document.getElementById("install-app");
  const status = document.getElementById("install-status");
  const store = document.getElementById("google-play-link");
  const help = document.getElementById("install-help");
  document.getElementById("install-instructions").textContent = ios
    ? "In Safari, tap Share → Add to Home Screen. If shown, keep Open as Web App on, then tap Add."
    : "Open your browser menu and choose Install app or Add to Home screen. If unavailable, try Chrome or Edge. You can still try levels 1–3 in your browser.";
  document.getElementById("google-play-soon").hidden = !android || !!GOOGLE_PLAY_URL;
  if (GOOGLE_PLAY_URL && android) {
    store.href = GOOGLE_PLAY_URL;
    store.hidden = false;
    button.hidden = true;
  }
  const showHelp = () => {
    help.hidden = false;
    button.setAttribute("aria-expanded", "true");
  };
  // Links from the end of the preview still land at the download action.
  if (location.hash === "#download" && !(GOOGLE_PLAY_URL && android)) showHelp();
  window.addEventListener("hashchange", () => {
    if (location.hash === "#download" && !(GOOGLE_PLAY_URL && android)) showHelp();
  });
  button.addEventListener("click", async () => {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      status.textContent = choice.outcome === "accepted" ? "Installation requested. Open Pixel Obby from your home screen." : "You can install later or keep playing in your browser.";
    } else if (help.hidden) {
      showHelp();
    } else {
      help.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
  });
  window.addEventListener("appinstalled", () => { installPrompt = null; button.hidden = true; help.hidden = true; status.textContent = "Pixel Obby is installed. Open it from your home screen."; });
});
