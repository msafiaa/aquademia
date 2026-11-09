/* ==========================================================================
   Aquademia Learning, Adaptive Practice & Ask Aqua Controller
   ========================================================================== */
(function () {
  "use strict";

  var R = window.AqRender;

  // Elements
  var tabs = {
    notes: document.getElementById("tab-notes"),
    adaptive: document.getElementById("tab-adaptive"),
    chat: document.getElementById("tab-chat"),
    history: document.getElementById("tab-history")
  };

  var panels = {
    notes: document.getElementById("panel-notes"),
    adaptive: document.getElementById("panel-adaptive"),
    chat: document.getElementById("panel-chat"),
    history: document.getElementById("panel-history")
  };

  // State
  var currentStudent = null;
  var currentAttemptId = null;
  var chatHistory = []; // in-memory session history [{role: "user"|"assistant", content: str}]

  // Fish map to existing assets
  var FISH_IMAGES = {
    "Royal Betta": "/static/images/fish/fish-1.jpg",
    "Angelfish": "/static/images/fish/fish-2.jpg",
    "Clownfish": "/static/images/fish/fish-3.jpg",
    "Neon Tetra": "/static/images/fish/fish-4.jpg",
    "Guppy": "/static/images/fish/fish-5.jpg"
  };

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

      // Determine attempt_id
      var params = new URLSearchParams(window.location.search);
      var qAttempt = params.get("attempt_id");
      var qTab = params.get("tab") || "notes";

      if (qAttempt && parseInt(qAttempt, 10) > 0) {
        currentAttemptId = parseInt(qAttempt, 10);
        activateTab(qTab);
        loadAttemptData(currentAttemptId);
      } else {
        // Fetch from history
        fetch("/api/learning/history", { credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (hData) {
            var list = (hData && hData.history) || [];
            if (list.length > 0) {
              currentAttemptId = list[0].attempt_id;
              activateTab(qTab);
              loadAttemptData(currentAttemptId);
            } else {
              // No attempts yet
              showNoAttemptsState();
            }
          })
          .catch(function () {
            showNoAttemptsState();
          });
      }
    });

  // Load wallet pearls
  fetch("/api/shop/wallet", { credentials: "same-origin" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && typeof d.pearls !== "undefined") {
        document.getElementById("user-pearls").textContent = d.pearls;
      }
    });

  /* ------------------------------------------------------------------
     Tab Switching
     ------------------------------------------------------------------ */
  function activateTab(tabName) {
    Object.keys(tabs).forEach(function (name) {
      var isTarget = name === tabName;
      tabs[name].classList.toggle("active", isTarget);
      panels[name].hidden = !isTarget;
    });

    if (tabName === "history") {
      loadHistoryTable();
    }
  }

  Object.keys(tabs).forEach(function (name) {
    tabs[name].addEventListener("click", function () {
      activateTab(name);
    });
  });

  function showNoAttemptsState() {
    panels.notes.innerHTML =
      '<div style="text-align: center; padding: 2rem;">' +
      '<img src="/static/images/characters/cutouts/mal-thinking.png" style="height: 140px; margin-bottom: 1rem;">' +
      '<h2 style="color: var(--aq-ocean);">Belum Ada Rekod Kuiz</h2>' +
      '<p style="color: var(--aq-muted); max-width: 48ch; margin: 0 auto 1.5rem;">Selesaikan sekurang-kurangnya satu kuiz pengembaraan dahulu untuk membolehkan Aqua menyediakan nota peribadi dan soalan adaptif!</p>' +
      '<a href="/quiz" class="aq-btn aq-btn--primary" style="text-decoration:none;"><span>Mula Kuiz Sekarang &rarr;</span></a>' +
      '</div>';
    panels.adaptive.innerHTML = panels.notes.innerHTML;
    panels.chat.innerHTML = panels.notes.innerHTML;
  }

  /* ------------------------------------------------------------------
     Structured, kid-friendly notes
     ------------------------------------------------------------------ */
  var CONCEPT_ICONS = ["💡", "🔍", "🧩", "🌟", "🐚", "🧠"];

  function renderNotes(box, content) {
    box.className = "notes-content-box nt-wrap";

    if (!content || typeof content !== "object" || !Array.isArray(content.key_concepts)) {
      box.innerHTML = '<div class="md">' + R.markdown(typeof content === "string" ? content : "Tiada nota tambahan.") + "</div>";
      return;
    }

    var html = "";

    html +=
      '<div class="nt-hero">' +
        '<img class="nt-hero__avatar" src="/static/images/characters/cutouts/fania-happy.png" alt="Aqua">' +
        "<div>" +
          "<h4>" + R.esc(content.title || "Nota Revisi") + "</h4>" +
          '<div class="md">' + R.markdown(content.summary) + "</div>" +
        "</div>" +
      "</div>";

    if (content.key_concepts.length) {
      html += '<h4 class="nt-section-title">🧠 Konsep Penting</h4><div class="nt-grid">';
      content.key_concepts.forEach(function (c, i) {
        html +=
          '<div class="nt-card">' +
            "<h5><span class=\"nt-card__icon\">" + CONCEPT_ICONS[i % CONCEPT_ICONS.length] + "</span>" + R.esc(c.heading) + "</h5>" +
            '<div class="md">' + R.markdown(c.explanation) + "</div>" +
          "</div>";
      });
      html += "</div>";
    }

    var ex = content.worked_example;
    if (ex && Array.isArray(ex.steps) && ex.steps.length) {
      html += '<h4 class="nt-section-title">✏️ Contoh Penyelesaian</h4><div class="nt-example">';
      html += '<p class="nt-example__q">' + R.esc(ex.question) + "</p><ol class=\"nt-steps\">";
      ex.steps.forEach(function (s) { html += "<li>" + R.esc(s) + "</li>"; });
      html += "</ol>";
      if (ex.answer) html += '<span class="nt-answer">Jawapan: ' + R.esc(ex.answer) + "</span>";
      html += "</div>";
    }

    if (Array.isArray(content.revision_tips) && content.revision_tips.length) {
      html += '<h4 class="nt-section-title">🌈 Tip Ulang Kaji</h4><ul class="nt-tips">';
      content.revision_tips.forEach(function (t) { html += "<li><span>" + R.esc(t) + "</span></li>"; });
      html += "</ul>";
    }

    box.innerHTML = html;
  }

  /* ------------------------------------------------------------------
     Load Attempt Data (Notes, Weak Skills, Explanations)
     ------------------------------------------------------------------ */
  function loadAttemptData(attemptId) {
    document.getElementById("active-attempt-title").textContent = "Percubaan Kuiz #" + attemptId;

    // Load Notes
    fetch("/api/learning/notes/" + attemptId, { credentials: "same-origin" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (note) {
        if (!note) {
          document.getElementById("notes-container").innerHTML = "<p>Nota pembelajaran sedang dijana atau belum tersedia untuk percubaan ini.</p>";
          return;
        }

        // Render weak skills
        var skillsBox = document.getElementById("weak-skills-list");
        skillsBox.innerHTML = "";
        var weakSkills = note.weak_skills_json || [];
        if (weakSkills.length === 0) {
          skillsBox.innerHTML = '<span style="color: var(--aq-success); font-weight:700;">Tiada kelemahan ketara dikesan! Anda menguasai topik ini.</span>';
        } else {
          weakSkills.forEach(function (s) {
            var tag = document.createElement("span");
            tag.className = "skill-tag";
            tag.textContent = "🎯 " + R.prettySkill(s);
            skillsBox.appendChild(tag);
          });
        }

        // Render notes content
        renderNotes(document.getElementById("notes-container"), note.notes_json);
      });

    // Load Explanations
    fetch("/api/learning/explanations/" + attemptId, { credentials: "same-origin" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (expData) {
        var box = document.getElementById("explanations-list");
        box.innerHTML = "";
        var list = (expData && expData.explanations) || [];
        if (list.length === 0) {
          box.innerHTML = "<p style='color: var(--aq-muted);'>Tiada penerangan soalan direkodkan.</p>";
          return;
        }

        var rightCount = list.filter(function (e) { return e.is_correct; }).length;
        var summary = document.createElement("div");
        summary.className = "rv-summary";
        summary.innerHTML =
          '<span class="rv-summary__pill rv-summary__pill--right">✅ ' + rightCount + ' betul</span>' +
          '<span class="rv-summary__pill rv-summary__pill--wrong">💪 ' + (list.length - rightCount) + ' perlu disemak</span>';
        box.appendChild(summary);

        list.forEach(function (exp, idx) {
          box.appendChild(R.reviewCard({
            index: idx + 1,
            question: exp.question_text,
            studentAnswer: exp.student_answer,
            correctAnswer: exp.correct_answer,
            isCorrect: !!exp.is_correct,
            explanation: exp.explanation
          }));
        });
      });

    // Load Adaptive Questions if available
    loadAdaptiveQuiz(attemptId);
  }

  /* ------------------------------------------------------------------
     Adaptive Quiz Handler
     ------------------------------------------------------------------ */
  function loadAdaptiveQuiz(attemptId) {
    var adaptiveContainer = document.getElementById("adaptive-questions-box");
    adaptiveContainer.innerHTML =
      '<p style="color: var(--aq-muted);">Menyemak status soalan adaptif untuk percubaan #' + attemptId + '...</p>';

    // Look up attempt in database / quiz submit response
    // For adaptive quiz, we prompt student with the questions if available
    var btnSubmitAdaptive = document.getElementById("btn-submit-adaptive");

    // We can fetch notes/history to check if adaptive already taken
    // Build an interactive adaptive practice box
    adaptiveContainer.innerHTML =
      '<div style="text-align:center; padding: 1.5rem;">' +
      '<img src="/static/images/characters/cutouts/fania-happy.png" style="height:120px; margin-bottom:1rem;">' +
      '<h3 style="color: var(--aq-ocean);">Cabaran Latihan Adaptif Aqua 🐠</h3>' +
      '<p style="color: var(--aq-muted); max-width: 50ch; margin: 0 auto 1.5rem;">' +
      'Latihan adaptif direka khas oleh AI mengikut kemahiran yang perlu diperbaiki. Selesaikan latihan untuk memenangi ikan baharu bagi akuarium anda!' +
      '</p>' +
      '<div id="adaptive-interactive-questions"></div>' +
      '</div>';

    // Render questions if student took the quiz in current session
    // Or allow generating practice
    btnSubmitAdaptive.hidden = false;
    btnSubmitAdaptive.onclick = function () {
      submitAdaptiveAnswers(attemptId);
    };
  }

  function submitAdaptiveAnswers(attemptId) {
    var btn = document.getElementById("btn-submit-adaptive");
    btn.disabled = true;
    btn.textContent = "Menilai jawapan adaptif...";

    // Mock/collected answers
    var payload = {
      attempt_id: attemptId,
      answers: { "1": "360" } // submits string map
    };

    fetch("/api/adaptive/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        btn.disabled = false;
        btn.textContent = "Hantar Latihan Adaptif";

        if (result.error) {
          alert(result.error);
          return;
        }

        // Show confirmed celebration modal!
        showRewardModal(result.reward, result.score);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = "Hantar Latihan Adaptif";
        alert("Tidak dapat menghantar latihan adaptif. Sila cuba sebentar lagi.");
      });
  }

  function showRewardModal(reward, score) {
    if (!reward) return;
    var overlay = document.getElementById("reward-modal");
    var fishImg = document.getElementById("reward-fish-img");
    var fishTitle = document.getElementById("reward-fish-name");
    var pearlsText = document.getElementById("reward-pearls-text");

    fishTitle.textContent = reward.fish_type || "Ikan Tropika";
    fishImg.src = FISH_IMAGES[reward.fish_type] || "/static/images/fish/fish-1.jpg";
    pearlsText.textContent = "+" + (reward.pearls_earned || 20) + " Mutiara Berkilau!";

    overlay.classList.add("active");

    // Close button
    document.getElementById("btn-close-reward").onclick = function () {
      overlay.classList.remove("active");
      window.location.assign("/aquarium");
    };
  }

  /* ------------------------------------------------------------------
     Ask Aqua Chatbot Flow
     ------------------------------------------------------------------ */
  var chatMessagesArea = document.getElementById("chat-messages-area");
  var chatInput = document.getElementById("chat-input");
  var btnChatSend = document.getElementById("btn-chat-send");

  function appendChatMessage(role, text) {
    var msg = document.createElement("div");
    msg.className = "chat-msg chat-msg--" + role;

    var avatarSrc = role === "assistant"
      ? "/static/images/characters/cutouts/fania-happy.png"
      : "/static/images/characters/cutouts/mal-happy.png";

    msg.innerHTML =
      '<div class="chat-avatar"><img src="' + avatarSrc + '" alt="' + role + '"></div>' +
      (role === "assistant"
        ? '<div class="chat-bubble-text md">' + R.markdown(text) + '</div>'
        : '<div class="chat-bubble-text">' + escapeHTML(text) + '</div>');

    chatMessagesArea.appendChild(msg);
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, function (tag) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag);
    });
  }

  function sendChatMessage(text) {
    if (!text || !text.trim() || !currentAttemptId) return;

    var userText = text.trim();
    chatInput.value = "";
    appendChatMessage("user", userText);

    // Typing placeholder
    var typingIndicator = document.createElement("div");
    typingIndicator.className = "chat-msg chat-msg--assistant";
    typingIndicator.id = "chat-typing-indicator";
    typingIndicator.innerHTML =
      '<div class="chat-avatar"><img src="/static/images/characters/cutouts/fania-thinking.png" alt="Aqua thinking"></div>' +
      '<div class="chat-bubble-text"><em>Aqua sedang menaip penerangan... 🫧</em></div>';
    chatMessagesArea.appendChild(typingIndicator);
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;

    var payload = {
      attempt_id: currentAttemptId,
      message: userText,
      history: chatHistory.slice(-8)
    };

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var ind = document.getElementById("chat-typing-indicator");
        if (ind) ind.remove();

        if (data.error) {
          appendChatMessage("assistant", "Maaf, Aqua mengalami sedikit kesukaran: " + data.error);
          return;
        }

        var reply = data.reply;
        appendChatMessage("assistant", reply);

        // Update in-memory session history
        chatHistory.push({ role: "user", content: userText });
        chatHistory.push({ role: "assistant", content: reply });
      })
      .catch(function () {
        var ind = document.getElementById("chat-typing-indicator");
        if (ind) ind.remove();
        appendChatMessage("assistant", "Alamak! Sambungan internet ke lautan terputus. Sila cuba lagi.");
      });
  }

  btnChatSend.addEventListener("click", function () {
    sendChatMessage(chatInput.value);
  });

  chatInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChatMessage(chatInput.value);
    }
  });

  // Prompt chips
  Array.prototype.forEach.call(document.querySelectorAll(".chat-chip"), function (chip) {
    chip.addEventListener("click", function () {
      sendChatMessage(chip.getAttribute("data-prompt"));
    });
  });

  /* ------------------------------------------------------------------
     History Table Flow
     ------------------------------------------------------------------ */
  function loadHistoryTable() {
    var tbody = document.getElementById("history-tbody");
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuatkan sejarah kuiz...</td></tr>';

    fetch("/api/learning/history", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var list = (data && data.history) || [];
        tbody.innerHTML = "";
        if (list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tiada rekod kuiz lagi.</td></tr>';
          return;
        }

        list.forEach(function (row) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            '<td>#' + row.attempt_id + '</td>' +
            '<td><strong>' + row.subject + '</strong> (' + row.topic + ')</td>' +
            '<td><span class="score-pill">' + Math.round(row.score) + '%</span> (' + row.correct_answers + '/' + row.total_questions + ')</td>' +
            '<td>' + (row.created_at ? row.created_at.substring(0, 10) : '-') + '</td>' +
            '<td><button type="button" class="aq-btn aq-btn--primary" style="min-height:36px; padding:0.3rem 0.8rem; font-size:0.85rem;" data-attempt="' + row.attempt_id + '">Buka Percubaan</button></td>';

          tr.querySelector("button").addEventListener("click", function () {
            currentAttemptId = row.attempt_id;
            activateTab("notes");
            loadAttemptData(currentAttemptId);
          });

          tbody.appendChild(tr);
        });
      });
  }
})();
