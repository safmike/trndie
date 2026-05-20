(function () {
  "use strict";

  var grid = document.querySelector(".all-venues .venue-grid-v2");
  if (!grid) return;

  var cards     = Array.prototype.slice.call(grid.querySelectorAll(".vcard"));
  var vibePills = Array.prototype.slice.call(document.querySelectorAll(".all-venues .vibe-pill"));
  var cityChips = Array.prototype.slice.call(document.querySelectorAll(".all-venues .city-chip"));
  var clearBtn  = document.querySelector(".all-venues .filter-clear");
  var activeEl  = document.querySelector(".all-venues .filter-active");
  var emptyMsg  = document.querySelector(".all-venues-empty");

  var activeVibes  = new Set();
  var activeCities = new Set();

  /* ── URL state ──────────────────────────────────────────── */

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    var v = params.get("vibes");
    var c = params.get("cities");
    if (v) v.split(",").forEach(function (x) { x = x.trim(); if (x) activeVibes.add(x); });
    if (c) c.split(",").forEach(function (x) { x = x.trim(); if (x) activeCities.add(x); });
  }

  function writeUrl() {
    var params = new URLSearchParams(window.location.search);
    if (activeVibes.size)  params.set("vibes",  Array.from(activeVibes).join(","));
    else                   params.delete("vibes");
    if (activeCities.size) params.set("cities", Array.from(activeCities).join(","));
    else                   params.delete("cities");
    var qs  = params.toString();
    var url = window.location.pathname + (qs ? "?" + qs : "");
    window.history.replaceState(null, "", url);
  }

  /* ── Filter logic ───────────────────────────────────────── */

  function apply() {
    var shown = 0;
    cards.forEach(function (card) {
      var vibes = (card.dataset.vibes || "").split(" ").filter(Boolean);
      var city  = card.dataset.city || "";

      var vibeMatch = activeVibes.size === 0
        || vibes.some(function (v) { return activeVibes.has(v); });
      var cityMatch = activeCities.size === 0 || activeCities.has(city);

      var match = vibeMatch && cityMatch;
      card.hidden = !match;
      if (match) shown++;
    });
    if (emptyMsg) emptyMsg.hidden = shown !== 0;
  }

  /* ── Active-filter summary + clear button ───────────────── */

  function labelFor(btn) { return (btn.textContent || "").trim(); }

  function syncMeta() {
    var hasFilters = activeVibes.size > 0 || activeCities.size > 0;
    if (clearBtn) clearBtn.hidden = !hasFilters;
    if (!activeEl) return;

    if (!hasFilters) {
      activeEl.hidden = true;
      activeEl.textContent = "";
      return;
    }

    var parts = [];
    if (activeVibes.size) {
      var vibeLabels = vibePills
        .filter(function (p) { return activeVibes.has(p.dataset.vibe); })
        .map(labelFor);
      parts.push(vibeLabels.join(", "));
    }
    if (activeCities.size) {
      var cityLabels = cityChips
        .filter(function (p) { return activeCities.has(p.dataset.city); })
        .map(labelFor);
      parts.push(cityLabels.join(", "));
    }
    activeEl.hidden = false;
    activeEl.textContent = "Filtering by " + parts.join(" · ");
  }

  /* ── Sync visual state ──────────────────────────────────── */

  function syncControls() {
    vibePills.forEach(function (p) {
      var on = activeVibes.has(p.dataset.vibe);
      p.classList.toggle("is-active", on);
      p.setAttribute("aria-pressed", on ? "true" : "false");
    });
    cityChips.forEach(function (p) {
      var on = activeCities.has(p.dataset.city);
      p.classList.toggle("is-active", on);
      p.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll(".all-venues .vcard-vibe").forEach(function (el) {
      el.classList.toggle("is-active", activeVibes.has(el.dataset.vibe));
    });
    syncMeta();
  }

  /* ── Toggles ────────────────────────────────────────────── */

  function toggleVibe(v) {
    if (activeVibes.has(v)) activeVibes.delete(v); else activeVibes.add(v);
    writeUrl(); syncControls(); apply();
  }

  function toggleCity(c) {
    if (activeCities.has(c)) activeCities.delete(c); else activeCities.add(c);
    writeUrl(); syncControls(); apply();
  }

  /* ── Wire up controls ───────────────────────────────────── */

  vibePills.forEach(function (p) {
    p.addEventListener("click", function () { toggleVibe(p.dataset.vibe); });
  });
  cityChips.forEach(function (p) {
    p.addEventListener("click", function () { toggleCity(p.dataset.city); });
  });
  document.querySelectorAll(".all-venues .vcard-vibe").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      toggleVibe(el.dataset.vibe);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      activeVibes.clear();
      activeCities.clear();
      writeUrl(); syncControls(); apply();
    });
  }

  readUrl();
  syncControls();
  apply();

  /* ── Save without login (mirrors city-v2.js) ────────────── */

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

  document.querySelectorAll(".all-venues .vcard-save").forEach(function (btn) {
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
