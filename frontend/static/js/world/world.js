/* ==========================================================================
   Aquademia Complete Immersive 3D Underwater World Controller
   Features:
   - Full 360-degree mouse drag orbit camera & mouse wheel zoom
   - Manual keyboard movement (WASD / Arrows / Space / Shift)
   - Dual mascot selection (Mal & Fania) with session persistence
   - Opening 4-6s ocean dive cinematic with Skip Intro
   - Click-to-swim raycasting & cancelable auto-swim
   - Real-time student HUD (pearls, profile, 2D switch, camera reset)
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

  // Camera Orbit State (Full 360 horizontal rotation)
  var cameraYaw = 0.0;            // horizontal azimuth angle (0..2*PI)
  var cameraPitch = 0.28;         // vertical polar angle (-0.35 .. 1.15)
  var cameraDistance = 8.5;       // distance from character
  var minDistance = 4.0;
  var maxDistance = 18.0;
  var isDraggingMouse = false;
  var previousMousePos = { x: 0, y: 0 };
  var hasMovedSinceDown = false;

  // Keyboard input state
  var keys = {};

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

    var savedMascot = sessionStorage.getItem("aquademia_mascot") || "mal";
    character = new window.ExplorerCharacter(scene, {
      mascot: savedMascot
    });
    updateMascotButtonUI(savedMascot);

    // Setup Event Listeners
    setupInputListeners();
    setupHUDControls();
    loadStudentInfo();

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
     2. Input Listeners (Keyboard, Mouse Drag Orbit, Wheel Zoom)
     ------------------------------------------------------------------ */
  function setupInputListeners() {
    window.addEventListener("resize", onWindowResize);

    // Keyboard controls
    window.addEventListener("keydown", function (e) {
      // Don't capture keys if typing inside input boxes
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      keys[e.code] = true;
    });

    window.addEventListener("keyup", function (e) {
      keys[e.code] = false;
    });

    // Mouse Drag Camera Orbit
    container.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return; // left click only
      isDraggingMouse = true;
      hasMovedSinceDown = false;
      previousMousePos.x = e.clientX;
      previousMousePos.y = e.clientY;
    });

    window.addEventListener("pointermove", function (e) {
      // Update normalized mouse for raycasting
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      if (isDraggingMouse) {
        var dx = e.clientX - previousMousePos.x;
        var dy = e.clientY - previousMousePos.y;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          hasMovedSinceDown = true;
        }

        // 360-degree horizontal orbit sensitivity
        cameraYaw -= dx * 0.0065;
        // Keep yaw within [0, 2*PI]
        cameraYaw = (cameraYaw % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

        // Bounded vertical pitch
        cameraPitch += dy * 0.005;
        cameraPitch = Math.max(-0.35, Math.min(1.15, cameraPitch));

        previousMousePos.x = e.clientX;
        previousMousePos.y = e.clientY;
      } else {
        checkRaycastHover();
      }
    });

    window.addEventListener("pointerup", function (e) {
      if (isDraggingMouse && !hasMovedSinceDown) {
        // Pure click without dragging: trigger building interaction
        handleBuildingClick();
      }
      isDraggingMouse = false;
    });

    // Mouse Wheel Zoom
    container.addEventListener("wheel", function (e) {
      e.preventDefault();
      cameraDistance += e.deltaY * 0.008;
      cameraDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance));
    }, { passive: false });
  }

  /* ------------------------------------------------------------------
     3. Raycasting & Building Interactions
     ------------------------------------------------------------------ */
  function checkRaycastHover() {
    if (isCinematicActive || character.isSwimmingAuto) return;

    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObjects(city.destinations, true);

    if (intersects.length > 0) {
      var target = intersects[0].object;
      while (target.parent && target.parent !== city.cityGroup) {
        target = target.parent;
      }

      if (target.destinationData) {
        hoveredDestination = target;
        document.body.style.cursor = "pointer";
        bannerText.textContent = "📍 " + target.destinationData.name + " (" + target.destinationData.desc + ") — Klik untuk berenang!";
        bannerWrap.classList.add("hovered");
        return;
      }
    }

    hoveredDestination = null;
    document.body.style.cursor = "default";
    bannerWrap.classList.remove("hovered");
    bannerText.textContent = "Teroka bebas guna papan kekunci (WASD / Anak Panah) atau klik bangunan!";
  }

  function handleBuildingClick() {
    if (isCinematicActive || character.isSwimmingAuto || !hoveredDestination) return;
    swimToDestination(hoveredDestination);
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
        cameraYaw = 0.0;
        cameraPitch = 0.28;
        cameraDistance = 8.5;
      });
    }

    // Cancel Auto-swim button
    if (btnCancelAutoSwim) {
      btnCancelAutoSwim.addEventListener("click", function () {
        character.cancelAutoSwim();
        btnCancelAutoSwim.hidden = true;
        bannerWrap.classList.remove("swimming");
        bannerText.textContent = "Berenang automatik dibatalkan. Anda bebas bergerak!";
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

  function loadStudentInfo() {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.student) {
          document.getElementById("user-display").textContent = "Hai, " + data.student.username + "!";
        }
      });

    fetch("/api/shop/wallet", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (d) {
        if (d && typeof d.pearls !== "undefined") {
          document.getElementById("user-pearls").textContent = d.pearls;
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
    // Snap camera to normal player view
    cameraDistance = 8.5;
    cameraPitch = 0.28;
    cameraYaw = 0.0;
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

    var delta = clock.getDelta();
    var elapsed = clock.getElapsedTime();

    // 1. Handle Manual Keyboard Movement
    if (!isCinematicActive) {
      character.handleManualInput(keys, cameraYaw, delta, city.colliders);
      // If manual movement was triggered, cancel auto-swim UI
      if (character.isMoving && btnCancelAutoSwim && !btnCancelAutoSwim.hidden) {
        btnCancelAutoSwim.hidden = true;
        bannerWrap.classList.remove("swimming");
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
      // 3rd Person Orbit/Follow Camera
      // Calculate spherical offset from character position
      var cosPitch = Math.cos(cameraPitch);
      var sinPitch = Math.sin(cameraPitch);
      var sinYaw = Math.sin(cameraYaw);
      var cosYaw = Math.cos(cameraYaw);

      var offsetX = cameraDistance * cosPitch * sinYaw;
      var offsetY = cameraDistance * sinPitch;
      var offsetZ = cameraDistance * cosPitch * cosYaw;

      var targetCamX = charPos.x + offsetX;
      var targetCamY = charPos.y + 1.2 + offsetY;
      var targetCamZ = charPos.z + offsetZ;

      // Prevent camera from dipping below the sandy seabed
      targetCamY = Math.max(0.6, targetCamY);

      // Smooth interpolation for stability
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, delta * 7);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, delta * 7);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, delta * 7);

      // Camera aims at character's chest/head
      camera.lookAt(charPos.x, charPos.y + 1.2, charPos.z);
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
