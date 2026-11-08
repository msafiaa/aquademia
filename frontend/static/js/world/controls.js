/* ==========================================================================
   Aquademia World Controls (Stage 1)
   - CameraRig:     smooth third-person orbit/follow camera, full 360-degree yaw,
                    camera-vs-building collision, "reset behind character".
   - InputState:    keyboard state that cannot get stuck (blur / tab switch / Cmd key)
                    and does not let Space/Enter re-trigger focused HUD buttons.
   - TouchControls: on-screen joystick + up/down buttons for touch devices.
   Pure helpers (no DOM) are exported too so they can be unit-tested.
   ========================================================================== */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["three"], factory);
  } else if (typeof exports === "object") {
    module.exports = factory(require("three"));
  } else {
    root.WorldControls = factory(root.THREE);
  }
})(typeof self !== "undefined" ? self : this, function (THREE) {
  "use strict";

  var TWO_PI = Math.PI * 2;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function normalizeAngle(a) {
    return ((a % TWO_PI) + TWO_PI) % TWO_PI;
  }

  /** Signed shortest rotation (radians) that takes angle `from` to angle `to`. */
  function shortestAngleDiff(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  /** Frame-rate independent smoothing factor (0..1) for exponential approach. */
  function damp(rate, dt) {
    return 1 - Math.exp(-rate * dt);
  }

  /**
   * Horizontal movement basis for a camera orbiting at `yaw`.
   * The camera sits at offset (sin yaw, cos yaw) from the character, so
   * "forward" (away from camera) is (-sin, -cos) and "right" is (cos, -sin).
   */
  function cameraBasis(yaw) {
    var s = Math.sin(yaw);
    var c = Math.cos(yaw);
    return { forward: { x: -s, z: -c }, right: { x: c, z: -s } };
  }

  /* ------------------------------------------------------------------
     Camera rig
     ------------------------------------------------------------------ */
  var CAMERA_DEFAULTS = { pitch: 0.28, distance: 8.5 };

  function CameraRig(options) {
    options = options || {};
    this.yaw = options.yaw || 0;
    this.pitch = CAMERA_DEFAULTS.pitch;
    this.distance = CAMERA_DEFAULTS.distance;        // requested (zoom target)
    this.currentDistance = this.distance;            // smoothed zoom
    this.effectiveDistance = this.distance;          // after collision shortening

    this.minDistance = 4.0;
    this.maxDistance = 18.0;
    this.minPitch = -0.35;
    this.maxPitch = 1.15;

    this.focusHeight = 1.2;       // aim at the character's chest/head
    this.followRate = 9;          // focus smoothing (higher = snappier)
    this.zoomRate = 10;
    this.resetRate = 7;
    this.floorClearance = 0.6;    // camera never dips below ground + this
    this.collisionMargin = 0.5;   // keep camera this far outside building walls
    this.minCollisionDistance = 1.4;
    this.groundHeightAt = options.groundHeightAt || null; // optional (x, z) => y, used by later stages

    this.focus = new THREE.Vector3();
    this.hasFocus = false;
    this._reset = null;
    this._blend = null;
  }

  /** Mouse/touch drag: dx, dy in pixels. */
  CameraRig.prototype.rotate = function (dx, dy) {
    this._reset = null;
    this.yaw = normalizeAngle(this.yaw - dx * 0.0065);
    this.pitch = clamp(this.pitch + dy * 0.005, this.minPitch, this.maxPitch);
  };

  CameraRig.prototype.zoom = function (delta) {
    this.distance = clamp(this.distance + delta, this.minDistance, this.maxDistance);
  };

  /**
   * Put the camera directly behind a character that faces `heading`
   * (heading 0 = facing +Z). `instant` skips the smooth swing.
   */
  CameraRig.prototype.resetBehind = function (heading, instant) {
    var targetYaw = normalizeAngle(heading + Math.PI);
    if (instant) {
      this.yaw = targetYaw;
      this.pitch = CAMERA_DEFAULTS.pitch;
      this.distance = CAMERA_DEFAULTS.distance;
      this.currentDistance = this.distance;
      this.effectiveDistance = this.distance;
      this._reset = null;
    } else {
      this._reset = { yaw: targetYaw, pitch: CAMERA_DEFAULTS.pitch };
      this.distance = CAMERA_DEFAULTS.distance;
    }
  };

  CameraRig.prototype.snapFocus = function (targetPos) {
    this.focus.set(targetPos.x, targetPos.y + this.focusHeight, targetPos.z);
    this.hasFocus = true;
  };

  /** Smoothly blend from the camera's current position (e.g. after the intro cinematic). */
  CameraRig.prototype.startBlend = function (camera, duration) {
    this._blend = { from: camera.position.clone(), t: 0, duration: duration || 0.6 };
  };

  /**
   * Largest camera distance along the ray (focus -> direction) that does not
   * enter any building collider ({x, z, radius, height?}).
   */
  CameraRig.prototype.collisionDistance = function (fx, fy, fz, dx, dy, dz, dist, colliders) {
    if (!colliders || colliders.length === 0) return dist;
    var margin = this.collisionMargin;

    function blockedAt(d) {
      var px = fx + dx * d;
      var py = fy + dy * d;
      var pz = fz + dz * d;
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        var top = (c.height == null ? Infinity : c.height) + margin;
        if (py >= top) continue;
        var r = (c.radius || 4.2) + margin;
        var ox = px - c.x;
        var oz = pz - c.z;
        if (ox * ox + oz * oz < r * r) {
          // Ignore a collider the focus point itself is already inside
          var fox = fx - c.x;
          var foz = fz - c.z;
          if (fy < top && fox * fox + foz * foz < r * r) continue;
          return true;
        }
      }
      return false;
    }

    var steps = 14;
    for (var i = 1; i <= steps; i++) {
      var d = (dist * i) / steps;
      if (blockedAt(d)) {
        var lo = (dist * (i - 1)) / steps;
        var hi = d;
        for (var k = 0; k < 6; k++) {
          var mid = (lo + hi) / 2;
          if (blockedAt(mid)) hi = mid; else lo = mid;
        }
        return Math.max(this.minCollisionDistance, lo);
      }
    }
    return dist;
  };

  CameraRig.prototype.update = function (camera, targetPos, dt, colliders) {
    dt = Math.min(Math.max(dt, 0), 0.1);

    // Smooth "reset behind character" swing
    if (this._reset) {
      var k = damp(this.resetRate, dt);
      var dyaw = shortestAngleDiff(this.yaw, this._reset.yaw);
      this.yaw = normalizeAngle(this.yaw + dyaw * k);
      this.pitch += (this._reset.pitch - this.pitch) * k;
      if (Math.abs(dyaw) < 0.003 && Math.abs(this._reset.pitch - this.pitch) < 0.003) {
        this.yaw = this._reset.yaw;
        this.pitch = this._reset.pitch;
        this._reset = null;
      }
    }

    // Smoothly follow the character (orbit itself stays instant and lag-free)
    var tx = targetPos.x;
    var ty = targetPos.y + this.focusHeight;
    var tz = targetPos.z;
    if (!this.hasFocus) {
      this.focus.set(tx, ty, tz);
      this.hasFocus = true;
    } else {
      var f = damp(this.followRate, dt);
      this.focus.x += (tx - this.focus.x) * f;
      this.focus.y += (ty - this.focus.y) * f;
      this.focus.z += (tz - this.focus.z) * f;
    }

    this.currentDistance += (this.distance - this.currentDistance) * damp(this.zoomRate, dt);

    var cp = Math.cos(this.pitch);
    var dirX = cp * Math.sin(this.yaw);
    var dirY = Math.sin(this.pitch);
    var dirZ = cp * Math.cos(this.yaw);

    // Pull the camera in when a building is in the way; ease back out slowly
    var allowed = this.collisionDistance(
      this.focus.x, this.focus.y, this.focus.z, dirX, dirY, dirZ, this.currentDistance, colliders
    );
    var eased = this.effectiveDistance + (this.currentDistance - this.effectiveDistance) * damp(4, dt);
    this.effectiveDistance = Math.min(eased, allowed);

    var px = this.focus.x + dirX * this.effectiveDistance;
    var py = this.focus.y + dirY * this.effectiveDistance;
    var pz = this.focus.z + dirZ * this.effectiveDistance;

    var ground = this.groundHeightAt ? this.groundHeightAt(px, pz) : 0;
    py = Math.max(ground + this.floorClearance, py);

    if (this._blend) {
      this._blend.t += dt / this._blend.duration;
      var s = clamp(this._blend.t, 0, 1);
      s = s * s * (3 - 2 * s);
      px = this._blend.from.x + (px - this._blend.from.x) * s;
      py = this._blend.from.y + (py - this._blend.from.y) * s;
      pz = this._blend.from.z + (pz - this._blend.from.z) * s;
      if (this._blend.t >= 1) this._blend = null;
    }

    camera.position.set(px, py, pz);
    camera.lookAt(this.focus);
  };

  /* ------------------------------------------------------------------
     Keyboard input
     ------------------------------------------------------------------ */
  var GAME_KEYS = {
    KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, KeyC: 1,
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
    Space: 1, ShiftLeft: 1, ShiftRight: 1
  };

  function isTextTarget(t) {
    if (!t) return false;
    var tag = (t.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!t.isContentEditable;
  }

  function InputState() {
    this.keys = {};
    this.analog = { x: 0, y: 0, vertical: 0 }; // written by TouchControls
    this._handlers = null;
  }

  InputState.prototype.clear = function () {
    for (var k in this.keys) {
      if (Object.prototype.hasOwnProperty.call(this.keys, k)) this.keys[k] = false;
    }
  };

  InputState.prototype.attach = function (win, doc) {
    if (this._handlers) return;
    win = win || window;
    doc = doc || document;
    var self = this;

    var h = {
      keydown: function (e) {
        if (isTextTarget(e.target) || !GAME_KEYS[e.code]) return;
        // Let browser/OS shortcuts (Ctrl+W, Cmd+Arrow ...) through without moving the character
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault(); // stops page scroll and Space/Enter re-triggering a focused button
        self.keys[e.code] = true;
      },
      keyup: function (e) {
        if (GAME_KEYS[e.code]) {
          self.keys[e.code] = false;
          if (!isTextTarget(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
        }
        // macOS does not send keyup for keys pressed while Cmd is held
        if (e.code === "MetaLeft" || e.code === "MetaRight") self.clear();
      },
      blur: function () { self.clear(); },
      contextmenu: function () { self.clear(); },
      pagehide: function () { self.clear(); },
      visibilitychange: function () { if (doc.hidden) self.clear(); }
    };

    win.addEventListener("keydown", h.keydown);
    win.addEventListener("keyup", h.keyup);
    win.addEventListener("blur", h.blur);
    win.addEventListener("contextmenu", h.contextmenu);
    win.addEventListener("pagehide", h.pagehide);
    doc.addEventListener("visibilitychange", h.visibilitychange);
    this._handlers = { h: h, win: win, doc: doc };
  };

  InputState.prototype.detach = function () {
    if (!this._handlers) return;
    var o = this._handlers;
    o.win.removeEventListener("keydown", o.h.keydown);
    o.win.removeEventListener("keyup", o.h.keyup);
    o.win.removeEventListener("blur", o.h.blur);
    o.win.removeEventListener("contextmenu", o.h.contextmenu);
    o.win.removeEventListener("pagehide", o.h.pagehide);
    o.doc.removeEventListener("visibilitychange", o.h.visibilitychange);
    this._handlers = null;
    this.clear();
  };

  /* ------------------------------------------------------------------
     Touch controls: virtual joystick (move) + up/down buttons (swim vertically)
     ------------------------------------------------------------------ */
  function TouchControls(options) {
    this.container = options.container;
    this.analog = options.analog;
    this.root = null;
    this.joystick = null;
    this.knob = null;
    this._joyPointer = null;
    this._up = false;
    this._down = false;
    this.deadZone = 0.15;
  }

  /** Show touch controls on touch-first devices only. */
  TouchControls.shouldEnable = function (win) {
    win = win || window;
    var mm = function (q) { return win.matchMedia ? win.matchMedia(q).matches : false; };
    if (mm("(pointer: coarse)")) return true;
    var points = (win.navigator && win.navigator.maxTouchPoints) || 0;
    return points > 0 && !mm("(any-pointer: fine)");
  };

  TouchControls.prototype.mount = function () {
    var self = this;
    var doc = this.container.ownerDocument;

    var joystick = doc.createElement("div");
    joystick.className = "touch-joystick";
    joystick.setAttribute("aria-label", "Joystik berenang");
    var knob = doc.createElement("div");
    knob.className = "touch-joystick__knob";
    joystick.appendChild(knob);

    var vertical = doc.createElement("div");
    vertical.className = "touch-vertical";
    var up = this._makeButton(doc, "touch-vbtn touch-vbtn--up", "\u25B2", "Berenang naik", "_up");
    var down = this._makeButton(doc, "touch-vbtn touch-vbtn--down", "\u25BC", "Berenang turun", "_down");
    vertical.appendChild(up);
    vertical.appendChild(down);

    this.container.appendChild(joystick);
    this.container.appendChild(vertical);
    this.joystick = joystick;
    this.knob = knob;
    this.root = vertical;

    joystick.addEventListener("pointerdown", function (e) {
      if (self._joyPointer !== null) return;
      self._joyPointer = e.pointerId;
      if (joystick.setPointerCapture) { try { joystick.setPointerCapture(e.pointerId); } catch (err) {} }
      e.preventDefault();
      self._moveJoystick(e);
    });
    joystick.addEventListener("pointermove", function (e) {
      if (e.pointerId === self._joyPointer) self._moveJoystick(e);
    });
    var endJoy = function (e) {
      if (e.pointerId !== self._joyPointer) return;
      self._joyPointer = null;
      self._releaseJoystick();
    };
    joystick.addEventListener("pointerup", endJoy);
    joystick.addEventListener("pointercancel", endJoy);
    joystick.addEventListener("lostpointercapture", endJoy);

    var win = doc.defaultView;
    if (win) {
      win.addEventListener("blur", function () { self.release(); });
    }
    doc.addEventListener("visibilitychange", function () { if (doc.hidden) self.release(); });
  };

  TouchControls.prototype._makeButton = function (doc, className, label, aria, flag) {
    var self = this;
    var btn = doc.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = label;
    btn.setAttribute("aria-label", aria);
    var ptr = null;
    btn.addEventListener("pointerdown", function (e) {
      ptr = e.pointerId;
      if (btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (err) {} }
      e.preventDefault();
      self[flag] = true;
      btn.classList.add("active");
      self._syncVertical();
    });
    var end = function (e) {
      if (e.pointerId !== ptr) return;
      ptr = null;
      self[flag] = false;
      btn.classList.remove("active");
      self._syncVertical();
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener("lostpointercapture", end);
    btn._release = function () { ptr = null; self[flag] = false; btn.classList.remove("active"); };
    return btn;
  };

  TouchControls.prototype._syncVertical = function () {
    this.analog.vertical = (this._up ? 1 : 0) - (this._down ? 1 : 0);
  };

  TouchControls.prototype._moveJoystick = function (e) {
    var rect = this.joystick.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var maxR = Math.max(1, rect.width * 0.38);
    var dx = e.clientX - cx;
    var dy = e.clientY - cy;
    var len = Math.hypot(dx, dy);
    if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR; len = maxR; }

    var mag = len / maxR;
    if (mag < this.deadZone) {
      this.analog.x = 0;
      this.analog.y = 0;
    } else {
      var scaled = (mag - this.deadZone) / (1 - this.deadZone); // 0..1 outside the dead zone
      this.analog.x = (dx / len) * scaled;
      this.analog.y = (-dy / len) * scaled; // screen-up = forward
    }
    this.knob.style.transform = "translate(" + dx + "px," + dy + "px)";
  };

  TouchControls.prototype._releaseJoystick = function () {
    this.analog.x = 0;
    this.analog.y = 0;
    if (this.knob) this.knob.style.transform = "translate(0px,0px)";
  };

  /** Drop every held control (used on blur / tab switch). */
  TouchControls.prototype.release = function () {
    this._joyPointer = null;
    this._releaseJoystick();
    this._up = false;
    this._down = false;
    this._syncVertical();
    if (this.root) {
      var btns = this.root.querySelectorAll("button");
      for (var i = 0; i < btns.length; i++) if (btns[i]._release) btns[i]._release();
    }
  };

  return {
    CameraRig: CameraRig,
    InputState: InputState,
    TouchControls: TouchControls,
    clamp: clamp,
    damp: damp,
    normalizeAngle: normalizeAngle,
    shortestAngleDiff: shortestAngleDiff,
    cameraBasis: cameraBasis
  };
});
