function filterVenues() {
  const area = document.getElementById("areaFilter").value;
  const vibe = document.getElementById("vibeFilter").value;

  document.querySelectorAll(".venue-card").forEach(function (card) {
    const areaMatch = area === "all" || card.dataset.area === area;
    const vibeMatch = vibe === "all" || card.dataset.vibe === vibe;
    card.style.display = areaMatch && vibeMatch ? "block" : "none";
  });
}
