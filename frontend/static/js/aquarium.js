/* ==========================================================================
   Aquademia My Aquarium Controller
   ========================================================================== */
(function () {
  "use strict";

  var tankContainer = document.getElementById("aquarium-tank");
  var collectionContainer = document.getElementById("fish-collection-grid");
  var emptyTankMsg = document.getElementById("empty-tank-msg");
  var parcelModal = document.getElementById("parcel-modal");
  var parcelVisual = document.getElementById("parcel-visual");
  var parcelTitle = document.getElementById("parcel-title");
  var parcelCopy = document.getElementById("parcel-copy");
  var parcelStatus = document.getElementById("parcel-status");
  var parcelAction = document.getElementById("parcel-action");

  // Fish images mapping
  var FISH_IMAGES = {
    "Royal Betta": "/static/images/fish/transparent/fish-1.png",
    "Angelfish": "/static/images/fish/transparent/fish-2.png",
    "Clownfish": "/static/images/fish/transparent/fish-3.png",
    "Neon Tetra": "/static/images/fish/transparent/fish-4.png",
    "Guppy": "/static/images/fish/transparent/fish-5.png"
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
  var currentWeekIndex = Math.min(Math.floor((new Date().getDate() - 1) / 7), 3);
  var weeklyAquariums = [];
  var monthlyOceanFish = [];
  var placedDecorations = [];
  var pendingParcels = [];
  var activeParcel = null;
  var parcelRevealed = false;

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
        var totalFish = stats.total_fish || 0;
        document.getElementById("stat-fish-total").textContent = totalFish;
        document.getElementById("stat-pearls-total").textContent = stats.total_pearls || 0;
        updateExplorerMission(totalFish);
      });
  }

  function updateExplorerMission(totalFish) {
    var milestones = [5, 10, 15];
    var badgeNames = ["Lencana Cengkerang", "Lencana Bintang", "Lencana Lumba-lumba"];
    var unlocked = milestones.filter(function (milestone) {
      return totalFish >= milestone;
    }).length;
    var progress = Math.min(totalFish, 15);
    var progressBar = document.getElementById("explorer-progress");
    var progressFill = document.getElementById("explorer-progress-fill");
    var progressLabel = document.getElementById("explorer-progress-label");

    progressBar.setAttribute("aria-valuemax", "15");
    progressBar.setAttribute("aria-valuenow", String(progress));
    progressFill.style.width = (progress / 15 * 100) + "%";

    if (unlocked === milestones.length) {
      progressLabel.textContent = "Hebat! Semua 3 lencana koleksi sudah dibuka!";
    } else {
      var nextMilestone = milestones[unlocked];
      var remaining = nextMilestone - totalFish;
      progressLabel.textContent = remaining + " ikan lagi untuk membuka " + badgeNames[unlocked] + ". Lencana ini untuk koleksi sahaja!";
    }

    Array.prototype.forEach.call(document.querySelectorAll(".mission-badge"), function (badge, index) {
      var earned = index < unlocked;
      badge.classList.toggle("is-earned", earned);
      badge.setAttribute(
        "aria-label",
        badgeNames[index] + (earned ? " sudah dibuka" : " belum dibuka")
      );
    });
  }

  /* ------------------------------------------------------------------
     Load Placed Decorations
     ------------------------------------------------------------------ */
  function loadDecorations() {
    fetch("/api/shop/inventory", { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("Unable to load aquarium decorations.");
        return res.json();
      })
      .then(function (data) {
        var items = (data && data.items) || [];
        placedDecorations = items.filter(function (it) { return it.is_placed; });
        pendingParcels = items.filter(function (it) { return !it.is_unboxed; });
        var decorationCount = document.getElementById("stat-decor-total");
        if (decorationCount) decorationCount.textContent = placedDecorations.length;
        renderDecorations();
        showNextParcel();
      })
      .catch(function (error) {
        console.error("Aquarium decorations error:", error);
      });
  }

  function showNextParcel() {
    if (activeParcel || pendingParcels.length === 0) return;

    activeParcel = pendingParcels[0];
    parcelRevealed = false;
    parcelVisual.textContent = "📦";
    parcelVisual.classList.remove("parcel-box--opened");
    parcelTitle.textContent = "Parcel sedang tiba!";
    parcelCopy.textContent =
      activeParcel.item_name + " sedang diturunkan oleh crane dari kedai. Sedia untuk buka?";
    parcelStatus.textContent = "";
    parcelAction.textContent = "Buka Parcel!";
    parcelAction.disabled = true;
    parcelModal.hidden = false;
    parcelModal.classList.remove("is-arriving");
    parcelModal.offsetHeight;
    parcelModal.classList.add("is-arriving");

    window.setTimeout(function () {
      parcelAction.disabled = false;
      parcelAction.focus();
    }, 850);
  }

  function unboxActiveParcel() {
    if (!activeParcel || parcelAction.disabled) return;

    if (parcelRevealed) {
      pendingParcels.shift();
      activeParcel = null;
      parcelModal.hidden = true;
      showNextParcel();
      return;
    }

    parcelAction.disabled = true;
    parcelStatus.textContent = "Sedang membuka parcel...";
    fetch("/api/shop/unbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ inventory_id: activeParcel.inventory_id })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Parcel tidak dapat dibuka.");
          return data;
        });
      })
      .then(function (item) {
        parcelRevealed = true;
        parcelVisual.textContent = decorationEmoji(item);
        parcelVisual.classList.add("parcel-box--opened");
        parcelTitle.textContent = "Wah! " + item.item_name + "!";
        parcelCopy.textContent = "Hiasan baharu anda sudah diletakkan di dalam akuarium.";
        parcelStatus.textContent = "Berjaya! Hiasan ini sekarang milik anda.";
        parcelAction.textContent = "Tengok Akuarium!";

        placedDecorations.push(item);
        var decorationCount = document.getElementById("stat-decor-total");
        if (decorationCount) decorationCount.textContent = placedDecorations.length;
        renderDecorations();
        parcelAction.disabled = false;
        parcelAction.focus();
      })
      .catch(function (error) {
        parcelStatus.textContent = error.message || "Parcel gagal dibuka. Cuba lagi.";
        parcelAction.disabled = false;
      });
  }

  parcelAction.addEventListener("click", unboxActiveParcel);

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

      // Shop positions are normalized to the full tank (0 to 1).
      var posX = dec.position_x !== null ? dec.position_x : 0.5;
      var posY = dec.position_y !== null ? dec.position_y : 0.8;
      decoration.style.left = (Math.max(0, Math.min(posX, 1)) * 100) + "%";
      decoration.style.top = (Math.max(0, Math.min(posY, 1)) * 100) + "%";

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
          if (currentView === "monthly") renderActiveView();
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
      document.getElementById("current-view-title").textContent = "Semua Ikan Bulan Ini";
    } else {
      var aq = weeklyAquariums[currentWeekIndex] || { fish: [] };
      activeFishList = aq.fish || [];
      document.getElementById("current-view-title").textContent = "Akuarium Minggu " + (currentWeekIndex + 1);
    }

    document.getElementById("view-fish-count").textContent = activeFishList.length === 0
      ? "Jom cari ikan di kawasan lain!"
      : activeFishList.length + " ekor ikan sedang berenang!";
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
      img.src = FISH_IMAGES[f.fish_type] || "/static/images/fish/fish-1-2.png";
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
        '<img src="' + (FISH_IMAGES[f.fish_type] || "/static/images/fish/fish-1-2.png") + '" alt="' + f.fish_type + '" class="fish-thumb-img">' +
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
    if (index === currentWeekIndex) {
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
    }

    btn.addEventListener("click", function () {
      currentView = "weekly";
      currentWeekIndex = index;

      weekButtons.forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btnMonthly.classList.remove("active");
      btnMonthly.setAttribute("aria-pressed", "false");
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");

      renderActiveView();
    });
  });

  btnMonthly.addEventListener("click", function () {
    currentView = "monthly";

    weekButtons.forEach(function (b) {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    btnMonthly.classList.add("active");
    btnMonthly.setAttribute("aria-pressed", "true");

    renderActiveView();
  });
})();
