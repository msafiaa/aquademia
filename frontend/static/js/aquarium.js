/* ==========================================================================
   Aquademia My Aquarium Controller
   ========================================================================== */
(function () {
  "use strict";

  var tankContainer = document.getElementById("aquarium-tank");
  var collectionContainer = document.getElementById("fish-collection-grid");
  var emptyTankMsg = document.getElementById("empty-tank-msg");

  // Fish images mapping
  var FISH_IMAGES = {
    "Royal Betta": "/static/images/fish/fish-1.jpg",
    "Angelfish": "/static/images/fish/fish-2.jpg",
    "Clownfish": "/static/images/fish/fish-3.jpg",
    "Neon Tetra": "/static/images/fish/fish-4.jpg",
    "Guppy": "/static/images/fish/fish-5.jpg"
  };

  function decorationEmoji(item) {
    var name = (item.item_name || "").toLowerCase();
    if (name.indexOf("rock") !== -1 || name.indexOf("stone") !== -1) return "🪨";
    if (name.indexOf("clam") !== -1) return "🐚";
    if (name.indexOf("oyster") !== -1) return "🦪";
    if (name.indexOf("jelly") !== -1) return "🪼";
    if (name.indexOf("dolphin") !== -1) return "🐬";
    if (name.indexOf("arch") !== -1) return "🏛️";
    if (name.indexOf("coral") !== -1) return "🪸";
    if (name.indexOf("shell") !== -1) return "🐚";
    if (name.indexOf("chest") !== -1 || name.indexOf("treasure") !== -1) return "💰";
    if (name.indexOf("ship") !== -1 || name.indexOf("wreck") !== -1) return "🚢";
    if (name.indexOf("lamp") !== -1 || name.indexOf("light") !== -1) return "💡";
    if (name.indexOf("flower") !== -1 || name.indexOf("bloom") !== -1) return "🌸";
    if (name.indexOf("crown") !== -1) return "👑";
    if (name.indexOf("castle") !== -1) return "🏰";
    if (name.indexOf("seaweed") !== -1 || name.indexOf("plant") !== -1) return "🌿";
    if (name.indexOf("starfish") !== -1 || name.indexOf("star") !== -1) return "⭐";
    return "✨";
  }

  // State
  var currentStudent = null;
  var currentView = "weekly";
  var currentWeekIndex = 0; // 0 to 3
  var weeklyAquariums = [];
  var monthlyOceanFish = [];
  var placedDecorations = [];

  /* ------------------------------------------------------------------
     Initialization & Student Session
     ------------------------------------------------------------------ */
  fetch("/api/auth/me", { credentials: "same-origin" })
    .then(function (res) {
      if (!res.ok) { window.location.assign("/login"); return null; }
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.student) return;
      currentStudent = data.student;
      document.getElementById("user-display").textContent = "Hai, " + currentStudent.username + "!";

      loadStats();
      loadDecorations();
      loadAquariumData();
    });

  // Wallet balance
  fetch("/api/shop/wallet", { credentials: "same-origin" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && typeof d.available_pearls !== "undefined") {
        document.getElementById("user-pearls").textContent = d.available_pearls;
      }
    });

  /* ------------------------------------------------------------------
     Load Stats from Backend
     ------------------------------------------------------------------ */
  function loadStats() {
    fetch("/api/aquarium/stats", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (stats) {
        if (!stats) return;
        document.getElementById("stat-fish-total").textContent = stats.total_fish || 0;
        document.getElementById("stat-pearls-total").textContent = stats.total_pearls || 0;
      });
  }

  /* ------------------------------------------------------------------
     Load Placed Decorations
     ------------------------------------------------------------------ */
  function loadDecorations() {
    fetch("/api/shop/inventory", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var items = (data && data.items) || [];
        placedDecorations = items.filter(function (it) { return it.is_placed; });
        renderDecorations();
      });
  }

  function renderDecorations() {
    // Remove previous placed decoration elements
    Array.prototype.forEach.call(tankContainer.querySelectorAll(".tank-placed-decoration"), function (el) {
      el.remove();
    });

    placedDecorations.forEach(function (dec) {
      var decoration = document.createElement("span");
      decoration.className = "tank-placed-decoration";
      decoration.textContent = decorationEmoji(dec);
      decoration.setAttribute("role", "img");
      decoration.setAttribute("aria-label", dec.item_name || "Hiasan");

      // Position relative inside tank
      var posX = Math.round((dec.position_x !== null ? dec.position_x : 0.5) * 85);
      var posY = Math.round((dec.position_y !== null ? dec.position_y : 0.8) * 45 + 35); // towards bottom
      decoration.style.left = Math.max(5, Math.min(posX, 85)) + "%";
      decoration.style.top = Math.max(25, Math.min(posY, 75)) + "%";

      tankContainer.appendChild(decoration);
    });
  }

  /* ------------------------------------------------------------------
     Load Aquarium Fish Data
     ------------------------------------------------------------------ */
  function loadAquariumData() {
    // Load weekly view first
    fetch("/api/aquarium?view=weekly", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.aquariums) return;
        weeklyAquariums = data.aquariums;
        renderActiveView();
      });

    // Also load monthly data for monthly ocean view
    fetch("/api/aquarium?view=monthly", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.monthly_ocean && data.monthly_ocean.fish) {
          monthlyOceanFish = data.monthly_ocean.fish;
        }
      });
  }

  /* ------------------------------------------------------------------
     Render Active View
     ------------------------------------------------------------------ */
  function renderActiveView() {
    var activeFishList = [];

    if (currentView === "monthly") {
      activeFishList = monthlyOceanFish;
      document.getElementById("current-view-title").textContent = "Pemandangan Lautan Bulanan (Semua Ikan)";
    } else {
      var aq = weeklyAquariums[currentWeekIndex] || { fish: [] };
      activeFishList = aq.fish || [];
      document.getElementById("current-view-title").textContent = "Akuarium Minggu " + (currentWeekIndex + 1);
    }

    renderTankFish(activeFishList);
    renderCollectionGrid(activeFishList);
  }

  function renderTankFish(fishList) {
    // Remove previous fish elements
    Array.prototype.forEach.call(tankContainer.querySelectorAll(".tank-swimming-fish"), function (el) {
      el.remove();
    });

    if (!fishList || fishList.length === 0) {
      emptyTankMsg.hidden = false;
      return;
    }

    emptyTankMsg.hidden = true;

    fishList.forEach(function (f, idx) {
      var img = document.createElement("img");
      img.className = "tank-swimming-fish";
      img.src = FISH_IMAGES[f.fish_type] || "/static/images/fish/fish-1.jpg";
      img.alt = f.fish_type;
      img.title = f.fish_type + " (+" + f.pearls_earned + " mutiara)";

      // Randomized vertical swimming lane and timing
      var topPct = 12 + (idx * 16) % 55;
      var dur = 12 + (idx * 3) % 10;
      var delay = -(idx * 2.5);

      img.style.top = topPct + "%";
      img.style.setProperty("--swim-dur", dur + "s");
      img.style.setProperty("--swim-delay", delay + "s");

      tankContainer.appendChild(img);
    });
  }

  function renderCollectionGrid(fishList) {
    collectionContainer.innerHTML = "";

    if (!fishList || fishList.length === 0) {
      collectionContainer.innerHTML =
        '<div style="grid-column: 1 / -1; text-align: center; color: var(--aq-muted); padding: 1.5rem;">' +
        'Tiada ikan dalam pandangan ini lagi. Selesaikan latihan kuiz untuk memenangi ikan baharu!' +
        '</div>';
      return;
    }

    fishList.forEach(function (f) {
      var card = document.createElement("div");
      card.className = "fish-item-card";
      card.innerHTML =
        '<img src="' + (FISH_IMAGES[f.fish_type] || "/static/images/fish/fish-1.jpg") + '" alt="' + f.fish_type + '" class="fish-thumb-img">' +
        '<div class="fish-item-name">' + f.fish_type + '</div>' +
        '<div class="fish-item-meta">🐚 +' + f.pearls_earned + ' Mutiara</div>' +
        (f.earned_at ? '<div class="fish-item-meta" style="font-size:0.75rem; margin-top:0.2rem;">' + f.earned_at.substring(0, 10) + '</div>' : '');
      collectionContainer.appendChild(card);
    });
  }

  /* ------------------------------------------------------------------
     View Switcher Controls
     ------------------------------------------------------------------ */
  var weekButtons = [
    document.getElementById("btn-week-1"),
    document.getElementById("btn-week-2"),
    document.getElementById("btn-week-3"),
    document.getElementById("btn-week-4")
  ];
  var btnMonthly = document.getElementById("btn-view-monthly");

  weekButtons.forEach(function (btn, index) {
    btn.addEventListener("click", function () {
      currentView = "weekly";
      currentWeekIndex = index;

      weekButtons.forEach(function (b) { b.classList.remove("active"); });
      btnMonthly.classList.remove("active");
      btn.classList.add("active");

      renderActiveView();
    });
  });

  btnMonthly.addEventListener("click", function () {
    currentView = "monthly";

    weekButtons.forEach(function (b) { b.classList.remove("active"); });
    btnMonthly.classList.add("active");

    renderActiveView();
  });
})();
