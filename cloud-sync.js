"use strict";

/*
  Pixel Obby optional cloud save + anonymous product analytics.
  - Guest play and localStorage always work.
  - Sign-in uses a parent-managed email magic link.
  - Only game progress and obby history are stored for signed-in cloud save.
  - Product analytics uses a random device/browser ID and session ID; it does not require an account or email.
  - This file contains a public publishable key, never a service-role key.
*/

(function () {
  const SUPABASE_URL = "https://kwsrktcsthksnvgbquup.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Qx-QIsbRqz1hcJebGzPgIw_PtePCnWl";
  const SYNC_KEY = "pixelObbyCloudSync";
  const ANALYTICS_VISITOR_KEY = "pixelObbyAnalyticsVisitor";
  const ANALYTICS_SESSION_KEY = "pixelObbyAnalyticsSession";
  const ANALYTICS_EVENTS = new Set(["page_view", "game_start", "obby_complete"]);

  let client = null;
  let session = null;
  let cloudProgress = null;
  let syncEnabled = false;
  let saveTimer = null;
  let analyticsQueue = [];
  let fallbackVisitorId = null;
  let fallbackSessionId = null;

  const $ = (id) => document.getElementById(id);
  const message = (text, isError = false) => {
    const el = $("account-message");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = isError ? "#ff8f8f" : "#ffd84d";
  };

  function randomId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
      const r = Math.random() * 16 | 0;
      const v = ch === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function analyticsVisitorId() {
    try {
      let id = localStorage.getItem(ANALYTICS_VISITOR_KEY);
      if (!id) {
        id = randomId();
        localStorage.setItem(ANALYTICS_VISITOR_KEY, id);
      }
      return id;
    } catch {
      fallbackVisitorId ||= randomId();
      return fallbackVisitorId;
    }
  }

  function analyticsSessionId() {
    try {
      let id = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
      if (!id) {
        id = randomId();
        sessionStorage.setItem(ANALYTICS_SESSION_KEY, id);
      }
      return id;
    } catch {
      fallbackSessionId ||= randomId();
      return fallbackSessionId;
    }
  }

  function displayMode() {
    if (window.matchMedia?.("(display-mode: standalone)")?.matches) return "standalone";
    if (document.referrer?.startsWith("android-app://")) return "twa";
    return "browser";
  }

  async function sendAnalytics(payload) {
    if (!client) {
      analyticsQueue.push(payload);
      return;
    }
    const { error } = await client.from("analytics_events").insert(payload);
    if (error) console.debug("Pixel Obby analytics skipped:", error.message);
  }

  function track(eventName, details = {}) {
    if (!ANALYTICS_EVENTS.has(eventName)) return;
    const obby = Number(details.obbyNumber);
    const payload = {
      visitor_id: analyticsVisitorId(),
      session_id: analyticsSessionId(),
      event_name: eventName,
      obby_number: Number.isFinite(obby) && obby > 0 ? Math.floor(obby) : null,
      metadata: {
        mode: displayMode(),
        ...(typeof details.replay === "boolean" ? { replay: details.replay } : {}),
      },
    };
    sendAnalytics(payload).catch(() => {});
  }

  function flushAnalyticsQueue() {
    if (!client || !analyticsQueue.length) return;
    const queued = analyticsQueue;
    analyticsQueue = [];
    queued.forEach((payload) => sendAnalytics(payload).catch(() => {}));
  }

  function localGame() {
    return window.PixelObbyGame || null;
  }

  function localSave() {
    return localGame()?.getSave?.() || null;
  }

  function setMenuStatus(text) {
    if ($("menu-cloud-status")) $("menu-cloud-status").textContent = text;
  }

  function setSignedInUI() {
    const signedIn = !!session?.user;
    $("account-signed-out")?.classList.toggle("hidden", signedIn);
    $("account-signed-in")?.classList.toggle("hidden", !signedIn);
    $("btn-account").textContent = signedIn ? "ACCOUNT" : "SAVE ONLINE";

    if (!signedIn) {
      setMenuStatus("Guest mode · saved on this device");
      return;
    }

    $("account-user").textContent = session.user.email || "Signed in";
    setMenuStatus(syncEnabled ? "Cloud save on" : "Signed in · choose a save");
    $("account-sync-status").textContent = syncEnabled
      ? "Cloud sync is on. Guest/local play still works offline."
      : "Cloud sync is paused until you choose which save to use.";
  }

  function rememberSync(value) {
    syncEnabled = value;
    if (session?.user) {
      localStorage.setItem(SYNC_KEY, JSON.stringify({ userId: session.user.id, enabled: value }));
    } else {
      localStorage.removeItem(SYNC_KEY);
    }
    setSignedInUI();
  }

  function restoreSyncPreference() {
    try {
      const data = JSON.parse(localStorage.getItem(SYNC_KEY) || "null");
      syncEnabled = !!(data?.enabled && data?.userId === session?.user?.id);
    } catch {
      syncEnabled = false;
    }
  }

  async function fetchCloudProgress() {
    if (!client || !session?.user) return null;
    const { data, error } = await client
      .from("game_progress")
      .select("save_data, updated_at")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function saveProgress(saveData = localSave()) {
    if (!client || !session?.user || !syncEnabled || !saveData) return;
    const { error } = await client.from("game_progress").upsert({
      user_id: session.user.id,
      save_data: saveData,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    message("Progress synced.");
  }

  function queueProgress(saveData) {
    if (!syncEnabled || !session?.user) return;
    clearTimeout(saveTimer);
    const snapshot = JSON.parse(JSON.stringify(saveData));
    saveTimer = setTimeout(() => {
      saveProgress(snapshot).catch((error) => message("Cloud sync paused: " + error.message, true));
    }, 700);
  }

  async function chooseDevice() {
    rememberSync(true);
    await saveProgress(localSave());
    cloudProgress = await fetchCloudProgress();
    $("merge-choice").classList.add("hidden");
    message("This device is now the cloud save.");
  }

  async function chooseCloud() {
    if (!cloudProgress?.save_data || !localGame()?.replaceSave) return;
    localGame().replaceSave(cloudProgress.save_data);
    rememberSync(true);
    $("merge-choice").classList.add("hidden");
    message("Cloud save loaded on this device.");
  }

  async function handleSession(nextSession) {
    session = nextSession;
    cloudProgress = null;
    restoreSyncPreference();
    setSignedInUI();
    if (!session?.user) return;

    try {
      cloudProgress = await fetchCloudProgress();
      if (!cloudProgress) {
        rememberSync(true);
        await saveProgress(localSave());
        message("Signed in. This device is now backed up online.");
      } else if (syncEnabled) {
        message("Signed in. Cloud sync is on.");
      } else {
        $("merge-choice").classList.remove("hidden");
        message("Choose which progress to keep before sync starts.");
      }
    } catch (error) {
      message("Cloud setup is not ready yet: " + error.message, true);
    }
  }

  async function sendMagicLink() {
    const email = $("account-email").value.trim();
    if (!email) {
      message("Enter a parent-managed email first.", true);
      return;
    }
    message("Sending sign-in link…");
    const redirectTo = location.href.split("#")[0].split("?")[0];
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    message("Check your email and open the sign-in link on this device.");
  }

  async function recordRun(run) {
    if (!client || !session?.user || !syncEnabled) return;
    const payload = {
      user_id: session.user.id,
      obby_number: run.obbyNumber,
      duration_ms: run.durationMs,
      attempts: run.attempts,
      xp_earned: run.xpEarned,
      replay: run.replay,
      skin: run.skin,
      equipped: run.equipped || {},
    };
    const { error } = await client.from("obby_runs").insert(payload);
    if (error) message("Run history will retry next time: " + error.message, true);
  }

  async function exportHistory() {
    const [{ data: progress, error: progressError }, { data: runs, error: runsError }] = await Promise.all([
      client.from("game_progress").select("save_data, updated_at").eq("user_id", session.user.id).maybeSingle(),
      client.from("obby_runs").select("obby_number, completed_at, duration_ms, attempts, xp_earned, replay, skin, equipped").eq("user_id", session.user.id).order("completed_at", { ascending: true }),
    ]);
    if (progressError) throw progressError;
    if (runsError) throw runsError;

    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), progress, runs }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pixel-obby-history.json";
    link.click();
    URL.revokeObjectURL(url);
    message("History exported.");
  }

  async function deleteAccount() {
    const confirmed = window.confirm("Delete this account and all Pixel Obby cloud data? Local progress on this device will stay.");
    if (!confirmed) return;
    message("Deleting account and cloud data…");
    const { error } = await client.rpc("delete_pixel_obby_account");
    if (error) throw error;
    await client.auth.signOut();
    rememberSync(false);
    message("Cloud account deleted. This device remains in guest mode.");
  }

  async function init() {
    if (!window.supabase?.createClient) {
      setMenuStatus("Guest mode · cloud unavailable offline");
      return;
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

    flushAnalyticsQueue();
    track("page_view");

    $("btn-magic-link").onclick = () => sendMagicLink().catch((error) => message(error.message, true));
    $("btn-use-device").onclick = () => chooseDevice().catch((error) => message(error.message, true));
    $("btn-use-cloud").onclick = () => chooseCloud().catch((error) => message(error.message, true));
    $("btn-sync-now").onclick = () => saveProgress(localSave()).catch((error) => message(error.message, true));
    $("btn-export-history").onclick = () => exportHistory().catch((error) => message(error.message, true));
    $("btn-sign-out").onclick = () => client.auth.signOut().catch((error) => message(error.message, true));
    $("btn-delete-account").onclick = () => deleteAccount().catch((error) => message(error.message, true));

    const { data } = await client.auth.getSession();
    await handleSession(data.session);
    client.auth.onAuthStateChange((_event, nextSession) => {
      setTimeout(() => handleSession(nextSession), 0);
    });
  }

  window.PixelObbyCloud = { init, queueProgress, saveProgress, recordRun, track };
})();
