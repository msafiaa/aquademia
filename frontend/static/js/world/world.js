/* ==========================================================================
   Aquademia Complete Immersive 3D Underwater World Controller
   Features:
   - Full 360-degree mouse drag orbit camera & mouse wheel zoom
   - Manual keyboard movement (WASD / Arrows / Space / Shift)
   - Dual mascot selection (Mal & Fania) with session persistence
   - Opening 4-6s ocean dive cinematic with Skip Intro
   - Click-to-swim raycasting & cancelable auto-swim
   - Real-time student HUD (pearls, profile, 2D switch, camera reset)
   Stage 1: camera-relative movement, smooth follow camera, touch controls
   (camera rig / keyboard / touch helpers live in controls.js).
   ========================================================================== */
(function () {
  "use strict";

  // DOM Elements
  var container = document.getElementById("world-canvas-container");
  var loadingScreen = document.getElementById("world-loading");
  var bannerText = document.getElementById("hud-banner-text");
  var bannerWrap = document.getElementById("destination-guide-banner");
  var btnCancelAutoSwim = document.getElementById("btn-cancel-swim");
  var arrivalOverlay = document.getElementById("arrival-flash-overlay");
  var arrivalText = document.getElementById("arrival-flash-text");
  var cinematicOverlay = document.getElementById("cinematic-overlay");
  var btnSkipIntro = document.getElementById("btn-skip-intro");

  // Character selection buttons
  var btnSelectMal = document.getElementById("btn-select-mal");
  var btnSelectFania = document.getElementById("btn-select-fania");
  var btnResetCam = document.getElementById("btn-reset-cam");

  // Three.js core
  var scene, camera, renderer;
  var city, character;
  var clock = new THREE.Clock();
  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2(-999, -999);
  var hoveredDestination = null;

  // Smooth third-person camera rig (full 360-degree yaw) and input state - see controls.js
  var WC = window.WorldControls;
  var rig = new WC.CameraRig();
  var input = new WC.InputState();
  var touchControls = null;
  var idleBannerText = "Teroka bebas guna papan kekunci (WASD / Anak Panah) atau klik bangunan!";

  // Pointer gesture state: mouse drag / one-finger orbit / two-finger pinch / tap
  var activePointers = new Map();
  var gesture = { startX: 0, startY: 0, startTime: 0, moved: false, multi: false, pinchDist: 0 };

  // Cinematic Intro state
  var isCinematicActive = false;
  var cinematicProgress = 0.0;
  var cinematicDuration = 4.8; // seconds

  /* ------------------------------------------------------------------
     1. Initialization
     ------------------------------------------------------------------ */
  function init() {
    // Scene with turquoise ocean fog matching Gemini references
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a587a);
    scene.fog = new THREE.FogExp2(0x0a587a, 0.016);

    // Perspective Camera
    camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.1,
      250
    );

    // WebGL Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5); // capped for performance
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Atmospheric Underwater Lighting
    var hemiLight = new THREE.HemisphereLight(0x7fe0ea, 0x052e42, 0.9);
    scene.add(hemiLight);

    var sunLight = new THREE.DirectionalLight(0xfff6dc, 1.1);
    sunLight.position.set(25, 45, 18);
    scene.add(sunLight);

    // Build World City & Explorer Character
    city = new window.UnderwaterCity(scene);
    city.camera = camera; // image buildings turn to face the camera

    var savedMascot = sessionStorage.getItem("aquademia_mascot") || "mal";
    character = new window.ExplorerCharacter(scene, {
      mascot: savedMascot
    });
    updateMascotButtonUI(savedMascot);

    // Camera starts directly behind the character
    rig.resetBehind(character.group.rotation.y, true);
    rig.snapFocus(character.group.position);

    // Setup Event Listeners
    setupInputListeners();
    setupTouchControls();
    setupHUDControls();
    loadStudentInfo();
    setupLogout();
    setupHelp();
    setupSettings();

    // Check Opening Cinematic
    checkCinematicIntro();

    // Hide initial loader
    setTimeout(function () {
      if (loadingScreen) loadingScreen.classList.add("done");
    }, 500);

    // Start Animation Loop
    animate();
  }

  /* ------------------------------------------------------------------
     2. Input Listeners (Keyboard, Mouse/Touch Orbit, Wheel & Pinch Zoom, Tap)
     ------------------------------------------------------------------ */
  function setupInputListeners() {
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onWindowResize);

    // Keyboard (stuck-key and focus safe) - see InputState in controls.js
    input.attach(window, document);

    // After a real pointer click, drop focus from HUD buttons so Space/Enter can't re-trigger them
    document.addEventListener("click", function (e) {
      if (e.detail === 0) return; // keyboard-activated click: keep focus for accessibility
      var btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (btn) btn.blur();
    }, true);

    // Pointer gestures on the 3D canvas
    container.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return; // left click only
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { container.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }

      if (activePointers.size === 1) {
        gesture.startX = e.clientX;
        gesture.startY = e.clientY;
        gesture.startTime = performance.now();
        gesture.moved = false;
        gesture.multi = false;
      } else {
        gesture.multi = true;
        gesture.pinchDist = pointerSpread();
      }
    });

    container.addEventListener("pointermove", function (e) {
      var p = activePointers.get(e.pointerId);
      if (!p) {
        if (e.pointerType === "mouse") updateHoverFromPointer(e);
        return;
      }

      var dx = e.clientX - p.x;
      var dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;

      if (activePointers.size === 1 && !gesture.multi) {
        var threshold = e.pointerType === "mouse" ? 4 : 8;
        if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > threshold) {
          gesture.moved = true;
        }
        // 360-degree horizontal orbit + bounded vertical pitch
        rig.rotate(dx, dy);
      } else if (activePointers.size >= 2) {
        // Pinch: fingers apart = zoom in
        var spread = pointerSpread();
        rig.zoom(-(spread - gesture.pinchDist) * 0.03);
        gesture.pinchDist = spread;
        gesture.moved = true;
      }
    });

    function endPointer(e, allowTap) {
      if (!activePointers.delete(e.pointerId)) return;
      if (activePointers.size === 0) {
        var isTap = allowTap && !gesture.moved && !gesture.multi &&
          (performance.now() - gesture.startTime) < 700;
        gesture.multi = false;
        if (isTap) handleTap(e);
      } else {
        gesture.moved = true; // pinch ended with one finger left: never count that as a tap
      }
    }
    container.addEventListener("pointerup", function (e) { endPointer(e, true); });
    container.addEventListener("pointercancel", function (e) { endPointer(e, false); });
    container.addEventListener("lostpointercapture", function (e) { activePointers.delete(e.pointerId); });

    container.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse" && activePointers.size === 0) clearHover();
    });

    // Mouse Wheel Zoom
    container.addEventListener("wheel", function (e) {
      e.preventDefault();
      var unit = e.deltaMode === 1 ? 16 : 1;
      rig.zoom(e.deltaY * unit * 0.008);
    }, { passive: false });
  }

  function pointerSpread() {
    var pts = Array.from(activePointers.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function setupTouchControls() {
    if (!WC.TouchControls.shouldEnable(window)) return;
    document.body.classList.add("touch-ui");
    touchControls = new WC.TouchControls({
      container: document.querySelector(".world-hud-overlay"),
      analog: input.analog
    });
    touchControls.mount();

    // Short hint instead of the keyboard instructions
    idleBannerText = "Ketik bangunan untuk berenang!";
    bannerText.textContent = idleBannerText;

    // Keep the joystick and up/down buttons just above the bottom bar, however its chips wrap
    var overlay = document.querySelector(".world-hud-overlay");
    var bar = document.querySelector(".hud-bottom-bar");
    function positionTouchControls() {
      var pad = parseFloat(window.getComputedStyle(overlay).paddingBottom) || 0;
      document.body.style.setProperty("--touch-ui-bottom", Math.round(pad + bar.offsetHeight + 12) + "px");
    }
    positionTouchControls();
    window.addEventListener("resize", positionTouchControls);
    window.addEventListener("orientationchange", positionTouchControls);
    if (window.ResizeObserver) new ResizeObserver(positionTouchControls).observe(bar);
  }

  /* ------------------------------------------------------------------
     3. Raycasting & Building Interactions
     ------------------------------------------------------------------ */
  function setMouseFromEvent(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  function pickDestination() {
    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObjects(city.destinations, true);
    if (intersects.length > 0) {
      var target = intersects[0].object;
      while (target.parent && target.parent !== city.cityGroup) {
        target = target.parent;
      }
      if (target.destinationData) return target;
    }
    return null;
  }

  function updateHoverFromPointer(e) {
    setMouseFromEvent(e);
    checkRaycastHover();
  }

  function clearHover() {
    if (character && character.isSwimmingAuto) return;
    hoveredDestination = null;
    document.body.style.cursor = "default";
    bannerWrap.classList.remove("hovered");
    bannerText.textContent = idleBannerText;
  }

  function checkRaycastHover() {
    if (isCinematicActive || character.isSwimmingAuto) return;

    var target = pickDestination();
    if (target) {
      hoveredDestination = target;
      document.body.style.cursor = "pointer";
      bannerText.textContent = "📍 " + target.destinationData.name + " (" + target.destinationData.desc + ") — Klik untuk berenang!";
      bannerWrap.classList.add("hovered");
      return;
    }

    clearHover();
  }

  // A tap or click (no drag) picks the building under the pointer, mouse or touch
  function handleTap(e) {
    if (isCinematicActive || character.isSwimmingAuto) return;
    setMouseFromEvent(e);
    var target = pickDestination();
    if (target) {
      hoveredDestination = target;
      swimToDestination(target);
    }
  }

  function swimToDestination(destinationObj) {
    if (!destinationObj || !destinationObj.destinationData) return;

    var dest = destinationObj.destinationData;
    bannerText.textContent = "🏊 Sedang berenang ke " + dest.name + "...";
    bannerWrap.classList.add("swimming");
    if (btnCancelAutoSwim) btnCancelAutoSwim.hidden = false;

    // Command character to swim to waypoint
    character.swimTo(dest.waypoint, function () {
      // Arrived at doorway!
      if (btnCancelAutoSwim) btnCancelAutoSwim.hidden = true;
      bannerWrap.classList.remove("swimming");

      arrivalText.textContent = "Tiba di " + dest.name + "!";
      arrivalOverlay.classList.add("active");

      setTimeout(function () {
        window.location.assign(dest.route);
      }, 750);
    });
  }

  /* ------------------------------------------------------------------
     4. HUD & Mascot Controls
     ------------------------------------------------------------------ */
  function setupHUDControls() {
    // Mascot Switcher
    if (btnSelectMal) {
      btnSelectMal.addEventListener("click", function () {
        character.setMascot("mal");
        sessionStorage.setItem("aquademia_mascot", "mal");
        updateMascotButtonUI("mal");
      });
    }

    if (btnSelectFania) {
      btnSelectFania.addEventListener("click", function () {
        character.setMascot("fania");
        sessionStorage.setItem("aquademia_mascot", "fania");
        updateMascotButtonUI("fania");
      });
    }

    // Reset Camera Button
    if (btnResetCam) {
      btnResetCam.addEventListener("click", function () {
        // Smoothly swing the camera back to sit directly behind the character
        rig.resetBehind(character.group.rotation.y);
      });
    }

    // Cancel Auto-swim button
    if (btnCancelAutoSwim) {
      btnCancelAutoSwim.addEventListener("click", function () {
        character.cancelAutoSwim();
        btnCancelAutoSwim.hidden = true;
        bannerWrap.classList.remove("swimming");
        showNotice("Berenang automatik dibatalkan. Anda bebas bergerak!");
      });
    }

    // Quick Navigation chips
    Array.prototype.forEach.call(document.querySelectorAll(".hud-nav-chip"), function (chip) {
      chip.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = chip.getAttribute("data-id");
        var match = city.destinations.find(function (d) {
          return d.destinationData && d.destinationData.id === id;
        });
        if (match) swimToDestination(match);
      });
    });

    // Skip Intro button
    if (btnSkipIntro) {
      btnSkipIntro.addEventListener("click", function () {
        skipCinematic();
      });
    }
  }

  function updateMascotButtonUI(type) {
    if (btnSelectMal) btnSelectMal.classList.toggle("active", type === "mal");
    if (btnSelectFania) btnSelectFania.classList.toggle("active", type === "fania");
  }

  function setupHelp() {
    var btn = document.getElementById("btn-help");
    var panel = document.getElementById("controls-panel");
    var closeBtn = document.getElementById("btn-help-close");
    if (!btn || !panel) return;

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) btn.classList.remove("pulse");
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(panel.hidden);
    });
    if (closeBtn) closeBtn.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
    // Touching/clicking the 3D world closes the panel
    container.addEventListener("pointerdown", function () { setOpen(false); });
  }

  // Short message in the banner that fades away by itself
  var noticeTimer = null;
  function showNotice(text) {
    bannerText.textContent = text;
    bannerWrap.classList.add("notice");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { bannerWrap.classList.remove("notice"); }, 2500);
  }

  /* ------------------------------------------------------------------
     Settings dialog: change username / year, change password, log out
     ------------------------------------------------------------------ */
  var ERROR_MS = {
    "Username already exists.": "Nama pengguna itu sudah digunakan. Cuba yang lain.",
    "Current password is incorrect.": "Kata laluan semasa tidak betul.",
    "Passwords do not match.": "Dua kata laluan baharu tidak sama.",
    "Password must be between 12 and 128 characters.": "Kata laluan baharu mesti 12 hingga 128 aksara.",
    "Username must be 3-30 characters and contain only letters, numbers or underscores.":
      "Nama pengguna mesti 3-30 aksara (huruf, nombor atau garis bawah sahaja).",
    "Year level must be 4, 5 or 6.": "Tahun mesti 4, 5 atau 6."
  };

  function postJSON(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function setMsg(el, text, kind) {
    el.textContent = text || "";
    el.className = "settings-msg" + (kind ? " " + kind : "");
  }

  function setupSettings() {
    var modal = document.getElementById("settings-modal");
    var btnOpen = document.getElementById("btn-settings");
    if (!modal || !btnOpen) return;

    var btnClose = document.getElementById("btn-settings-close");
    var backdrop = document.getElementById("settings-backdrop");
    var formProfile = document.getElementById("form-profile");
    var formPassword = document.getElementById("form-password");
    var fUser = document.getElementById("set-username");
    var msgProfile = document.getElementById("msg-profile");
    var msgPassword = document.getElementById("msg-password");
    var pwCurrent = document.getElementById("set-pw-current");
    var pwNew = document.getElementById("set-pw-new");
    var pwConfirm = document.getElementById("set-pw-confirm");

    function selectedYear() {
      var r = formProfile.querySelector('input[name="set-year"]:checked');
      return r ? parseInt(r.value, 10) : null;
    }

    function openModal() {
      var st = currentStudent || {};
      fUser.value = st.username || "";
      Array.prototype.forEach.call(formProfile.querySelectorAll('input[name="set-year"]'), function (r) {
        r.checked = parseInt(r.value, 10) === st.year_level;
      });
      pwCurrent.value = pwNew.value = pwConfirm.value = "";
      setMsg(msgProfile, "");
      setMsg(msgPassword, "");
      fUser.removeAttribute("aria-invalid");
      modal.hidden = false;
      if (input && typeof input.clear === "function") input.clear(); // no stuck movement keys
      setTimeout(function () { fUser.focus(); }, 30);
    }

    function closeModal() {
      modal.hidden = true;
      btnOpen.focus();
    }

    btnOpen.addEventListener("click", openModal);
    btnClose.addEventListener("click", closeModal);
    backdrop.addEventListener("click", closeModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    function handleResult(res, msgEl, onOk) {
      if (res.status === 401) { window.location.assign("/login"); return; }
      if (res.ok) { onOk(res.data); return; }
      var raw = (res.data && res.data.error) || "";
      setMsg(msgEl, ERROR_MS[raw] || raw || "Sesuatu tidak kena. Cuba lagi.", "err");
    }

    formProfile.addEventListener("submit", function (e) {
      e.preventDefault();
      var username = fUser.value.trim();
      var year = selectedYear();
      var st = currentStudent || {};

      if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
        fUser.setAttribute("aria-invalid", "true");
        setMsg(msgProfile, ERROR_MS["Username must be 3-30 characters and contain only letters, numbers or underscores."], "err");
        return;
      }
      fUser.removeAttribute("aria-invalid");
      if (year === null) { setMsg(msgProfile, "Sila pilih tahun anda.", "err"); return; }
      if (username === st.username && year === st.year_level) {
        setMsg(msgProfile, "Tiada perubahan untuk disimpan.", "");
        return;
      }

      var body = {};
      if (username !== st.username) body.username = username;
      if (year !== st.year_level) body.year_level = year;

      setMsg(msgProfile, "Menyimpan...", "");
      postJSON("/api/auth/update-profile", body).then(function (res) {
        handleResult(res, msgProfile, function (data) {
          applyStudent(data.student);
          setMsg(msgProfile, "Profil berjaya dikemas kini! ✅", "ok");
        });
      }, function () { setMsg(msgProfile, "Tiada sambungan. Cuba lagi.", "err"); });
    });

    formPassword.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!pwCurrent.value) { setMsg(msgPassword, "Sila taip kata laluan semasa.", "err"); return; }
      if (pwNew.value.length < 12 || pwNew.value.length > 128) {
        setMsg(msgPassword, ERROR_MS["Password must be between 12 and 128 characters."], "err");
        return;
      }
      if (pwNew.value !== pwConfirm.value) {
        setMsg(msgPassword, ERROR_MS["Passwords do not match."], "err");
        return;
      }

      setMsg(msgPassword, "Menyimpan...", "");
      postJSON("/api/auth/change-password", {
        current_password: pwCurrent.value,
        new_password: pwNew.value,
        confirm_password: pwConfirm.value
      }).then(function (res) {
        handleResult(res, msgPassword, function () {
          pwCurrent.value = pwNew.value = pwConfirm.value = "";
          setMsg(msgPassword, "Kata laluan berjaya ditukar! ✅", "ok");
        });
      }, function () { setMsg(msgPassword, "Tiada sambungan. Cuba lagi.", "err"); });
    });
  }

  function setupLogout() {
    var btn = document.getElementById("btn-logout");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var done = function () {
        try { sessionStorage.removeItem("aquademia_intro_seen"); } catch (e) { /* ignore */ }
        window.location.assign("/login");
      };
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin"
      }).then(done, done);
    });
  }

  var currentStudent = null;

  // Show the student's name / year / avatar initial in the top bar
  function applyStudent(st) {
    currentStudent = st;
    var nameEl = document.getElementById("user-display");
    var yearEl = document.getElementById("user-year");
    var avatarEl = document.getElementById("user-avatar");
    if (nameEl) nameEl.textContent = "Hai, " + st.username + "!";
    if (yearEl) yearEl.textContent = st.year_level ? "Tahun " + st.year_level : "";
    if (avatarEl) avatarEl.textContent = String(st.username || "?").charAt(0);
  }

  function loadStudentInfo() {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.student) applyStudent(data.student);
      });

    fetch("/api/shop/wallet", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (d) {
        if (d && typeof d.available_pearls !== "undefined") {
          document.getElementById("user-pearls").textContent = d.available_pearls;
        }
      });
  }

  /* ------------------------------------------------------------------
     5. Opening Ocean Dive Cinematic
     ------------------------------------------------------------------ */
  function checkCinematicIntro() {
    var hasSeen = sessionStorage.getItem("aquademia_intro_seen");
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (hasSeen || reduceMotion) {
      if (cinematicOverlay) cinematicOverlay.remove();
      return;
    }

    // Start Cinematic Sequence
    isCinematicActive = true;
    cinematicProgress = 0.0;
    if (cinematicOverlay) cinematicOverlay.classList.add("active");
  }

  function skipCinematic() {
    isCinematicActive = false;
    sessionStorage.setItem("aquademia_intro_seen", "true");
    if (cinematicOverlay) {
      cinematicOverlay.classList.remove("active");
      setTimeout(function () { cinematicOverlay.remove(); }, 500);
    }
    // Hand over to the normal follow camera, directly behind the character
    rig.resetBehind(character.group.rotation.y, true);
    rig.snapFocus(character.group.position);
    rig.startBlend(camera, 0.6);
  }

  /* ------------------------------------------------------------------
     6. Camera Update & Animation Loop
     ------------------------------------------------------------------ */
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);

    var delta = Math.min(clock.getDelta(), 0.1); // avoid big jumps after a hidden tab
    var elapsed = clock.getElapsedTime();

    // 1. Handle Manual Keyboard Movement
    if (!isCinematicActive) {
      character.handleManualInput(input.keys, rig.yaw, delta, city.colliders, input.analog);
      // If manual movement was triggered, cancel auto-swim UI
      if (character.isMoving && btnCancelAutoSwim && !btnCancelAutoSwim.hidden) {
        btnCancelAutoSwim.hidden = true;
        bannerWrap.classList.remove("swimming");
        showNotice("Berenang automatik dibatalkan. Anda bebas bergerak!");
      }
    }

    // 2. Update character & environment animations
    character.update(delta, elapsed);
    city.update(delta, elapsed);

    // 3. Update Camera Position & Orbit
    var charPos = character.group.position;

    if (isCinematicActive) {
      cinematicProgress += delta / cinematicDuration;

      if (cinematicProgress >= 1.0) {
        skipCinematic();
      } else {
        // Smooth dive: starts high above surface and swoops down into plaza
        var t = cinematicProgress;
        var diveY = THREE.MathUtils.lerp(38, charPos.y + 4.2, t * t);
        var diveZ = THREE.MathUtils.lerp(34, charPos.z + 8.5, t);
        var diveX = Math.sin(t * Math.PI) * 12;

        camera.position.set(diveX, diveY, diveZ);
        camera.lookAt(charPos.x, charPos.y + 1.2, charPos.z);
      }
    } else {
      // 3rd Person Orbit/Follow Camera (smooth follow, building-aware, behind the character)
      rig.update(camera, charPos, delta, city.colliders);
    }

    renderer.render(scene, camera);
  }

  // Initialize when ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();