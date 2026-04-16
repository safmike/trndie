(function () {
  "use strict";

  var SUB_INTERVAL     = 5000;   // ms between sub-tagline swaps
  var TREND_INTERVAL   = 6500;   // ms between city swaps in sidebar
  var FADE_MS          = 320;    // opacity transition duration

  // ── Rotating sub-tagline ──────────────────────────────────────────────────

  var SUB_LINES = [
    "Updated weekly with real social signals.",
    "Ranked by TikTok buzz and Google Trends data.",
    "8 cities \u00b7 80 venues \u00b7 all trending right now.",
    "What\u2019s going viral before the crowds show up.",
  ];

  function initSubLine() {
    var el = document.querySelector(".tagline-sub");
    if (!el) return;

    el.style.transition = "opacity " + FADE_MS + "ms ease";

    var idx = 0;
    setInterval(function () {
      idx = (idx + 1) % SUB_LINES.length;
      el.style.opacity = "0";
      setTimeout(function () {
        el.textContent  = SUB_LINES[idx];
        el.style.opacity = "0.7";
      }, FADE_MS);
    }, SUB_INTERVAL);
  }

  // ── Trending sidebar ──────────────────────────────────────────────────────

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatSignal(v) {
    if (v.viral) return { text: "Viral", cls: "is-viral" };
    var t = v.tiktok;
    if (t >= 1000) return { text: (t / 1000).toFixed(1) + "k TikTok", cls: "is-score" };
    if (t > 0)     return { text: t + " TikTok", cls: "is-score" };
    return           { text: v.score + " score",  cls: "is-score" };
  }

  function venueHtml(v, i) {
    var sig = formatSignal(v);
    return (
      '<div class="trending-venue">' +
        '<span class="trending-rank">' + (i + 1) + "</span>" +
        '<div class="trending-venue-info">' +
          '<div class="trending-venue-name">'     + escHtml(v.name)     + "</div>" +
          '<div class="trending-venue-location">' + escHtml(v.location) + "</div>" +
          '<div class="trending-venue-signal '    + sig.cls + '">'      + escHtml(sig.text) + "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function initTrending() {
    var cities   = window.TRNDIE_TRENDING;
    var cityEl   = document.querySelector(".trending-city");
    var venuesEl = document.querySelector(".trending-venues");
    var dots     = document.querySelectorAll(".trending-dot");

    if (!cities || !cities.length || !cityEl || !venuesEl) return;

    cityEl.style.transition   = "opacity " + FADE_MS + "ms ease";
    venuesEl.style.transition = "opacity " + FADE_MS + "ms ease";

    function setDots(idx) {
      dots.forEach(function (d, i) {
        d.classList.toggle("active", i === idx);
      });
    }

    function paint(idx) {
      var city = cities[idx];
      cityEl.textContent = city.name;
      venuesEl.innerHTML = city.venues.map(venueHtml).join("");
      setDots(idx);
    }

    function rotateTo(idx) {
      cityEl.style.opacity   = "0";
      venuesEl.style.opacity = "0";
      setTimeout(function () {
        paint(idx);
        cityEl.style.opacity   = "1";
        venuesEl.style.opacity = "1";
      }, FADE_MS);
    }

    // First paint — no animation
    paint(0);

    // Stagger start by half the interval so sub-line and city swaps never coincide
    var cityIdx = 0;
    setTimeout(function () {
      setInterval(function () {
        cityIdx = (cityIdx + 1) % cities.length;
        rotateTo(cityIdx);
      }, TREND_INTERVAL);
    }, TREND_INTERVAL / 2);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initSubLine();
      initTrending();
    });
  } else {
    initSubLine();
    initTrending();
  }

})();
