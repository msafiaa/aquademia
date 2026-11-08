/* ==========================================================================
   Aquademia 3D Explorer Character (Mal & Fania)
   Supports dual mascot selection (Mal / Fania), 3D procedural models,
   manual keyboard movement (WASD/Arrows/Space/Shift), flipper kicking,
   underwater vertical swim, and click-to-swim waypoint navigation.
   ========================================================================== */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["three"], factory);
  } else if (typeof exports === "object") {
    module.exports = factory(require("three"));
  } else {
    root.ExplorerCharacter = factory(root.THREE);
  }
})(typeof self !== "undefined" ? self : this, function (THREE) {
  "use strict";

  function ExplorerCharacter(scene, options) {
    options = options || {};
    this.scene = scene;
    this.currentMascot = options.mascot || "mal"; // 'mal' or 'fania'

    this.group = new THREE.Group();
    this.group.position.set(0, 1.4, 0); // Plaza center

    // Motion parameters
    this.velocity = new THREE.Vector3();
    this.moveSpeed = 9.5;       // forward/backward speed
    this.turnSpeed = 2.8;       // radians per second
    this.verticalSpeed = 6.0;   // up/down swim speed
    this.isMoving = false;
    this.isSwimmingAuto = false;
    this.targetPos = null;
    this.onArrivedCallback = null;

    // Boundary constraints (within central ocean bay)
    this.boundsRadius = 58;
    this.minY = 1.0;
    this.maxY = 16.0;

    // Visual sub-elements
    this.modelRoot = new THREE.Group();
    this.group.add(this.modelRoot);
    this.flippers = [];
    this.bubbleHelmet = null;

    this.rebuildMascot(this.currentMascot);
    this.scene.add(this.group);
  }

  /**
   * Switch between Mal and Fania
   */
  ExplorerCharacter.prototype.setMascot = function (mascotName) {
    if (mascotName !== "mal" && mascotName !== "fania") return;
    this.currentMascot = mascotName;
    this.rebuildMascot(mascotName);
  };

  ExplorerCharacter.prototype.rebuildMascot = function (type) {
    // Clear old model parts
    while (this.modelRoot.children.length > 0) {
      this.modelRoot.remove(this.modelRoot.children[0]);
    }
    this.flippers = [];

    var isFania = type === "fania";
    // Mal: Turquoise suit (#14a0bd) | Fania: Coral-pink suit (#ee5d78)
    var suitColor = isFania ? 0xee5d78 : 0x14a0bd;
    var accentColor = isFania ? 0xb9a4e6 : 0x7fe0ea; // Lavender vs Aqua
    var darkColor = 0x0b3a53;

    var suitMat = new THREE.MeshLambertMaterial({ color: suitColor, roughness: 0.5 });
    var accentMat = new THREE.MeshLambertMaterial({ color: accentColor, roughness: 0.4 });
    var darkMat = new THREE.MeshLambertMaterial({ color: darkColor, roughness: 0.6 });
    var skinMat = new THREE.MeshLambertMaterial({ color: 0xffd8b3, roughness: 0.7 });

    // 1. Torso
    var torsoGeo = new THREE.CylinderGeometry(0.36, 0.3, 0.9, 12);
    var torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.y = 0.9;
    this.modelRoot.add(torso);

    // Torso decorative belt/accent stripe
    var beltGeo = new THREE.CylinderGeometry(0.37, 0.36, 0.12, 12);
    var belt = new THREE.Mesh(beltGeo, accentMat);
    belt.position.y = 0.7;
    this.modelRoot.add(belt);

    // 2. Scuba Oxygen Tank on back
    var tankGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.72, 8);
    var tank = new THREE.Mesh(tankGeo, accentMat);
    tank.position.set(0, 0.95, -0.34);
    this.modelRoot.add(tank);

    // 3. Head & Hair / Hijab
    var headGeo = new THREE.SphereGeometry(0.26, 12, 12);
    var head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.62;
    this.modelRoot.add(head);

    if (isFania) {
      // Fania's Lavender Hijab covering head and neck
      var hijabGeo = new THREE.SphereGeometry(0.31, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.75);
      var hijabMat = new THREE.MeshLambertMaterial({ color: 0xb9a4e6 }); // Lavender
      var hijab = new THREE.Mesh(hijabGeo, hijabMat);
      hijab.position.y = 1.63;
      this.modelRoot.add(hijab);

      var neckCowl = new THREE.CylinderGeometry(0.3, 0.36, 0.25, 12);
      var cowl = new THREE.Mesh(neckCowl, hijabMat);
      cowl.position.y = 1.35;
      this.modelRoot.add(cowl);
    } else {
      // Mal's dark brown explorer hair
      var hairGeo = new THREE.SphereGeometry(0.28, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
      var hairMat = new THREE.MeshLambertMaterial({ color: 0x4a2e18 });
      var hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.set(0, 1.66, -0.02);
      this.modelRoot.add(hair);
    }

    // Friendly eyes
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b3a53 });
    var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    eyeL.position.set(0.09, 1.65, 0.23);
    var eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    eyeR.position.set(-0.09, 1.65, 0.23);
    this.modelRoot.add(eyeL);
    this.modelRoot.add(eyeR);

    // 4. Transparent Bubble Helmet
    var helmetGeo = new THREE.SphereGeometry(0.44, 20, 20);
    var helmetMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6fbff,
      transparent: true,
      opacity: 0.42,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8,
      ior: 1.15
    });
    this.bubbleHelmet = new THREE.Mesh(helmetGeo, helmetMat);
    this.bubbleHelmet.position.y = 1.62;
    this.modelRoot.add(this.bubbleHelmet);

    // 5. Arms
    var armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.6, 8);
    var armL = new THREE.Mesh(armGeo, suitMat);
    armL.position.set(0.46, 0.9, 0.08);
    armL.rotation.z = -Math.PI / 6;
    armL.rotation.x = Math.PI / 8;
    var armR = new THREE.Mesh(armGeo, suitMat);
    armR.position.set(-0.46, 0.9, 0.08);
    armR.rotation.z = Math.PI / 6;
    armR.rotation.x = Math.PI / 8;
    this.modelRoot.add(armL);
    this.modelRoot.add(armR);

    // 6. Legs & Flippers
    var legGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.65, 8);
    var legL = new THREE.Mesh(legGeo, suitMat);
    legL.position.set(0.18, 0.35, -0.05);
    var legR = new THREE.Mesh(legGeo, suitMat);
    legR.position.set(-0.18, 0.35, -0.05);
    this.modelRoot.add(legL);
    this.modelRoot.add(legR);

    var finGeo = new THREE.BoxGeometry(0.22, 0.04, 0.48);
    var finL = new THREE.Mesh(finGeo, darkMat);
    finL.position.set(0.18, 0.04, 0.12);
    var finR = new THREE.Mesh(finGeo, darkMat);
    finR.position.set(-0.18, 0.04, 0.12);
    this.modelRoot.add(finL);
    this.modelRoot.add(finR);

    this.flippers = [finL, finR];
  };

  /**
   * Manual keyboard input handler (WASD / Arrows / Space / Shift)
   */
  ExplorerCharacter.prototype.handleManualInput = function (keys, cameraYaw, delta, obstacleColliders) {
    var forward = 0;
    var turn = 0;
    var vertical = 0;

    // Cancel auto-swim if manual keys are pressed
    if (keys.KeyW || keys.ArrowUp) forward += 1;
    if (keys.KeyS || keys.ArrowDown) forward -= 1;
    if (keys.KeyA || keys.ArrowLeft) turn += 1;
    if (keys.KeyD || keys.ArrowRight) turn -= 1;
    if (keys.Space) vertical += 1;
    if (keys.ShiftLeft || keys.ShiftRight || keys.KeyC) vertical -= 1;

    if (forward !== 0 || turn !== 0 || vertical !== 0) {
      if (this.isSwimmingAuto) {
        this.cancelAutoSwim();
      }
      this.isMoving = true;
    } else {
      this.isMoving = false;
    }

    if (!this.isMoving) return;

    // Rotate character
    if (turn !== 0) {
      this.group.rotation.y += turn * this.turnSpeed * delta;
    }

    // Move forward/backward along character facing direction
    if (forward !== 0) {
      var moveStep = forward * this.moveSpeed * delta;
      var moveX = Math.sin(this.group.rotation.y) * moveStep;
      var moveZ = Math.cos(this.group.rotation.y) * moveStep;

      var nextX = this.group.position.x + moveX;
      var nextZ = this.group.position.z + moveZ;

      // Check collision against obstacle colliders (buildings)
      var collision = this.checkCollision(nextX, nextZ, obstacleColliders);
      if (!collision) {
        this.group.position.x = nextX;
        this.group.position.z = nextZ;
      }
    }

    // Vertical swim up/down
    if (vertical !== 0) {
      var nextY = this.group.position.y + vertical * this.verticalSpeed * delta;
      this.group.position.y = Math.max(this.minY, Math.min(this.maxY, nextY));
    }

    // Keep character within ocean circular bounds
    var distFromPlaza = Math.hypot(this.group.position.x, this.group.position.z);
    if (distFromPlaza > this.boundsRadius) {
      var angle = Math.atan2(this.group.position.z, this.group.position.x);
      this.group.position.x = Math.cos(angle) * this.boundsRadius;
      this.group.position.z = Math.sin(angle) * this.boundsRadius;
    }
  };

  /**
   * Basic collision detection against city buildings
   */
  ExplorerCharacter.prototype.checkCollision = function (x, z, colliders) {
    if (!colliders || colliders.length === 0) return false;
    for (var i = 0; i < colliders.length; i++) {
      var col = colliders[i];
      var dist = Math.hypot(x - col.x, z - col.z);
      if (dist < (col.radius || 4.2)) {
        return true; // Collided!
      }
    }
    return false;
  };

  /**
   * Automatic swimming to destination waypoint
   */
  ExplorerCharacter.prototype.swimTo = function (targetPos, onArrived) {
    this.targetPos = new THREE.Vector3(targetPos.x, targetPos.y || 1.4, targetPos.z);
    this.isSwimmingAuto = true;
    this.onArrivedCallback = onArrived;
  };

  ExplorerCharacter.prototype.cancelAutoSwim = function () {
    this.isSwimmingAuto = false;
    this.targetPos = null;
    this.onArrivedCallback = null;
  };

  /**
   * Main per-frame animation and position update loop
   */
  ExplorerCharacter.prototype.update = function (delta, elapsed) {
    if (this.isSwimmingAuto && this.targetPos) {
      // Auto-swim interpolation
      var currentPos = this.group.position;
      var dir = new THREE.Vector3().subVectors(this.targetPos, currentPos);
      dir.y = 0; // level swim
      var dist = dir.length();

      if (dist < 0.9) {
        this.isSwimmingAuto = false;
        var cb = this.onArrivedCallback;
        this.onArrivedCallback = null;
        if (cb) cb();
      } else {
        dir.normalize();

        // Smooth turning
        var targetAngle = Math.atan2(dir.x, dir.z);
        var curAngle = this.group.rotation.y;
        var diff = Math.atan2(Math.sin(targetAngle - curAngle), Math.cos(targetAngle - curAngle));
        this.group.rotation.y += diff * Math.min(1, delta * 7);

        // Move forward
        var step = Math.min(dist, this.moveSpeed * delta);
        this.group.position.x += dir.x * step;
        this.group.position.z += dir.z * step;

        this.isMoving = true;
      }
    }

    // Visual animation states
    if (this.isMoving || this.isSwimmingAuto) {
      // Swim forward tilt
      this.modelRoot.rotation.x = THREE.MathUtils.lerp(this.modelRoot.rotation.x, 0.4, delta * 7);

      // Flipper kicks
      var kick = Math.sin(elapsed * 14) * 0.55;
      if (this.flippers[0]) this.flippers[0].rotation.x = kick;
      if (this.flippers[1]) this.flippers[1].rotation.x = -kick;
    } else {
      // Idle float
      this.modelRoot.rotation.x = THREE.MathUtils.lerp(this.modelRoot.rotation.x, 0, delta * 4);
      if (this.flippers[0]) this.flippers[0].rotation.x = 0;
      if (this.flippers[1]) this.flippers[1].rotation.x = 0;
    }

    // Natural underwater floating wave
    var bob = Math.sin(elapsed * 2.4) * 0.08;
    this.modelRoot.position.y = bob;
  };

  return ExplorerCharacter;
});
