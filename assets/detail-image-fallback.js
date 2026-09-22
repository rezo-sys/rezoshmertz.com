/**
 * Detail pages: hide broken remote/local artwork chrome and show a source-link fallback.
 * Scoped to figures marked data-visual-fallback. Does not touch shared assets.
 */
(function () {
  document.querySelectorAll("[data-visual-fallback]").forEach(function (fig) {
    var img = fig.querySelector("[data-visual-img]");
    var fallback = fig.querySelector(".visual-fallback");
    if (!img || !fallback) return;
    function reveal() {
      fig.classList.add("is-broken");
      fallback.hidden = false;
    }
    if (img.complete && img.naturalWidth === 0) {
      reveal();
      return;
    }
    img.addEventListener("error", reveal);
  });
})();
