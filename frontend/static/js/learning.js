/* ==========================================================================
   Aquademia Learning, Adaptive Practice & Ask Aqua Controller
   ========================================================================== */
(function () {
  "use strict";

  // Safe fallback: if aq-render.js did not load, still show a plain (unstyled-markdown) page
  var R = window.AqRender || (function () {
    if (window.console) console.warn("aq-render.js tidak dimuatkan. Pastikan fail static/js/aq-render.js wujud.");
    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>'"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c];
      });
    }
    return {
      esc: esc,
      markdown: function (t) { return "<p>" + esc(t).replace(/\n/g, "<br>") + "</p>"; },
      prettySkill: function (s) { return String(s == null ? "" : s).replace(/_/g, " "); },
      reviewCard: function (o) {
        var d = document.createElement("div");
        d.className = "review-item " + (o.isCorrect ? "correct" : "incorrect");
        d.innerHTML =
          '<div class="review-q-title">Soalan ' + esc(o.index) + ": " + (o.isCorrect ? "Betul" : "Salah") + "</div>" +
          '<div class="review-ans">Jawapan anda: <strong>' + esc(o.studentAnswer) + "</strong>" +
          (o.isCorrect ? "" : " | Jawapan betul: <strong>" + esc(o.correctAnswer) + "</strong>") + "</div>" +
          (o.explanation ? '<div class="review-exp">' + esc(o.explanation) + "</div>" : "");
        return d;
      }
    };
  })();

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
      if (d && typeof d.available_pearls !== "undefined") {
        document.getElementById("user-pearls").textContent = d.available_pearls;
      }
    });

  /* ------------------------------------------------------------------
     Tab Switching
     ------------------------------------------------------------------ */
  function activateTab(tabName) {
    Object.keys(tabs).forEach(function (name) {
      var isTarget = name === tabName;
      tabs[name].classList.toggle("active", isTarget);
      tabs[name].setAttribute("aria-selected", String(isTarget));
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
        if (!Array.isArray(weakSkills)) {
          weakSkills = typeof weakSkills === "object" ? Object.keys(weakSkills) : [];
        }
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
      })
      .catch(function (error) {
        console.error("Tidak dapat memuatkan nota revisi:", error);
        document.getElementById("notes-container").innerHTML =
          "<p>Nota revisi tidak dapat dimuatkan. Sila muat semula halaman dan cuba lagi.</p>";
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

    Promise.all([
      fetch("/api/adaptive/" + attemptId, { credentials: "same-origin" }),
      fetch("/api/adaptive/" + attemptId + "/history", { credentials: "same-origin" })
    ])
      .then(function (responses) {
        return Promise.all(responses.map(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || "Gagal memuatkan latihan.");
            return data;
          });
        }));
      })
      .then(function (results) {
        var questions = (results[0] && results[0].questions) || [];
        var history = (results[1] && results[1].history) || [];
        if (!questions.length) {
          adaptiveContainer.innerHTML =
            '<div class="adaptive-empty-state">' +
            '<span aria-hidden="true">🫧</span>' +
            '<h3>Belum ada kemahiran untuk dilatih</h3>' +
            '<p>Untuk kuiz ini, anda belum tersilap jawapan. Cuba latihan daripada kuiz yang ada jawapan salah supaya Aqua boleh fokus pada topik yang perlu dikuatkan.</p>' +
            '</div>';
          return;
        }

        adaptiveContainer.innerHTML =
          '<div class="adaptive-quiz-intro">' +
          '<div class="adaptive-quiz-mascot"><img src="/static/images/characters/cutouts/fania-happy.png" alt="Aqua"></div>' +
          '<div class="adaptive-quiz-intro-copy">' +
          '<span class="adaptive-quiz-kicker">CABARAN KHAS UNTUK ANDA</span>' +
          '<h3>Jawab satu demi satu bersama Aqua 🐠</h3>' +
          '<p>Semak jawapan sekarang, kemudian cuba soalan baharu.</p>' +
          '</div>' +
          '<div class="adaptive-quiz-count"><strong id="adaptive-question-count">' + history.length + '</strong><span>dijawab</span></div>' +
          '</div>' +
          '<div id="adaptive-current-question"></div>' +
          '<details class="adaptive-history" id="adaptive-history">' +
          '<summary>📚 Sejarah jawapan <span id="adaptive-history-count"></span></summary>' +
          '<div class="adaptive-history-list" id="adaptive-history-list"></div>' +
          '</details>';

        var currentBox = document.getElementById("adaptive-current-question");
        var historyList = document.getElementById("adaptive-history-list");
        var historyIds = {};
        history.forEach(function (item) { historyIds[String(item.adaptive_id)] = true; });

        function renderHistoryEntry(item, index, prepend) {
          var entry = document.createElement("article");
          entry.className = "adaptive-history-entry " + (item.is_correct ? "is-correct" : "is-incorrect");
          var title = document.createElement("h4");
          title.textContent = (item.is_correct ? "✅ Betul" : "💪 Perlu cuba lagi") + " · Soalan " + (index + 1);
          var questionText = document.createElement("p");
          questionText.className = "adaptive-history-question";
          questionText.textContent = item.question;
          var answerText = document.createElement("p");
          answerText.textContent = "Jawapan anda: " + item.selected_answer;
          var correctText = document.createElement("p");
          correctText.textContent = "Jawapan betul: " + item.correct_answer;
          var explanation = document.createElement("p");
          explanation.textContent = item.explanation || "Semak semula konsep topik ini dalam nota.";
          entry.appendChild(title);
          entry.appendChild(questionText);
          entry.appendChild(answerText);
          if (!item.is_correct) entry.appendChild(correctText);
          entry.appendChild(explanation);
          if (prepend && historyList.firstChild) historyList.insertBefore(entry, historyList.firstChild);
          else historyList.appendChild(entry);
        }

        function updateHistoryCount() {
          document.getElementById("adaptive-question-count").textContent = history.length;
          document.getElementById("adaptive-history-count").textContent =
            history.length ? "(" + history.length + ")" : "";
        }

        history.forEach(function (item, index) {
          renderHistoryEntry(item, history.length - index, false);
        });
        updateHistoryCount();

        function showQuestion(question) {
          currentBox.innerHTML =
            '<div class="adaptive-question-card">' +
            '<div class="adaptive-question-topline"><span class="adaptive-question-number">' +
            (history.length + 1) + '</span><span>Soalan baharu</span></div>' +
            '<h4 class="adaptive-question-prompt"></h4>' +
            '<div class="adaptive-option-list"></div>' +
            '<div class="adaptive-feedback" id="adaptive-feedback" hidden></div>' +
            '<div class="adaptive-question-actions">' +
            '<button type="button" class="aq-btn aq-btn--primary" id="btn-check-answer">Semak Jawapan</button>' +
            '<button type="button" class="aq-btn aq-btn--coral" id="btn-next-question" hidden>Soalan seterusnya ➜</button>' +
            '<p class="adaptive-answer-status" id="adaptive-answer-status" role="status" aria-live="polite"></p>' +
            '</div></div>';

          var card = currentBox.querySelector(".adaptive-question-card");
          card.querySelector(".adaptive-question-prompt").textContent = question.question;
          var optionsBox = card.querySelector(".adaptive-option-list");
          (question.options || []).forEach(function (option, index) {
            var label = document.createElement("label");
            label.className = "adaptive-option";
            var input = document.createElement("input");
            input.type = "radio";
            input.name = "adaptive-answer-current";
            input.value = option;
            var letter = document.createElement("span");
            letter.className = "adaptive-option-letter";
            letter.textContent = String.fromCharCode(65 + index);
            var text = document.createElement("span");
            text.className = "adaptive-option-text";
            text.textContent = option;
            label.appendChild(input);
            label.appendChild(letter);
            label.appendChild(text);
            optionsBox.appendChild(label);
          });

          card.querySelector("#btn-check-answer").addEventListener("click", function () {
            var selected = card.querySelector('input[name="adaptive-answer-current"]:checked');
            var status = card.querySelector("#adaptive-answer-status");
            if (!selected) {
              status.textContent = "Pilih satu jawapan dahulu ya!";
              return;
            }
            var checkButton = card.querySelector("#btn-check-answer");
            checkButton.disabled = true;
            checkButton.textContent = "Aqua sedang menyemak...";
            fetch("/api/adaptive/" + attemptId + "/answer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ adaptive_id: question.id, answer: selected.value })
            })
              .then(function (res) {
                return res.json().then(function (result) {
                  if (!res.ok) throw new Error(result.error || "Jawapan tidak dapat disimpan.");
                  return result;
                });
              })
              .then(function (result) {
                card.querySelectorAll("input").forEach(function (input) { input.disabled = true; });
                var feedback = card.querySelector("#adaptive-feedback");
                feedback.hidden = false;
                feedback.className = "adaptive-feedback " + (result.is_correct ? "is-correct" : "is-incorrect");
                var heading = document.createElement("strong");
                heading.textContent = result.is_correct ? "Betul! Syabas! 🎉" : "Belum tepat, tak apa—jom belajar! 🌱";
                var answer = document.createElement("p");
                answer.textContent = "Jawapan yang betul: " + result.correct_answer;
                var explanation = document.createElement("p");
                explanation.textContent = result.explanation || "Baca nota topik untuk faham cara mendapat jawapan ini.";
                feedback.appendChild(heading);
                if (!result.is_correct) feedback.appendChild(answer);
                feedback.appendChild(explanation);

                result.adaptive_id = question.id;
                history.unshift(result);
                historyIds[String(question.id)] = true;
                renderHistoryEntry(result, history.length, true);
                updateHistoryCount();
                checkButton.hidden = true;
                card.querySelector("#btn-next-question").hidden = false;
              })
              .catch(function (error) {
                checkButton.disabled = false;
                checkButton.textContent = "Semak Jawapan";
                status.textContent = error.message;
              });
          });

          card.querySelector("#btn-next-question").addEventListener("click", function () {
            var nextButton = card.querySelector("#btn-next-question");
            nextButton.disabled = true;
            nextButton.textContent = "Aqua sedang cipta soalan... 🫧";
            fetch("/api/adaptive/" + attemptId + "/more", {
              method: "POST",
              credentials: "same-origin"
            })
              .then(function (res) {
                return res.json().then(function (result) {
                  if (!res.ok) throw new Error(result.error || "Soalan baharu tidak dapat dijana.");
                  return result;
                });
              })
              .then(function (result) {
                var nextQuestion = (result.questions || [])[0];
                if (!nextQuestion) throw new Error("Aqua belum menghasilkan soalan. Cuba lagi.");
                questions.push(nextQuestion);
                showQuestion(nextQuestion);
                currentBox.scrollIntoView({ behavior: "smooth", block: "start" });
              })
              .catch(function (error) {
                nextButton.disabled = false;
                nextButton.textContent = "Cuba jana lagi";
                card.querySelector("#adaptive-answer-status").textContent = error.message;
              });
          });
        }

        var nextQuestion = questions.find(function (question) {
          return !historyIds[String(question.id)];
        });
        if (nextQuestion) {
          showQuestion(nextQuestion);
        } else {
          document.getElementById("adaptive-current-question").innerHTML =
            '<div class="adaptive-empty-state"><span aria-hidden="true">🌟</span>' +
            '<h3>Hebat! Semua soalan sudah dijawab.</h3>' +
            '<p>Jana soalan baharu bila-bila masa untuk terus berlatih.</p>' +
            '<button type="button" class="aq-btn aq-btn--primary" id="btn-next-question">Jana soalan baharu</button></div>';
          document.getElementById("btn-next-question").addEventListener("click", function () {
            var nextButton = this;
            nextButton.disabled = true;
            nextButton.textContent = "Aqua sedang cipta soalan... 🫧";
            fetch("/api/adaptive/" + attemptId + "/more", {
              method: "POST",
              credentials: "same-origin"
            })
              .then(function (res) {
                return res.json().then(function (result) {
                  if (!res.ok) throw new Error(result.error || "Soalan baharu tidak dapat dijana.");
                  return result;
                });
              })
              .then(function (result) {
                var nextQuestion = (result.questions || [])[0];
                if (!nextQuestion) throw new Error("Aqua belum menghasilkan soalan. Cuba lagi.");
                questions.push(nextQuestion);
                showQuestion(nextQuestion);
                currentBox.scrollIntoView({ behavior: "smooth", block: "start" });
              })
              .catch(function (error) {
                nextButton.disabled = false;
                nextButton.textContent = "Cuba jana lagi";
                var message = document.createElement("p");
                message.className = "adaptive-answer-status";
                message.textContent = error.message;
                nextButton.parentNode.appendChild(message);
              });
          });
        }
      })
      .catch(function (error) {
        console.error("Tidak dapat memuatkan latihan adaptif:", error);
        adaptiveContainer.innerHTML =
          '<div class="adaptive-empty-state">' +
          '<span aria-hidden="true">🐠</span>' +
          '<h3>Aqua belum dapat sediakan latihan</h3>' +
          '<p>Cuba lagi sebentar. Jika masih gagal, semak sambungan AI pada tetapan pelayan.</p>' +
          '<button type="button" class="aq-btn aq-btn--primary" id="btn-retry-adaptive">Cuba Lagi</button>' +
          '</div>';
        document.getElementById("btn-retry-adaptive").addEventListener("click", function () {
          loadAdaptiveQuiz(attemptId);
        });
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