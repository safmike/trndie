(function () {
  "use strict";

  // Read the current value of a select by id, defaulting to "all" if absent.
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : "all";
  }

  function applyFilters() {
    var area     = val("areaFilter");
    var vibe     = val("vibeFilter");
    var category = val("categoryFilter");
    var city     = val("cityFilter");

    var visible = 0;

    document.querySelectorAll(".venue-card").forEach(function (card) {
      var d = card.dataset;
      var show =
        (area     === "all" || d.area     === area)     &&
        (vibe     === "all" || d.vibe     === vibe)     &&
        (category === "all" || d.category === category) &&
        (city     === "all" || d.city     === city);

      card.style.display = show ? "" : "none";
      if (show) visible++;
    });

    var counter = document.getElementById("venueCount");
    if (counter) {
      counter.textContent = visible + (visible === 1 ? " venue" : " venues");
    }

    var empty = document.getElementById("noResults");
    if (empty) {
      empty.style.display = visible === 0 ? "block" : "none";
    }
  }

  // Attach to every filter select on the page, regardless of which page it is.
  document.querySelectorAll(".filter-select").forEach(function (select) {
    select.addEventListener("change", applyFilters);
  });

  // Run once on load to populate the count.
  applyFilters();
}());
