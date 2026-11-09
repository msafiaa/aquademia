/* ==========================================================================
   Aquademia Decoration Shop Controller
   ========================================================================== */
(function () {
  "use strict";

  var catalogContainer = document.getElementById("shop-catalog-grid");
  var inventoryContainer = document.getElementById("shop-inventory-grid");
  var userPearlsEl = document.getElementById("user-pearls");

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
  var catalogModal = document.getElementById("catalog-item-modal");
  var catalogPreviewTank = document.getElementById("catalog-preview-tank");
  var btnCatalogFavorite = document.getElementById("btn-catalog-favorite");
  var btnCatalogPlace = document.getElementById("btn-catalog-place");
  var btnCatalogBuy = document.getElementById("btn-catalog-buy");
  var activeCatalogItem = null;
  var selectedCatalogCategory = "Semua";
  var goalItemId = null;
  var goalInitialized = false;
  var previewCoords = { x: 0.5, y: 0.6 };

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
    document.getElementById("shop-category-chips").hidden = false;
    document.getElementById("shop-goal").hidden = false;
  });

  tabInventory.addEventListener("click", function () {
    tabInventory.classList.add("active");
    tabCatalog.classList.remove("active");
    viewInventory.hidden = false;
    viewCatalog.hidden = true;
    document.getElementById("shop-category-chips").hidden = true;
    document.getElementById("shop-goal").hidden = true;
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
          if (shopItems.length) renderCatalog();
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
    var counts = {};
    inventoryItems.forEach(function (inv) {
      counts[inv.item_id] = (counts[inv.item_id] || 0) + 1;
    });

    renderCategoryChips();
    renderShopGoal();

    shopItems.forEach(function (item) {
      if (selectedShopCategory(item) !== selectedCatalogCategory &&
          selectedCatalogCategory !== "Semua") return;

      var ownedCount = counts[item.item_id] || 0;
      var affordable = currentPearls >= item.price;
      var remaining = Math.max(0, item.price - currentPearls);
      var card = document.createElement("button");
      card.type = "button";
      card.className = "shop-item-card" + (affordable ? " can" : " cant");
      card.setAttribute("aria-label", item.item_name + ", " + item.price + " mutiara");
      card.innerHTML =
        (goalItemId === item.item_id ? '<span class="shop-goal-heart" aria-label="Sasaran">♥</span>' : "") +
        (ownedCount ? '<span class="shop-owned-count">×' + ownedCount + '</span>' : "") +
        '<span class="shop-item-emoji" aria-hidden="true">' + itemEmoji(item) + '</span>' +
        '<span class="shop-item-category">' + escapeHTML(categoryLabel(item.category)) + '</span>' +
        '<span class="shop-item-name">' + escapeHTML(item.item_name) + '</span>' +
        '<span class="shop-item-price">🐚 ' + item.price + '</span>' +
        (remaining
          ? '<span class="shop-item-progress"><i style="width:' +
            Math.min(100, currentPearls / item.price * 100) + '%"></i></span>' +
            '<span class="shop-item-remaining">Lagi ' + remaining + ' 🐚</span>'
          : '<span class="shop-item-ready">Mutiara mencukupi! Jom beli</span>');

      card.addEventListener("mouseenter", function () {
        setShopMessage(affordable
          ? item.item_name + "? Mutiara anda cukup! Jom beli."
          : item.item_name + ": lagi " + remaining + " mutiara diperlukan. Anda boleh!");
      });
      card.addEventListener("focus", function () {
        setShopMessage(affordable
          ? item.item_name + "? Mutiara anda cukup! Jom beli."
          : item.item_name + ": lagi " + remaining + " mutiara diperlukan. Anda boleh!");
      });
      card.addEventListener("click", function () {
        openCatalogItem(item);
      });
      catalogContainer.appendChild(card);
    });
  }

  function categoryLabel(category) {
    return {
      Coral: "Karang",
      Shell: "Kulit",
      Treasure: "Harta",
      Building: "Bangunan",
      Plant: "Tumbuhan",
      Decoration: "Hiasan",
      "Sea Life": "Hidupan Laut"
    }[category] || category || "Hiasan";
  }

  function categoryEmoji(category) {
    return {
      Coral: "🪸",
      Shell: "🐚",
      Treasure: "💰",
      Building: "🏰",
      Plant: "🌿",
      Decoration: "⭐",
      "Sea Life": "🪼"
    }[category] || "✨";
  }

  function itemEmoji(item) {
    var name = (item.item_name || "").toLowerCase();
    if (name.indexOf("rock") !== -1 || name.indexOf("stone") !== -1) return "🪨";
    if (name.indexOf("clam") !== -1) return "🐚";
    if (name.indexOf("oyster") !== -1) return "🦪";
    if (name.indexOf("jelly") !== -1) return "🪼";
    if (name.indexOf("dolphin") !== -1) return "🐬";
    if (name.indexOf("arch") !== -1) return "🏛️";
    if (name.indexOf("coral") !== -1) return "🪸";
    if (name.indexOf("shell") !== -1 || name.indexOf("pearl") !== -1) return "🐚";
    if (name.indexOf("chest") !== -1 || name.indexOf("treasure") !== -1) return "💰";
    if (name.indexOf("ship") !== -1 || name.indexOf("wreck") !== -1) return "🚢";
    if (name.indexOf("lamp") !== -1 || name.indexOf("light") !== -1) return "💡";
    if (name.indexOf("flower") !== -1 || name.indexOf("bloom") !== -1) return "🌸";
    if (name.indexOf("crown") !== -1) return "👑";
    if (name.indexOf("castle") !== -1) return "🏰";
    if (name.indexOf("seaweed") !== -1 || name.indexOf("plant") !== -1) return "🌿";
    if (name.indexOf("starfish") !== -1 || name.indexOf("star") !== -1) return "⭐";
    return categoryEmoji(item.category);
  }

  function selectedShopCategory(item) {
    return categoryLabel(item.category);
  }

  function renderCategoryChips() {
    var chips = document.getElementById("shop-category-chips");
    var categories = ["Semua"];
    shopItems.forEach(function (item) {
      var label = selectedShopCategory(item);
      if (categories.indexOf(label) === -1) categories.push(label);
    });

    chips.innerHTML = "";
    categories.forEach(function (category) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "shop-category-chip" +
        (category === selectedCatalogCategory ? " active" : "");
      button.setAttribute("aria-pressed", category === selectedCatalogCategory);
      button.textContent = category === "Semua"
        ? "🛍️ Semua"
        : categoryEmoji(shopItems.filter(function (item) {
          return selectedShopCategory(item) === category;
        })[0].category) + " " + category;
      button.addEventListener("click", function () {
        selectedCatalogCategory = category;
        renderCatalog();
      });
      chips.appendChild(button);
    });
  }

  function renderShopGoal() {
    var goal = shopItems.find(function (item) {
      return item.item_id === goalItemId;
    });
    if (!goal && !goalInitialized && shopItems.length) {
      goal = shopItems.slice().sort(function (a, b) {
        return a.price - b.price;
      })[0];
      goalItemId = goal.item_id;
      goalInitialized = true;
    }

    var goalBox = document.getElementById("shop-goal");
    if (!goal) {
      goalBox.textContent = shopItems.length
        ? "Pilih hiasan sebagai sasaran anda!"
        : "Kedai belum mempunyai hiasan.";
      return;
    }

    var progress = Math.min(100, currentPearls / goal.price * 100);
    goalBox.innerHTML =
      '<span class="shop-goal-title">♥ Sasaran: ' + itemEmoji(goal) + " " +
      escapeHTML(goal.item_name) + '</span>' +
      '<span class="shop-goal-progress"><i style="width:' + progress + '%"></i></span>' +
      '<span class="shop-goal-total">' + Math.min(currentPearls, goal.price) +
      " / " + goal.price + " 🐚</span>";
  }

  function setShopMessage(message) {
    document.getElementById("shop-host-message").textContent = message;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      }[char];
    });
  }

  function openCatalogItem(item) {
    activeCatalogItem = item;
    previewCoords = { x: 0.5, y: 0.6 };
    document.getElementById("catalog-modal-emoji").textContent = itemEmoji(item);
    document.getElementById("catalog-modal-title").textContent = item.item_name;
    document.getElementById("catalog-modal-description").textContent =
      item.description || "Hiasan indah untuk akuarium anda.";
    renderCatalogPreview(item);

    var ownedItem = inventoryItems.find(function (inv) {
      return inv.item_id === item.item_id;
    });
    btnCatalogPlace.hidden = !ownedItem;
    btnCatalogPlace.onclick = function () {
      closeCatalogItem();
      openPlacementModal(ownedItem);
    };
    btnCatalogFavorite.textContent = goalItemId === item.item_id
      ? "♥ Sasaran anda"
      : "♡ Jadikan sasaran";
    btnCatalogFavorite.onclick = function () {
      goalItemId = goalItemId === item.item_id ? null : item.item_id;
      btnCatalogFavorite.textContent = goalItemId === item.item_id
        ? "♥ Sasaran anda"
        : "♡ Jadikan sasaran";
      renderCatalog();
    };
    btnCatalogBuy.disabled = currentPearls < item.price;
    btnCatalogBuy.textContent = currentPearls >= item.price
      ? "Beli 🐚 " + item.price
      : "Lagi " + (item.price - currentPearls) + " 🐚";
    btnCatalogBuy.onclick = function () {
      handlePurchase(item);
    };
    catalogModal.hidden = false;
    document.getElementById("btn-catalog-close").focus();
  }

  function renderCatalogPreview(item) {
    catalogPreviewTank.innerHTML = "";
    inventoryItems.filter(function (inv) {
      return inv.is_placed;
    }).forEach(function (inv) {
      var placed = document.createElement("span");
      placed.className = "catalog-preview-decoration";
      placed.textContent = itemEmoji(inv);
      placed.style.left = ((inv.position_x === null ? 0.5 : inv.position_x) * 100) + "%";
      placed.style.top = ((inv.position_y === null ? 0.7 : inv.position_y) * 100) + "%";
      placed.setAttribute("aria-hidden", "true");
      catalogPreviewTank.appendChild(placed);
    });

    var ghost = document.createElement("span");
    ghost.className = "catalog-preview-decoration ghost";
    ghost.textContent = itemEmoji(item);
    ghost.style.left = (previewCoords.x * 100) + "%";
    ghost.style.top = (previewCoords.y * 100) + "%";
    ghost.setAttribute("aria-hidden", "true");
    catalogPreviewTank.appendChild(ghost);

    var movePreview = function (event) {
      var rect = catalogPreviewTank.getBoundingClientRect();
      previewCoords.x = Math.max(0.03, Math.min(0.97, (event.clientX - rect.left) / rect.width));
      previewCoords.y = Math.max(0.2, Math.min(0.9, (event.clientY - rect.top) / rect.height));
      ghost.style.left = (previewCoords.x * 100) + "%";
      ghost.style.top = (previewCoords.y * 100) + "%";
    };
    catalogPreviewTank.onpointerdown = function (event) {
      catalogPreviewTank.setPointerCapture(event.pointerId);
      movePreview(event);
      catalogPreviewTank.onpointermove = movePreview;
    };
    catalogPreviewTank.onpointerup = function () {
      catalogPreviewTank.onpointermove = null;
    };
  }

  function closeCatalogItem() {
    catalogModal.hidden = true;
    activeCatalogItem = null;
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
      .then(function (res) {
        return res.json().then(function (result) {
          if (!res.ok) throw new Error(result.error || "Pembelian gagal.");
          return result;
        });
      })
      .then(function (result) {
        closeCatalogItem();
        setShopMessage("Terima kasih! " + item.item_name + " akan mencantikkan akuarium anda.");
        loadWallet();
        loadInventory();
        openPlacementModal({
          inventory_id: result.inventory_id,
          item_id: item.item_id,
          item_name: item.item_name,
          image_path: item.image_path,
          is_placed: false,
          position_x: null,
          position_y: null
        });
      })
      .catch(function (error) {
        alert(error.message || "Ralat semasa berhubung dengan kedai lautan. Sila cuba lagi!");
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
        '<div class="item-img-container shop-inventory-emoji" aria-hidden="true">' +
        itemEmoji(inv) +
        '</div>' +
        '<h3 class="item-title">' + escapeHTML(inv.item_name) + '</h3>' +
        '<p class="item-desc">' + escapeHTML(inv.description || "Hiasan indah akuarium.") + '</p>' +
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
    miniTankMarker.textContent = itemEmoji(inv);

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

  document.getElementById("btn-catalog-close").addEventListener("click", closeCatalogItem);
  catalogModal.addEventListener("click", function (event) {
    if (event.target === catalogModal) closeCatalogItem();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !catalogModal.hidden) closeCatalogItem();
  });
})();
