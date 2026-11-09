/* Aquademia – login & registration
   Endpoints: POST /api/auth/login, POST /api/auth/register, GET /api/auth/me, POST /api/auth/logout
   Validation mirrors backend/services/auth_service.py. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  var root = document.getElementById("auth-root");
  if (!root) return;

  var URLS = {
    login: root.dataset.loginUrl,
    register: root.dataset.registerUrl,
    me: root.dataset.meUrl,
    logout: root.dataset.logoutUrl,
    next: root.dataset.nextUrl || ""
  };

  var USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
  var PW_MIN = 8, PW_MAX = 128;

  var $ = function (id) { return document.getElementById(id); };
  var forms = $("auth-forms");
  var done = $("auth-done");
  var tabs = { login: $("tab-login"), register: $("tab-register") };
  var panels = { login: $("panel-login"), register: $("panel-register") };
  var loginForm = $("login-form");
  var registerForm = $("register-form");
  var mascots = $("mascots");
  var speech = $("mascot-speech");
  var busy = false;

  /* ---------- Mascots (never shame the student) ---------- */
  var SAY = {
    login:    "Hai! I'm Mal. Ready to dive in?",
    register: "Hi, I'm Fania! Let's make your explorer account.",
    loading:  "One moment, checking the ocean map...",
    problem:  "Hmm, let's check that together. You can do it!",
    network:  "Oh no, I can't reach the ocean. Check your internet and try again!"
  };
  var mascotImgs = [$("mascot-mal"), $("mascot-fania")];

  function setMascots(state, message) {
    mascots.dataset.state = state;
    var pose = state === "thinking" ? "thinking" : "idle";
    mascotImgs.forEach(function (img) {
      var src = img.dataset[pose];
      if (src && img.getAttribute("src") !== src) img.setAttribute("src", src);
    });
    if (message) speech.textContent = message;
  }

  window.addEventListener("load", function () {
    mascotImgs.forEach(function (img) {
      ["thinking", "surprised"].forEach(function (k) {
        if (img.dataset[k]) { var p = new Image(); p.src = img.dataset[k]; }
      });
    });
  });

  /* ---------- UI helpers ---------- */
  function setFieldError(input, message) {
    var el = $(input.id + "-error");
    input.setAttribute("aria-invalid", "true");
    if (el) { el.textContent = message; el.hidden = false; }
  }
  function clearFieldError(input) {
    var el = $(input.id + "-error");
    delete input.dataset.serverError;
    input.removeAttribute("aria-invalid");
    if (el) { el.textContent = ""; el.hidden = true; }
  }
  function setYearError(message) {
    var group = registerForm.querySelector(".year-field");
    var el = $("reg-year-error");
    group.classList.toggle("has-error", !!message);
    el.textContent = message || "";
    el.hidden = !message;
  }
  function showAlert(el, message, kind) {
    el.className = "aq-alert aq-alert--" + (kind || "error");
    el.textContent = message;
    el.hidden = false;
  }
  function hideAlert(el) { el.hidden = true; el.textContent = ""; }
  function clearAll(form) {
    Array.prototype.forEach.call(form.querySelectorAll(".aq-input"), clearFieldError);
    hideAlert(form.querySelector(".aq-alert"));
    if (form === registerForm) setYearError("");
  }
  function setBusy(button, on) {
    busy = on;
    button.disabled = on;
    button.setAttribute("aria-busy", on ? "true" : "false");
  }
  function resetPasswordToggles() {
    Array.prototype.forEach.call(document.querySelectorAll(".pw-toggle"), function (btn) {
      $(btn.dataset.toggleFor).type = "password";
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Show password");
    });
  }

  /* ---------- Network: JSON in, JSON out, never throws ---------- */
  function postJSON(url, body) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
      signal: controller.signal
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    }).catch(function () {
      return { network: true };
    }).finally(function () { clearTimeout(timer); });
  }

  /* ---------- Validation (mirrors the backend) ---------- */
  var rules = {
    "login-username": function (v) { return v.trim() ? "" : "Please type your username."; },
    "login-password": function (v) { return v ? "" : "Please type your password."; },
    "reg-username": function (v) {
      v = v.trim();
      if (!v) return "Please choose a username.";
      if (v.length < 3) return "Make it at least 3 characters long.";
      if (!USERNAME_RE.test(v)) return "Use only letters, numbers or _ (no spaces), up to 30 characters.";
      return "";
    },
    "reg-password": function (v) {
      if (!v) return "Please create a password.";
      if (v.length < PW_MIN) return "Almost there! Your password needs at least " + PW_MIN + " characters (you have " + v.length + ").";
      if (v.length > PW_MAX) return "That's too long. Please use at most " + PW_MAX + " characters.";
      return "";
    },
    "reg-confirm": function (v) {
      if (!v) return "Please type your password again.";
      return v === $("reg-password").value ? "" : "The two passwords don't match yet. Try typing it again.";
    }
  };

  function validate(input) {
    var message = rules[input.id](input.value);
    if (message) setFieldError(input, message); else clearFieldError(input);
    return !message;
  }
  function selectedYear() {
    var checked = registerForm.querySelector('input[name="year_level"]:checked');
    return checked ? parseInt(checked.value, 10) : null;
  }

  // Validate only when focus moves to ANOTHER TEXT FIELD. Validating on blur to a button
  // would shift the layout on mouse-down and swallow the click. Submit validates everything.
  Object.keys(rules).forEach(function (id) {
    var input = $(id);
    input.addEventListener("blur", function (e) {
      var next = e.relatedTarget;
      if (!next || !next.classList || !next.classList.contains("aq-input")) return;
      if (input.dataset.serverError) return;
      if (input.value !== "" || input.hasAttribute("aria-invalid")) validate(input);
    });
    input.addEventListener("input", function () {
      delete input.dataset.serverError;
      if (input.hasAttribute("aria-invalid") && !rules[id](input.value)) clearFieldError(input);
    });
  });

  $("reg-password").addEventListener("input", function () {
    var confirm = $("reg-confirm");
    if (confirm.hasAttribute("aria-invalid") && !rules["reg-confirm"](confirm.value)) clearFieldError(confirm);
  });

  Array.prototype.forEach.call(registerForm.querySelectorAll('input[name="year_level"]'), function (r) {
    r.addEventListener("change", function () { setYearError(""); });
  });

  /* Password meter + character count */
  var meter = $("pw-meter-fill");
  var count = $("pw-count");
  $("reg-password").addEventListener("input", function (e) {
    var len = e.target.value.length;
    meter.style.width = Math.min(len / 16, 1) * 100 + "%";
    meter.dataset.level = len >= 16 ? "strong" : len >= PW_MIN ? "ok" : "low";
    count.textContent = len >= PW_MIN ? len + " \u2713" : len + " / " + PW_MIN;
  });

  /* Show / hide password */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".pw-toggle");
    if (!btn) return;
    var input = $(btn.dataset.toggleFor);
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", show ? "true" : "false");
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  /* ---------- Friendly server errors (always inserted with textContent) ---------- */
  function showRegisterError(res) {
    var raw = (res.data && res.data.error) || "";
    var u = $("reg-username"), p = $("reg-password"), c = $("reg-confirm");

    if (/already exists/i.test(raw)) {
      setFieldError(u, "Oops, another explorer already has that name. Try adding a number, like " + (u.value.trim() || "Explorer") + "7!");
      u.dataset.serverError = "1";
      u.focus();
    } else if (/^Username must/i.test(raw)) {
      setFieldError(u, rules["reg-username"](u.value) || "Please check your username.");
      u.focus();
    } else if (/^Password must be between/i.test(raw) || /Password is required/i.test(raw)) {
      setFieldError(p, rules["reg-password"](p.value) || "Please check your password.");
      p.focus();
    } else if (/do not match/i.test(raw)) {
      setFieldError(c, rules["reg-confirm"](c.value) || "The two passwords don't match yet.");
      c.focus();
    } else if (/Year level/i.test(raw)) {
      setYearError("Please pick your year.");
    } else {
      showAlert($("register-alert"),
        res.status >= 500
          ? "Something went wrong on our side. Please try again in a moment."
          : "We couldn't create your account just yet. Please check your answers and try again.");
    }
  }

  /* ---------- Tabs ---------- */
  function setTab(name, focusTab) {
    Object.keys(tabs).forEach(function (key) {
      var active = key === name;
      tabs[key].setAttribute("aria-selected", active ? "true" : "false");
      tabs[key].tabIndex = active ? 0 : -1;
      panels[key].hidden = !active;
    });
    setMascots("idle", SAY[name]);
    if (focusTab) tabs[name].focus();
    try { history.replaceState(null, "", "/" + name); } catch (e) { /* ignore */ }
  }

  Object.keys(tabs).forEach(function (name) {
    tabs[name].addEventListener("click", function () { setTab(name); });
  });

  document.addEventListener("click", function (e) {
    var go = e.target.closest("[data-goto]");
    if (go) { setTab(go.dataset.goto); panels[go.dataset.goto].querySelector("input").focus(); }
  });

  $("tab-login").parentNode.addEventListener("keydown", function (e) {
    var order = ["login", "register"];
    var current = tabs.register.getAttribute("aria-selected") === "true" ? 1 : 0;
    var next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") next = (current + 1) % 2;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    if (next !== null) { e.preventDefault(); setTab(order[next], true); }
  });

  /* ---------- Celebration: bubbles rise while the scene dives from beach to ocean ---------- */
  function triggerBubbleSurge(callback) {
    var surgeLayer = $("bubble-surge");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!surgeLayer || reduce) {
      setTimeout(function () { if (callback) callback(); }, 400);
      return;
    }

    surgeLayer.innerHTML = "";
    surgeLayer.classList.add("active");

    var isSmall = window.innerWidth < 600;
    var n = isSmall ? 30 : 55;

    for (var i = 0; i < n; i++) {
      var b = document.createElement("span");
      b.className = "surge-bubble";
      var size = Math.floor(Math.random() * (isSmall ? 42 : 68)) + 18;
      b.style.width = size + "px";
      b.style.height = size + "px";
      b.style.left = (Math.random() * 96).toFixed(1) + "%";
      b.style.setProperty("--surge-dur", (1.1 + Math.random() * 0.75).toFixed(2) + "s");
      b.style.setProperty("--surge-delay", (Math.random() * 0.45).toFixed(2) + "s");
      b.style.setProperty("--sway-x", (Math.random() * 80 - 40).toFixed(0) + "px");
      surgeLayer.appendChild(b);
    }

    setTimeout(function () { if (callback) callback(); }, 1500);
  }

  /* ---------- Success / already-signed-in view ---------- */
  function showDone(student, mode) {
    var name = student && student.username ? student.username : "explorer";
    var heading = mode === "register" ? "Welcome aboard!" : mode === "back" ? "You're already in!" : "You're in!";
    var line = mode === "register"
      ? "Tahniah " + name + "! Akaun pengembara anda telah sedia."
      : "Selamat kembali, " + name + "! Pengembaraan lautan sedia bermula.";

    forms.hidden = true;
    done.hidden = false;
    $("done-heading").textContent = heading;
    $("done-text").textContent = line;
    setMascots("success", "Yay! Selamat datang, " + name + "! Jom menyelam! \uD83C\uDF0A\uD83E\uDEE7");
    $("done-heading").focus();

    // Beach -> ocean. Already signed in = start underwater with no animation.
    document.body.classList.add(mode === "back" ? "is-underwater" : "is-diving");

    if (URLS.next && mode !== "back") {
      $("done-text").textContent = line + " Bersedia... menyelam ke Aquademia!";
      triggerBubbleSurge(function () { window.location.assign(URLS.next); });
    } else if (URLS.next) {
      window.location.assign(URLS.next);
    }
  }

  function showForms() {
    document.body.classList.remove("is-diving", "is-underwater");   // back up to the beach
    done.hidden = true;
    forms.hidden = false;
    loginForm.reset();
    registerForm.reset();
    clearAll(loginForm);
    clearAll(registerForm);
    resetPasswordToggles();
    meter.style.width = "0";
    count.textContent = "0 / " + PW_MIN;
    setTab("login");
    $("login-username").focus();
  }

  /* ---------- Login ---------- */
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;

    clearAll(loginForm);
    var u = $("login-username"), p = $("login-password");
    var results = [validate(u), validate(p)];
    if (results.indexOf(false) !== -1) {
      setMascots("thinking", SAY.problem);
      (results[0] ? p : u).focus();
      return;
    }

    var button = $("login-submit");
    setBusy(button, true);
    setMascots("idle", SAY.loading);

    postJSON(URLS.login, { username: u.value.trim(), password: p.value }).then(function (res) {
      setBusy(button, false);

      if (res.network) {
        showAlert($("login-alert"), "We couldn't reach Aquademia. Please check your internet connection and try again.");
        setMascots("thinking", SAY.network);
      } else if (res.ok) {
        p.value = "";
        resetPasswordToggles();
        showDone(res.data.student, "login");
      } else if (res.status === 401) {
        showAlert($("login-alert"), "Hmm, that username and password don't match. Check them and try again. You can do it!");
        setMascots("thinking", SAY.problem);
        p.value = "";
        p.focus();
      } else {
        showAlert($("login-alert"), "Something went wrong on our side. Please try again in a moment.");
        setMascots("thinking", SAY.problem);
      }
    });
  });

  /* ---------- Register (then log in automatically; register doesn't start a session) ---------- */
  registerForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;

    clearAll(registerForm);
    var u = $("reg-username"), p = $("reg-password"), c = $("reg-confirm");
    var year = selectedYear();

    var uOk = validate(u);
    if (year === null) setYearError("Please pick your year.");
    var pOk = validate(p);
    var cOk = validate(c);

    if (!uOk || year === null || !pOk || !cOk) {
      setMascots("thinking", SAY.problem);
      if (!uOk) u.focus();
      else if (year === null) registerForm.querySelector('input[name="year_level"]').focus();
      else if (!pOk) p.focus();
      else c.focus();
      return;
    }

    var button = $("register-submit");
    setBusy(button, true);
    setMascots("idle", SAY.loading);

    var username = u.value.trim();
    var password = p.value;

    postJSON(URLS.register, {
      username: username,
      password: password,
      confirm_password: c.value,
      year_level: year
    }).then(function (res) {
      if (res.network) {
        setBusy(button, false);
        showAlert($("register-alert"), "We couldn't reach Aquademia. Please check your internet connection and try again.");
        setMascots("thinking", SAY.network);
        return;
      }
      if (!res.ok) {
        setBusy(button, false);
        setMascots("thinking", SAY.problem);
        showRegisterError(res);
        return;
      }

      return postJSON(URLS.login, { username: username, password: password }).then(function (loginRes) {
        setBusy(button, false);
        if (loginRes.ok) {
          registerForm.reset();
          resetPasswordToggles();
          showDone(loginRes.data.student || res.data.student, "register");
        } else {
          registerForm.reset();
          setTab("login");
          $("login-username").value = username;
          showAlert($("login-alert"), "Your account is ready! Please log in to start.", "success");
          $("login-password").focus();
        }
      });
    });
  });

  /* ---------- Logout ---------- */
  $("logout-btn").addEventListener("click", function () {
    if (busy) return;
    var button = $("logout-btn");
    setBusy(button, true);
    postJSON(URLS.logout, {}).then(function (res) {
      setBusy(button, false);
      if (res.ok) showForms();
      else $("done-text").textContent = "We couldn't log you out just now. Please try again.";
    });
  });

  /* ---------- Start-up ---------- */
  setTab(root.dataset.initialTab === "register" ? "register" : "login");

  if (root.dataset.hasSession === "true") {
    fetch(URLS.me, { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data && data.student) showDone(data.student, "back"); })
      .catch(function () { /* stay on the forms */ });
  }
})();