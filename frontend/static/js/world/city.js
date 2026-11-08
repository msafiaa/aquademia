/* ==========================================================================
   Aquademia 3D Underwater City & Architectural Reference Environment
   Faithfully recreates the Gemini-generated ocean references:
   - Turquoise water, volumetric sunlight rays, floating bubbles, animated fish
   - 5 custom-designed 3D architectural destinations (Quiz Academy, Ask Aqua Lab,
     My Aquarium, Decoration Shop, Learning Cove)
   - Swaying seaweed, vibrant coral reefs (pink/purple/blue/orange), rocks
   ========================================================================== */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["three"], factory);
  } else if (typeof exports === "object") {
    module.exports = factory(require("three"));
  } else {
    root.UnderwaterCity = factory(root.THREE);
  }
})(typeof self !== "undefined" ? self : this, function (THREE) {
  "use strict";

  function UnderwaterCity(scene) {
    this.scene = scene;
    this.cityGroup = new THREE.Group();
    this.destinations = [];
    this.colliders = []; // [{x, z, radius, height}] cylinders; the player swims over them above `height`
    this.swayingSeaweeds = [];
    this.roamingFish = [];
    this.bubbleParticles = null;
    this.sunbeams = [];
    this.billboards = []; // image buildings that turn to face the camera
    this.signs = [];      // ground signboards that slide to the camera side of their building
    this.camera = null;   // set by world.js

    this.buildSeabedAndPlaza();
    this.buildSunbeams();
    this.buildBubbleParticles();
    this.buildRoamingFishSchool();
    this.buildCoralAndRockReefs();
    this.buildAllReferenceBuildings();

    this.scene.add(this.cityGroup);
  }

  /* ------------------------------------------------------------------
     1. Seabed Terrain & Central Plaza
     ------------------------------------------------------------------ */
  UnderwaterCity.prototype.buildSeabedAndPlaza = function () {
    // Vast sandy seabed floor
    var sandGeo = new THREE.CircleGeometry(78, 48);
    var sandMat = new THREE.MeshLambertMaterial({
      color: 0xdec68e, // warm sunlit ocean sand
      roughness: 0.95
    });
    var sand = new THREE.Mesh(sandGeo, sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = 0;
    sand.receiveShadow = true;
    this.cityGroup.add(sand);

    // Central Plaza: circular marine blue stone plaza
    var plazaGeo = new THREE.CircleGeometry(9.5, 36);
    var plazaMat = new THREE.MeshLambertMaterial({
      color: 0x0e5d7d, // marine stone
      roughness: 0.7
    });
    var plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    this.cityGroup.add(plaza);

    // Decorative inner mosaic rings
    var ringGeo1 = new THREE.RingGeometry(5.2, 5.8, 36);
    var ringMat1 = new THREE.MeshBasicMaterial({ color: 0x7fe0ea, side: THREE.DoubleSide });
    var ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = 0.03;
    this.cityGroup.add(ring1);

    var ringGeo2 = new THREE.RingGeometry(8.8, 9.4, 36);
    var ringMat2 = new THREE.MeshBasicMaterial({ color: 0xffd86b, side: THREE.DoubleSide });
    var ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.03;
    this.cityGroup.add(ring2);
  };

  /* ------------------------------------------------------------------
     2. Volumetric Sunlight Beams from Surface
     ------------------------------------------------------------------ */
  UnderwaterCity.prototype.buildSunbeams = function () {
    var beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    var beamCoords = [
      [0, 24, 0, 8, 28],
      [15, 24, -10, 6, 26],
      [-14, 24, 12, 7, 26],
      [-16, 24, -14, 6, 26],
      [14, 24, 14, 6, 26]
    ];

    for (var i = 0; i < beamCoords.length; i++) {
      var c = beamCoords[i];
      var coneGeo = new THREE.ConeGeometry(c[3], c[4], 16, 1, true);
      var beam = new THREE.Mesh(coneGeo, beamMat);
      beam.position.set(c[0], c[1], c[2]);
      beam.rotation.x = Math.PI; // point downwards
      this.cityGroup.add(beam);
      this.sunbeams.push(beam);
    }
  };

  /* ------------------------------------------------------------------
     3. Floating Bubble Particle System
     ------------------------------------------------------------------ */
  UnderwaterCity.prototype.buildBubbleParticles = function () {
    var count = 380;
    var geo = new THREE.BufferGeometry();
    var posArray = new Float32Array(count * 3);
    var speedArray = new Float32Array(count);

    for (var i = 0; i < count; i++) {
      posArray[i * 3 + 0] = (Math.random() - 0.5) * 110;
      posArray[i * 3 + 1] = Math.random() * 24;
      posArray[i * 3 + 2] = (Math.random() - 0.5) * 110;
      speedArray[i] = 1.0 + Math.random() * 2.2;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    this.bubbleSpeeds = speedArray;

    var bubbleMat = new THREE.PointsMaterial({
      color: 0xdbf9fc,
      size: 0.38,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.bubbleParticles = new THREE.Points(geo, bubbleMat);
    this.cityGroup.add(this.bubbleParticles);
  };

  /* ------------------------------------------------------------------
     4. Roaming Tropical Fish Schools
     ------------------------------------------------------------------ */
  UnderwaterCity.prototype.buildRoamingFishSchool = function () {
    var fishColors = [0xff6b81, 0xffd86b, 0x19c4d4, 0xb9a4e6, 0xff9f43];

    for (var i = 0; i < 22; i++) {
      var color = fishColors[i % fishColors.length];
      var fishMat = new THREE.MeshLambertMaterial({ color: color });

      var fishGroup = new THREE.Group();
      // Fish body
      var bodyGeo = new THREE.SphereGeometry(0.38, 8, 6);
      bodyGeo.scale(1.6, 0.9, 0.4);
      var body = new THREE.Mesh(bodyGeo, fishMat);
      fishGroup.add(body);

      // Tail fin
      var tailGeo = new THREE.ConeGeometry(0.24, 0.45, 4);
      tailGeo.scale(1, 1, 0.2);
      var tail = new THREE.Mesh(tailGeo, fishMat);
      tail.position.set(-0.65, 0, 0);
      tail.rotation.z = Math.PI / 2;
      fishGroup.add(tail);

      // Random position roaming around the city
      var angle = Math.random() * Math.PI * 2;
      var radius = 10 + Math.random() * 32;
      var y = 2.0 + Math.random() * 8.0;

      fishGroup.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);

      this.cityGroup.add(fishGroup);
      this.roamingFish.push({
        group: fishGroup,
        radius: radius,
        angle: angle,
        speed: 0.18 + Math.random() * 0.22,
        yBase: y,
        tail: tail
      });
    }
  };

  /* ------------------------------------------------------------------
     5. Coral Reefs, Rocks & Seaweed Formations
     ------------------------------------------------------------------ */
  UnderwaterCity.prototype.buildCoralAndRockReefs = function () {
    var rockMat = new THREE.MeshLambertMaterial({ color: 0x4a6b7d, roughness: 0.9 });
    var coralPink = new THREE.MeshLambertMaterial({ color: 0xd93f5c, roughness: 0.6 });
    var coralPurple = new THREE.MeshLambertMaterial({ color: 0x9b5de5, roughness: 0.6 });
    var coralAqua = new THREE.MeshLambertMaterial({ color: 0x19c4d4, roughness: 0.5 });
    var coralOrange = new THREE.MeshLambertMaterial({ color: 0xf15bb5, roughness: 0.5 });
    var seaweedMat = new THREE.MeshLambertMaterial({ color: 0x157347, roughness: 0.7 });

    var clusters = [
      { x: -7, z: -8, count: 5 },
      { x: 8, z: -7, count: 5 },
      { x: -8, z: 8, count: 5 },
      { x: 9, z: 7, count: 5 },
      { x: -22, z: 2, count: 6 },
      { x: 22, z: -2, count: 6 },
      { x: 0, z: 22, count: 6 },
      { x: 0, z: -26, count: 7 }
    ];

    for (var i = 0; i < clusters.length; i++) {
      var c = clusters[i];

      // Underwater rock boulder
      var rockGeo = new THREE.DodecahedronGeometry(1.4 + Math.random() * 0.8, 1);
      var rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(c.x, 0.7, c.z);
      rock.scale.set(1.4, 0.8, 1.2);
      this.cityGroup.add(rock);

      // Coral spires
      var mats = [coralPink, coralPurple, coralAqua, coralOrange];
      for (var k = 0; k < c.count; k++) {
        var cMat = mats[(i + k) % mats.length];
        var spireGeo = new THREE.ConeGeometry(0.5 + Math.random() * 0.4, 1.8 + Math.random() * 1.5, 6);
        var spire = new THREE.Mesh(spireGeo, cMat);
        var offsetX = (Math.random() - 0.5) * 2.8;
        var offsetZ = (Math.random() - 0.5) * 2.8;
        spire.position.set(c.x + offsetX, 1.0, c.z + offsetZ);
        this.cityGroup.add(spire);
      }

      // Seaweed ribbons
      var swGeo = new THREE.BoxGeometry(0.12, 3.8, 0.4);
      var sw = new THREE.Mesh(swGeo, seaweedMat);
      sw.position.set(c.x + 1.2, 1.9, c.z - 0.5);
      this.cityGroup.add(sw);
      this.swayingSeaweeds.push(sw);
    }
  };

  /* ------------------------------------------------------------------
     6. Helper: 3D Billboard Canvas Sign Label
     ------------------------------------------------------------------ */
  function makeBillboardSign(title, colorHex) {
    var canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 140;
    var ctx = canvas.getContext("2d");

    // Rounded rectangle card
    ctx.fillStyle = "rgba(11, 58, 83, 0.90)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 120, 24);
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = colorHex || "#19c4d4";
    ctx.stroke();

    // Text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px 'Trebuchet MS', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 256, 70);

    var texture = new THREE.CanvasTexture(canvas);
    var spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      fog: false // stay readable from far away
    });
    var sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(9.5, 2.6, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  /* ------------------------------------------------------------------
     7. Build 5 Reference Buildings Matching Gemini Assets
     ------------------------------------------------------------------ */
  UnderwaterCity.prototype.buildAllReferenceBuildings = function () {
    // Order of preference for every building:
    //   1. real 3D model   static/models/buildings/<name>.glb   (if the file exists)
    //   2. image billboard static/images/buildings/cutouts/<name>.png
    //   3. old procedural model (if the image is missing too)
    var self = this;
    var configs = [
      {
        file: "quiz_academy.png", model: "quiz_academy.glb", signColor: "#ffd86b", x: 15, z: -13, width: 10.5, legacy: "buildQuizAcademy",
        dest: { id: "quiz", name: "Quiz Academy", desc: "Kuiz Matematik & Sains Tahun 4-6", route: "/quiz", wp: [0, 6.2] }
      },
      {
        file: "aqua_lab.png", model: "aqua_lab.glb", signColor: "#7fe0ea", x: -16, z: -12, width: 10.5, legacy: "buildAskAquaLab",
        dest: { id: "chat", name: "Ask Aqua Bubble Lab", desc: "Tutor Pembelajaran AI Aqua", route: "/learning?tab=chat", wp: [0, 5.8] }
      },
      {
        file: "my_aquarium.png", model: "my_aquarium.glb", signColor: "#1ba2bd", x: 16, z: 13, width: 10.5, legacy: "buildAquariumBuilding",
        dest: { id: "aquarium", name: "My Aquarium", desc: "Koleksi Ikan & Tangki Mingguan", route: "/aquarium", wp: [-4.2, 4.2] }
      },
      {
        file: "aqua_shop.png", model: "aqua_shop.glb", signColor: "#ee5d78", x: -15, z: 14, width: 10.5, legacy: "buildShopBuilding",
        dest: { id: "shop", name: "Decoration Shop", desc: "Kedai Hiasan Bawah Laut", route: "/shop", wp: [4.2, 4.2] }
      },
      {
        file: "learning_cove.png", model: "learning_cove.glb", signColor: "#b9a4e6", x: 0, z: -22, width: 10.5, legacy: "buildLearningCove",
        dest: { id: "learning", name: "Learning Cove", desc: "Nota Peribadi & Latihan Adaptif", route: "/learning", wp: [0, 4.8] }
      }
    ];
    configs.forEach(function (cfg) { self.buildModelBuilding(cfg); });
  };


  /**
   * 3D model building: loads <name>.glb (made with an image-to-3D tool such as
   * Meshy / Tripo / Hunyuan3D), scales it to cfg.width, sits it on the seabed.
   * If the .glb is missing or fails to parse, falls back to the image billboard.
   * Optional per-building cfg fields: rotY (radians), width, sink.
   */
  var MODEL_BASE = (typeof window !== "undefined" && window.AQ_BUILDING_MODEL_BASE) ||
    "/static/models/buildings/";
  var MODEL_BRIGHTEN = 0.35; // 0 = pure lighting, higher = brighter pastel look like the artwork

  UnderwaterCity.prototype.buildModelBuilding = function (cfg) {
    var self = this;
    if (!THREE.GLTFLoader || !cfg.model) { this.buildImageBuilding(cfg); return; }

    new THREE.GLTFLoader().load(
      MODEL_BASE + cfg.model,
      function (gltf) {
        var group = new THREE.Group();
        group.position.set(cfg.x, 0, cfg.z);

        var pivot = new THREE.Group();
        pivot.rotation.y = cfg.rotY || 0;
        pivot.add(gltf.scene);
        group.add(pivot);

        gltf.scene.traverse(function (o) {
          if (!o.isMesh) return;
          var mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(function (m) {
            // Metallic AI materials go black without an environment map; tame them
            if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.1);
            if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, 0.5);
            if (MODEL_BRIGHTEN > 0 && m.map && m.emissive && !m.transparent) {
              m.emissive.set(0xffffff);
              m.emissiveMap = m.map;
              m.emissiveIntensity = MODEL_BRIGHTEN;
            }
          });
        });

        // Fit footprint to cfg.width, centre on x/z, bottom on the seabed
        group.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(pivot);
        var size = box.getSize(new THREE.Vector3());
        var k = cfg.width / Math.max(size.x, size.z, 0.001);
        pivot.scale.setScalar(k);
        group.updateMatrixWorld(true);
        box.setFromObject(pivot);
        var c = box.getCenter(new THREE.Vector3());
        pivot.position.set(-(c.x - cfg.x), -box.min.y - (cfg.sink !== undefined ? cfg.sink : 0.2), -(c.z - cfg.z));
        group.updateMatrixWorld(true);
        box.setFromObject(pivot);
        size = box.getSize(new THREE.Vector3());

        group.destinationData = {
          id: cfg.dest.id,
          name: cfg.dest.name,
          desc: cfg.dest.desc,
          route: cfg.dest.route,
          waypoint: new THREE.Vector3(cfg.x + cfg.dest.wp[0], 1.4, cfg.z + cfg.dest.wp[1])
        };

        var shadow = new THREE.Mesh(
          new THREE.CircleGeometry(cfg.width * 0.5, 28),
          new THREE.MeshBasicMaterial({ color: 0x6b5a30, transparent: true, opacity: 0.28, depthWrite: false })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.scale.set(1, 0.7, 1);
        shadow.position.y = 0.05;
        group.add(shadow);

        self.addGroundSign(group, cfg);

        self.cityGroup.add(group);
        self.destinations.push(group);
        self.colliders.push({ x: cfg.x, z: cfg.z, radius: cfg.width * 0.42, height: size.y * 0.8 });
      },
      undefined,
      function () { self.buildImageBuilding(cfg); }
    );
  };


  /**
   * Signboard standing at the foot of a building, on the side facing the camera
   * (so it never covers the door). Position is refreshed in update().
   */
  UnderwaterCity.prototype.addGroundSign = function (group, cfg) {
    var sg = makeBillboardSign(cfg.dest.name, cfg.signColor);
    sg.scale.multiplyScalar(0.85);
    sg.position.set(0, 1.3, cfg.width * 0.5);
    group.add(sg);
    this.signs.push({ sprite: sg, gx: cfg.x, gz: cfg.z, reach: cfg.width * 0.5 + 0.5 });
  };

  /**
   * Image building: a transparent PNG standing on the seabed that always turns
   * to face the camera (updated in UnderwaterCity.update). Clicking uses an
   * invisible cylinder so the empty corners of the picture are not clickable.
   */
  var IMG_BASE = (typeof window !== "undefined" && window.AQ_BUILDING_IMG_BASE) ||
    "/static/images/buildings/cutouts/";

  UnderwaterCity.prototype.buildImageBuilding = function (cfg) {
    var self = this;
    var group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);

    group.destinationData = {
      id: cfg.dest.id,
      name: cfg.dest.name,
      desc: cfg.dest.desc,
      route: cfg.dest.route,
      waypoint: new THREE.Vector3(cfg.x + cfg.dest.wp[0], 1.4, cfg.z + cfg.dest.wp[1])
    };

    // Soft contact shadow on the sand
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(cfg.width * 0.5, 28),
      new THREE.MeshBasicMaterial({ color: 0x6b5a30, transparent: true, opacity: 0.28, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1, 0.7, 1);
    shadow.position.y = 0.05;
    group.add(shadow);

    var collider = { x: cfg.x, z: cfg.z, radius: cfg.width * 0.42, height: 1 };

    new THREE.TextureLoader().load(
      IMG_BASE + cfg.file,
      function (tex) {
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        var aspect = tex.image.width / tex.image.height;
        var w = cfg.width;
        var h = w / aspect;

        var geo = new THREE.PlaneGeometry(w, h);
        geo.translate(0, h / 2 - 0.35, 0); // sink the island base slightly into the sand
        var mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.35,
          side: THREE.DoubleSide
        });
        var plane = new THREE.Mesh(geo, mat);
        plane.raycast = function () {}; // picking is handled by the hit cylinder below
        group.add(plane);
        self.billboards.push({ mesh: plane, gx: cfg.x, gz: cfg.z });

        var hit = new THREE.Mesh(
          new THREE.CylinderGeometry(w * 0.36, w * 0.4, h * 0.85, 12),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hit.position.y = h * 0.425;
        group.add(hit);

        collider.height = h * 0.8;

        self.addGroundSign(group, cfg);
      },
      undefined,
      function () {
        // Image missing: fall back to the old procedural building
        self.cityGroup.remove(group);
        self.destinations.splice(self.destinations.indexOf(group), 1);
        self.colliders.splice(self.colliders.indexOf(collider), 1);
        self[cfg.legacy](cfg.x, 0, cfg.z);
      }
    );

    this.cityGroup.add(group);
    this.destinations.push(group);
    this.colliders.push(collider);
  };

  /**
   * Building A: Quiz Academy (Ref: quiz_academy.jpg)
   * Grand underwater academy with multi-tiered seashell roof, columns,
   * coral pink & turquoise walls, glowing entrance and knowledge emblems.
   */
  UnderwaterCity.prototype.buildQuizAcademy = function (x, y, z) {
    var group = new THREE.Group();
    group.position.set(x, y, z);

    var wallMat = new THREE.MeshLambertMaterial({ color: 0xfffaf5 });
    var coralMat = new THREE.MeshLambertMaterial({ color: 0xee5d78 });
    var aquaRoofMat = new THREE.MeshLambertMaterial({ color: 0x0d8aa6 });
    var goldMat = new THREE.MeshLambertMaterial({ color: 0xffd86b });

    // Main octagonal grand hall
    var baseGeo = new THREE.CylinderGeometry(4.5, 4.8, 5.0, 12);
    var base = new THREE.Mesh(baseGeo, wallMat);
    base.position.y = 2.5;
    group.add(base);

    // Multi-tier Seashell Fan Roof
    var tier1Geo = new THREE.ConeGeometry(5.8, 2.6, 12);
    var tier1 = new THREE.Mesh(tier1Geo, aquaRoofMat);
    tier1.position.y = 5.8;
    group.add(tier1);

    var tier2Geo = new THREE.ConeGeometry(4.2, 2.2, 12);
    var tier2 = new THREE.Mesh(tier2Geo, coralMat);
    tier2.position.y = 7.4;
    group.add(tier2);

    // Entrance portico columns
    var colGeo = new THREE.CylinderGeometry(0.28, 0.28, 3.2, 8);
    var col1 = new THREE.Mesh(colGeo, wallMat);
    col1.position.set(-1.4, 1.6, 4.4);
    var col2 = new THREE.Mesh(colGeo, wallMat);
    col2.position.set(1.4, 1.6, 4.4);
    group.add(col1);
    group.add(col2);

    // Glowing golden entrance
    var doorMat = new THREE.MeshBasicMaterial({ color: 0xffd86b });
    var door = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 0.4), doorMat);
    door.position.set(0, 1.4, 4.5);
    group.add(door);

    // Floating graduation/knowledge octahedron on top
    var emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), goldMat);
    emblem.position.set(0, 9.2, 0);
    group.add(emblem);

    var sign = makeBillboardSign("Quiz Academy", "#ffd86b");
    sign.position.set(0, 10.8, 0);
    group.add(sign);

    group.destinationData = {
      id: "quiz",
      name: "Quiz Academy",
      desc: "Kuiz Matematik & Sains Tahun 4-6",
      route: "/quiz",
      waypoint: new THREE.Vector3(x, 1.4, z + 6.2)
    };

    this.cityGroup.add(group);
    this.destinations.push(group);
    this.colliders.push({ x: x, z: z, radius: 5.2, height: 10.2 });
  };

  /**
   * Building B: Ask Aqua's Bubble Lab (Ref: aqua_lab.jpg)
   * Futuristic spherical transparent bubble dome with glowing cyan/lavender
   * energy rings, robotic antenna and AI lab equipment.
   */
  UnderwaterCity.prototype.buildAskAquaLab = function (x, y, z) {
    var group = new THREE.Group();
    group.position.set(x, y, z);

    var baseMat = new THREE.MeshLambertMaterial({ color: 0x0b3a53 });
    var platform = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.0, 1.4, 16), baseMat);
    platform.position.y = 0.7;
    group.add(platform);

    // Translucent glowing glass dome
    var domeGeo = new THREE.SphereGeometry(4.2, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    var domeMat = new THREE.MeshPhysicalMaterial({
      color: 0x7fe0ea,
      transparent: true,
      opacity: 0.52,
      roughness: 0.08,
      transmission: 0.78,
      emissive: 0x0d8aa6,
      emissiveIntensity: 0.38
    });
    var dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 1.4;
    group.add(dome);

    // Glowing AI core inside
    var coreMat = new THREE.MeshBasicMaterial({ color: 0x19c4d4 });
    var core = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5), coreMat);
    core.position.y = 3.6;
    group.add(core);

    // Sci-fi energy ring around dome
    var ringGeo = new THREE.TorusGeometry(4.4, 0.22, 8, 24);
    var ringMat = new THREE.MeshBasicMaterial({ color: 0xb9a4e6 });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 2.4;
    group.add(ring);

    // Entrance
    var door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.4), new THREE.MeshBasicMaterial({ color: 0x19c4d4 }));
    door.position.set(0, 1.2, 4.4);
    group.add(door);

    var sign = makeBillboardSign("Ask Aqua Bubble Lab", "#7fe0ea");
    sign.position.set(0, 7.8, 0);
    group.add(sign);

    group.destinationData = {
      id: "chat",
      name: "Ask Aqua Bubble Lab",
      desc: "Tutor Pembelajaran AI Aqua",
      route: "/learning?tab=chat",
      waypoint: new THREE.Vector3(x, 1.4, z + 5.8)
    };

    this.cityGroup.add(group);
    this.destinations.push(group);
    this.colliders.push({ x: x, z: z, radius: 5.2, height: 5.8 });
  };

  /**
   * Building C: My Aquarium (Ref: my_aquarium.jpg)
   * Curved glass cylindrical aquarium pavilion with swimming fish visible inside,
   * crystalline pillars, decorative pearls, turquoise aquatic glow.
   */
  UnderwaterCity.prototype.buildAquariumBuilding = function (x, y, z) {
    var group = new THREE.Group();
    group.position.set(x, y, z);

    var baseMat = new THREE.MeshLambertMaterial({ color: 0x0c698e });
    var base = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.7, 1.6, 16), baseMat);
    base.position.y = 0.8;
    group.add(base);

    // Glass cylinder pavilion
    var tankGeo = new THREE.CylinderGeometry(4.1, 4.1, 4.8, 16);
    var tankMat = new THREE.MeshPhysicalMaterial({
      color: 0x1ba2bd,
      transparent: true,
      opacity: 0.45,
      transmission: 0.82
    });
    var tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.y = 3.9;
    group.add(tank);

    // Aquarium domed roof
    var roofGeo = new THREE.SphereGeometry(4.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    var roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x0d8aa6 }));
    roof.position.y = 6.2;
    group.add(roof);

    // Model tropical fish inside
    var f1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.4, 0.2), new THREE.MeshBasicMaterial({ color: 0xff4757 }));
    f1.position.set(1.4, 3.8, 0);
    var f2 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.2), new THREE.MeshBasicMaterial({ color: 0xffa502 }));
    f2.position.set(-1.3, 2.9, 0.9);
    group.add(f1);
    group.add(f2);

    // Entrance
    var door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.4), new THREE.MeshBasicMaterial({ color: 0x7fe0ea }));
    door.position.set(-3.0, 1.2, 3.0);
    door.rotation.y = -Math.PI / 4;
    group.add(door);

    var sign = makeBillboardSign("My Aquarium", "#1ba2bd");
    sign.position.set(0, 8.8, 0);
    group.add(sign);

    group.destinationData = {
      id: "aquarium",
      name: "My Aquarium",
      desc: "Koleksi Ikan & Tangki Mingguan",
      route: "/aquarium",
      waypoint: new THREE.Vector3(x - 4.2, 1.4, z + 4.2)
    };

    this.cityGroup.add(group);
    this.destinations.push(group);
    this.colliders.push({ x: x, z: z, radius: 5.2, height: 10.4 });
  };

  /**
   * Building D: Pearl Decoration Shop (Ref: aqua_shop.jpg)
   * Cute underwater boutique with seashell roof, coral pink architecture,
   * giant shining pearl lantern on top, treasure chest display in front.
   */
  UnderwaterCity.prototype.buildShopBuilding = function (x, y, z) {
    var group = new THREE.Group();
    group.position.set(x, y, z);

    var shopMat = new THREE.MeshLambertMaterial({ color: 0xee5d78 });
    var shopBase = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.4, 6.2), shopMat);
    shopBase.position.y = 2.2;
    group.add(shopBase);

    // Scalloped roof
    var roofGeo = new THREE.ConeGeometry(5.2, 2.8, 8);
    var roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x14a0bd }));
    roof.position.y = 5.6;
    group.add(roof);

    // Giant Shining Pearl on top
    var pearlMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.1,
      emissive: 0xfff9e6,
      emissiveIntensity: 0.5
    });
    var giantPearl = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 16), pearlMat);
    giantPearl.position.y = 7.6;
    group.add(giantPearl);

    // Mini treasure chest display near door
    var chest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), new THREE.MeshLambertMaterial({ color: 0x8b4513 }));
    chest.position.set(3.0, 0.4, 3.8);
    group.add(chest);

    // Awning
    var awn = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 1.6), new THREE.MeshLambertMaterial({ color: 0xffd86b }));
    awn.position.set(2.4, 3.2, 3.2);
    awn.rotation.y = Math.PI / 4;
    group.add(awn);

    var sign = makeBillboardSign("Decoration Shop", "#ee5d78");
    sign.position.set(0, 9.6, 0);
    group.add(sign);

    group.destinationData = {
      id: "shop",
      name: "Decoration Shop",
      desc: "Kedai Hiasan Bawah Laut",
      route: "/shop",
      waypoint: new THREE.Vector3(x + 4.2, 1.4, z + 4.2)
    };

    this.cityGroup.add(group);
    this.destinations.push(group);
    this.colliders.push({ x: x, z: z, radius: 5.2, height: 9.0 });
  };

  /**
   * Building E: Learning Cove (Ref: learning_cove.jpg)
   * Magical sanctuary with curved coral arches, lavender & golden lighting,
   * glowing knowledge pearls and central open learning pavilion.
   */
  UnderwaterCity.prototype.buildLearningCove = function (x, y, z) {
    var group = new THREE.Group();
    group.position.set(x, y, z);

    var archMat = new THREE.MeshLambertMaterial({ color: 0xb9a4e6 }); // Lavender coral
    var archL = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 5.6, 8), archMat);
    archL.position.set(-2.8, 2.8, 0);
    var archR = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 5.6, 8), archMat);
    archR.position.set(2.8, 2.8, 0);
    var archTop = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.3, 1.8), archMat);
    archTop.position.set(0, 5.8, 0);

    group.add(archL);
    group.add(archR);
    group.add(archTop);

    // Central open learning pavilion
    var floorGeo = new THREE.CylinderGeometry(4.0, 4.2, 0.6, 16);
    var floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ color: 0xffd86b }));
    floor.position.y = 0.3;
    group.add(floor);

    // Glowing Knowledge Pearl cluster
    var pearlMat = new THREE.MeshBasicMaterial({ color: 0x7fe0ea });
    var pCenter = new THREE.Mesh(new THREE.SphereGeometry(0.55), pearlMat);
    pCenter.position.set(0, 4.2, 0);
    group.add(pCenter);

    var sign = makeBillboardSign("Learning Cove", "#b9a4e6");
    sign.position.set(0, 7.8, 0);
    group.add(sign);

    group.destinationData = {
      id: "learning",
      name: "Learning Cove",
      desc: "Nota Peribadi & Latihan Adaptif",
      route: "/learning",
      waypoint: new THREE.Vector3(x, 1.4, z + 4.8)
    };

    this.cityGroup.add(group);
    this.destinations.push(group);
    this.colliders.push({ x: x, z: z, radius: 5.0, height: 6.5 });
  };

  /* ------------------------------------------------------------------
     8. Per-frame Animation Updates
     ------------------------------------------------------------------ */
  UnderwaterCity.prototype.update = function (delta, elapsed) {
    // 1. Seaweed swaying
    for (var i = 0; i < this.swayingSeaweeds.length; i++) {
      var sw = this.swayingSeaweeds[i];
      sw.rotation.z = Math.sin(elapsed * 2.2 + i * 0.5) * 0.16;
    }

    // 2. Roaming tropical fish schools
    for (var f = 0; f < this.roamingFish.length; f++) {
      var fish = this.roamingFish[f];
      fish.angle += fish.speed * delta;
      fish.group.position.x = Math.cos(fish.angle) * fish.radius;
      fish.group.position.z = Math.sin(fish.angle) * fish.radius;
      fish.group.position.y = fish.yBase + Math.sin(elapsed * 3 + f) * 0.25;

      // Face tangential swim direction
      fish.group.rotation.y = -fish.angle + Math.PI / 2;

      // Tail flutter
      if (fish.tail) {
        fish.tail.rotation.y = Math.sin(elapsed * 12 + f) * 0.35;
      }
    }

    // 3. Floating particle bubbles rising
    if (this.bubbleParticles) {
      var positions = this.bubbleParticles.geometry.attributes.position.array;
      for (var b = 0; b < this.bubbleSpeeds.length; b++) {
        var idx = b * 3 + 1;
        positions[idx] += this.bubbleSpeeds[b] * delta;
        if (positions[idx] > 24) {
          positions[idx] = 0.5; // respawn near seabed
        }
      }
      this.bubbleParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 3b. Turn image buildings to face the camera (rotate around Y only)
    if (this.camera) {
      var cp = this.camera.position;
      for (var q = 0; q < this.billboards.length; q++) {
        var bb = this.billboards[q];
        bb.mesh.rotation.y = Math.atan2(cp.x - bb.gx, cp.z - bb.gz);
      }
    }

    // 3c. Keep each ground signboard on the camera side, low at the building's foot
    if (this.camera) {
      var cq = this.camera.position;
      for (var g = 0; g < this.signs.length; g++) {
        var sn = this.signs[g];
        var dx = cq.x - sn.gx, dz = cq.z - sn.gz;
        var len = Math.sqrt(dx * dx + dz * dz) || 1;
        var d = Math.min(sn.reach, len * 0.5);
        sn.sprite.position.x = (dx / len) * d;
        sn.sprite.position.z = (dz / len) * d;
      }
    }

    // 4. Subtle shimmer on sunbeams
    for (var s = 0; s < this.sunbeams.length; s++) {
      this.sunbeams[s].rotation.y = Math.sin(elapsed * 0.3 + s) * 0.1;
    }
  };

  return UnderwaterCity;
});