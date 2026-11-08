/* Aquademia shared: lightweight floating bubbles (decorative, GPU-friendly) */
(function () {
  "use strict";

  var layer = document.getElementById("aq-bubbles");
  if (!layer) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce && reduce.matches) return;           // no bubbles at all

  var small = window.innerWidth < 600;
  var count = small ? 9 : 16;                      // keep it light on phones

  for (var i = 0; i < count; i++) {
    var b = document.createElement("span");
    var size = 10 + Math.random() * (small ? 26 : 38);
    b.className = "aq-bubble";
    b.style.width = b.style.height = size.toFixed(0) + "px";
    b.style.left = (Math.random() * 96).toFixed(1) + "%";
    b.style.setProperty("--dur", (11 + Math.random() * 10).toFixed(1) + "s");
    b.style.setProperty("--delay", (-Math.random() * 18).toFixed(1) + "s");
    b.style.setProperty("--sway", (10 + Math.random() * 26).toFixed(0) + "px");
    layer.appendChild(b);
  }

  // Save battery: pause when the tab is hidden
  document.addEventListener("visibilitychange", function () {
    layer.parentNode.classList.toggle("aq-scene--paused", document.hidden);
  });
})();
