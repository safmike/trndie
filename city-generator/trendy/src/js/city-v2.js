(function () {
  "use strict";

  /* ── Shimmer arrival replay (bfcache) ───────────────────────
     Mirror of the logo shimmer replay in home.js. The one-time CSS
     animation plays on initial load but does NOT restart when the
     page is restored from bfcache (back/forward), so reset it on
     pageshow(persisted) to greet the user on every arrival. */

  function replayShimmer() {
    var title = document.querySelector(".cityv2-title");
    if (!title) return;
    title.style.animation = "none";
    void title.offsetWidth; // force reflow so the next assignment restarts the animation
    title.style.animation = "";
  }

  window.addEventListener("pageshow", function (e) {
    if (e.persisted) replayShimmer();
  });

  var grid = document.querySelector(".venue-grid-v2");
  if (!grid) return;

  var cards   = Array.prototype.slice.call(grid.querySelectorAll(".vcard"));
  var pills   = Array.prototype.slice.call(document.querySelectorAll(".vibe-pill"));
  var clearBtn = document.querySelector(".vibe-clear");
  var emptyMsg = document.querySelector(".cityv2-empty");
  var active  = new Set();

  /* ── URL state ──────────────────────────────────────────── */

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    var raw = params.get("vibes");
    if (!raw) return;
    raw.split(",").forEach(function (v) {
      v = v.trim();
      if (v) active.add(v);
    });
  }

  function writeUrl() {
    var params = new URLSearchParams(window.location.search);
    if (active.size) {
      params.set("vibes", Array.from(active).join(","));
    } else {
      params.delete("vibes");
    }
    var qs  = params.toString();
    var url = window.location.pathname + (qs ? "?" + qs : "");
    window.history.replaceState(null, "", url);
  }

  /* ── Apply filter ───────────────────────────────────────── */

  function apply() {
    var shown = 0;
    cards.forEach(function (card) {
      var vibes = (card.dataset.vibes || "").split(" ").filter(Boolean);
      var match = active.size === 0 || vibes.some(function (v) { return active.has(v); });
      card.hidden = !match;
      if (match) shown++;
    });
    if (emptyMsg) emptyMsg.hidden = shown !== 0;
  }

  /* ── Sync pill visual state ─────────────────────────────── */

  function syncPills() {
    pills.forEach(function (pill) {
      var on = active.has(pill.dataset.vibe);
      pill.classList.toggle("is-active", on);
      pill.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll(".vcard-vibe").forEach(function (el) {
      el.classList.toggle("is-active", active.has(el.dataset.vibe));
    });
    if (clearBtn) clearBtn.hidden = active.size === 0;
  }

  /* ── Toggle a single vibe ───────────────────────────────── */

  function toggle(vibe) {
    if (active.has(vibe)) active.delete(vibe);
    else active.add(vibe);
    writeUrl();
    syncPills();
    apply();
  }

  /* ── Wire up strip pills ────────────────────────────────── */

  pills.forEach(function (pill) {
    pill.addEventListener("click", function () { toggle(pill.dataset.vibe); });
  });

  /* ── Wire up in-card vibe buttons ───────────────────────── */

  document.querySelectorAll(".vcard-vibe").forEach(function (el) {
    el.addEventListener("click", function () { toggle(el.dataset.vibe); });
  });

  /* ── Clear button ───────────────────────────────────────── */

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      active.clear();
      writeUrl();
      syncPills();
      apply();
    });
  }

  /* ── Boot filter from URL then apply ────────────────────── */

  readUrl();
  syncPills();
  apply();

  /* ── Save without login ─────────────────────────────────── */

  var STORE = "trndie_saved_venues";

  function readSaved() {
    try {
      var raw = window.localStorage.getItem(STORE);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeSaved(arr) {
    try { window.localStorage.setItem(STORE, JSON.stringify(arr)); }
    catch (e) {}
  }

  var saved = readSaved();

  document.querySelectorAll(".vcard-save").forEach(function (btn) {
    var card = btn.closest(".vcard");
    var name = card ? card.dataset.venue : null;
    if (!name) return;

    function paint() {
      var on = saved.indexOf(name) !== -1;
      btn.classList.toggle("is-saved", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }

    paint();

    btn.addEventListener("click", function () {
      var i = saved.indexOf(name);
      if (i === -1) saved.push(name);
      else saved.splice(i, 1);
      writeSaved(saved);
      paint();
    });
  });

}());
