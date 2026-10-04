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
  const button = document.getElementById("install-app");
  if (button) button.hidden = false;
});
window.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("install-app");
  const status = document.getElementById("install-status");
  const store = document.getElementById("google-play-link");
  if (GOOGLE_PLAY_URL) {
    store.href = GOOGLE_PLAY_URL;
    store.hidden = false;
    document.getElementById("google-play-soon").hidden = true;
    document.querySelector(".platform-option .platform-note").textContent = "Download the Android app from Google Play.";
  }
  button.hidden = !installPrompt;
  button.addEventListener("click", async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    button.hidden = true;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    status.textContent = choice.outcome === "accepted" ? "Installation requested. Open Pixel Obby from your home screen." : "You can install later or keep playing in your browser.";
  });
  window.addEventListener("appinstalled", () => { installPrompt = null; button.hidden = true; status.textContent = "Pixel Obby is installed. Open it from your home screen."; });
});
