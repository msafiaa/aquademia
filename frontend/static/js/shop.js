/* ==========================================================================
   Aquademia Decoration Shop Controller
   ========================================================================== */
(function () {
  "use strict";

  var catalogContainer = document.getElementById("shop-catalog-grid");
  var inventoryContainer = document.getElementById("shop-inventory-grid");
  var userPearlsEl = document.getElementById("user-pearls");
  var userPearlsHeaderEl = document.getElementById("user-pearls-header");

  var tabCatalog = document.getElementById("tab-shop-catalog");
  var tabInventory = document.getElementById("tab-shop-inventory");
  var viewCatalog = document.getElementById("view-catalog");
  var viewInventory = document.getElementById("view-inventory");

  // Placement modal elements
  var placementModal = document.getElementById("placement-modal");
  var miniTankPreview = document.getElementById("mini-tank-preview");
  var miniTankMarker = document.getElementById("mini-tank-marker");
  var btnSavePlacement = document.getElementById("btn-save-placement");
  var btnRemovePlacement = document.getElementById("btn-remove-placement");
  var btnClosePlacement = document.getElementById("btn-close-placement");
  var placementItemTitle = document.getElementById("placement-item-title");

  // State
  var currentStudent = null;
  var currentPearls = 0;
  var shopItems = [];
  var inventoryItems = [];
  var activeInventoryItem = null;
  var selectedCoords = { x: 0.5, y: 0.8 };

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

      loadWallet();
      loadCatalog();
      loadInventory();
    });

  /* ------------------------------------------------------------------
     Tabs
     ------------------------------------------------------------------ */
  tabCatalog.addEventListener("click", function () {
    tabCatalog.classList.add("active");
    tabInventory.classList.remove("active");
    viewCatalog.hidden = false;
    viewInventory.hidden = true;
  });

  tabInventory.addEventListener("click", function () {
    tabInventory.classList.add("active");
    tabCatalog.classList.remove("active");
    viewInventory.hidden = false;
    viewCatalog.hidden = true;
    renderInventory();
  });

  /* ------------------------------------------------------------------
     Load Wallet Balance
     ------------------------------------------------------------------ */
  function loadWallet() {
    fetch("/api/shop/wallet", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && typeof data.available_pearls !== "undefined") {
          currentPearls = data.available_pearls;
          userPearlsEl.textContent = currentPearls;
          userPearlsHeaderEl.textContent = currentPearls;
        }
      });
  }

  /* ------------------------------------------------------------------
     Load Catalog & Inventory
     ------------------------------------------------------------------ */
  function loadCatalog() {
    fetch("/api/shop/items", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        shopItems = (data && data.items) || [];
        renderCatalog();
      });
  }

  function loadInventory() {
    fetch("/api/shop/inventory", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        inventoryItems = (data && data.items) || [];
        renderCatalog();
        renderInventory();
      });
  }

  /* ------------------------------------------------------------------
     Render Catalog
     ------------------------------------------------------------------ */
  function renderCatalog() {
    catalogContainer.innerHTML = "";
    var ownedItemIds = new Set(inventoryItems.map(function (inv) { return inv.item_id; }));

    shopItems.forEach(function (item) {
      var isOwned = ownedItemIds.has(item.item_id);
      var card = document.createElement("div");
      card.className = "shop-item-card bubble-panel" + (isOwned ? " owned" : "");

      var actionHtml = isOwned
        ? '<span class="owned-badge">Sudah Dimiliki &check;</span>'
        : '<button type="button" class="aq-btn aq-btn--primary btn-buy" data-id="' + item.item_id + '">Beli</button>';

      card.innerHTML =
        '<div class="item-img-container">' +
        '  <img src="' + (item.image_path || "/static/images/shop/pink_coral.png") + '" alt="' + item.item_name + '">' +
        '</div>' +
        '<span class="item-badge-category">' + (item.category || "Hiasan") + '</span>' +
        '<h3 class="item-title">' + item.item_name + '</h3>' +
        '<p class="item-desc">' + item.description + '</p>' +
        '<div class="item-bottom-bar">' +
        '  <span class="item-price-tag">🐚 ' + item.price + ' Mutiara</span>' +
        '  ' + actionHtml +
        '</div>';

      if (!isOwned) {
        var buyBtn = card.querySelector(".btn-buy");
        buyBtn.addEventListener("click", function () {
          handlePurchase(item);
        });
      }

      catalogContainer.appendChild(card);
    });
  }

  /* ------------------------------------------------------------------
     Purchase Flow
     ------------------------------------------------------------------ */
  function handlePurchase(item) {
    if (currentPearls < item.price) {
      alert("Mutiara tidak mencukupi! Anda memerlukan " + item.price + " mutiara tetapi baki anda hanya " + currentPearls + " mutiara. Selesaikan lebih banyak kuiz untuk mengumpul mutiara!");
      return;
    }

    var ok = confirm("Adakah anda pasti mahu membeli \"" + item.item_name + "\" dengan harga " + item.price + " mutiara?");
    if (!ok) return;

    fetch("/api/shop/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ item_id: item.item_id })
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (result.error) {
          alert("Pembelian gagal: " + result.error);
          return;
        }

        alert("Tahniah! Anda berjaya membeli " + item.item_name + "! Ia kini berada dalam Inventori Saya.");
        loadWallet();
        loadInventory();
      })
      .catch(function () {
        alert("Ralat semasa berhubung dengan kedai lautan. Sila cuba lagi!");
      });
  }

  /* ------------------------------------------------------------------
     Render Inventory
     ------------------------------------------------------------------ */
  function renderInventory() {
    inventoryContainer.innerHTML = "";

    if (inventoryItems.length === 0) {
      inventoryContainer.innerHTML =
        '<div style="grid-column: 1 / -1; text-align: center; color: var(--aq-muted); padding: 2rem;">' +
        '<p>Inventori anda masih kosong. Pilih hiasan menarik di tab Katalog Kedai untuk menceriakan akuarium anda!</p>' +
        '</div>';
      return;
    }

    inventoryItems.forEach(function (inv) {
      var card = document.createElement("div");
      card.className = "shop-item-card bubble-panel";

      var statusText = inv.is_placed
        ? '<span style="color: var(--aq-success); font-weight:700;">&check; Di Akuarium</span>'
        : '<span style="color: var(--aq-muted); font-weight:700;">Dalam Simpanan</span>';

      card.innerHTML =
        '<div class="item-img-container">' +
        '  <img src="' + (inv.image_path || "/static/images/shop/pink_coral.png") + '" alt="' + inv.item_name + '">' +
        '</div>' +
        '<h3 class="item-title">' + inv.item_name + '</h3>' +
        '<p class="item-desc">' + (inv.description || "Hiasan indah akuarium.") + '</p>' +
        '<div class="item-bottom-bar">' +
        '  ' + statusText +
        '  <button type="button" class="aq-btn aq-btn--primary btn-place" style="min-height:36px; padding:0.35rem 0.9rem; font-size:0.85rem;">' +
        '    Urus Kedudukan' +
        '  </button>' +
        '</div>';

      card.querySelector(".btn-place").addEventListener("click", function () {
        openPlacementModal(inv);
      });

      inventoryContainer.appendChild(card);
    });
  }

  /* ------------------------------------------------------------------
     Placement Flow
     ------------------------------------------------------------------ */
  function openPlacementModal(inv) {
    activeInventoryItem = inv;
    placementItemTitle.textContent = inv.item_name;
    miniTankMarker.src = inv.image_path || "/static/images/shop/pink_coral.png";

    selectedCoords.x = inv.position_x !== null ? inv.position_x : 0.5;
    selectedCoords.y = inv.position_y !== null ? inv.position_y : 0.8;
    updateMarkerPos();

    btnRemovePlacement.hidden = !inv.is_placed;
    placementModal.classList.add("active");
  }

  function updateMarkerPos() {
    miniTankMarker.style.left = (selectedCoords.x * 100) + "%";
    miniTankMarker.style.top = (selectedCoords.y * 100) + "%";
  }

  miniTankPreview.addEventListener("click", function (e) {
    var rect = miniTankPreview.getBoundingClientRect();
    var clickX = (e.clientX - rect.left) / rect.width;
    var clickY = (e.clientY - rect.top) / rect.height;

    selectedCoords.x = Math.max(0.05, Math.min(clickX, 0.95));
    selectedCoords.y = Math.max(0.2, Math.min(clickY, 0.9)); // inside tank bounds
    updateMarkerPos();
  });

  btnSavePlacement.addEventListener("click", function () {
    if (!activeInventoryItem) return;

    btnSavePlacement.disabled = true;
    fetch("/api/shop/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        inventory_id: activeInventoryItem.inventory_id,
        is_placed: true,
        position_x: selectedCoords.x,
        position_y: selectedCoords.y
      })
    })
      .then(function (res) { return res.json(); })
      .then(function () {
        btnSavePlacement.disabled = false;
        placementModal.classList.remove("active");
        loadInventory();
        alert("Kedudukan " + activeInventoryItem.item_name + " di akuarium telah berjaya dikemaskini!");
      })
      .catch(function () {
        btnSavePlacement.disabled = false;
        alert("Gagal mengemaskini kedudukan. Sila cuba lagi.");
      });
  });

  btnRemovePlacement.addEventListener("click", function () {
    if (!activeInventoryItem) return;

    btnRemovePlacement.disabled = true;
    fetch("/api/shop/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        inventory_id: activeInventoryItem.inventory_id,
        is_placed: false
      })
    })
      .then(function (res) { return res.json(); })
      .then(function () {
        btnRemovePlacement.disabled = false;
        placementModal.classList.remove("active");
        loadInventory();
        alert(activeInventoryItem.item_name + " telah disimpan semula ke inventori.");
      })
      .catch(function () {
        btnRemovePlacement.disabled = false;
        alert("Gagal mengeluarkan hiasan. Sila cuba lagi.");
      });
  });

  btnClosePlacement.addEventListener("click", function () {
    placementModal.classList.remove("active");
  });
})();
