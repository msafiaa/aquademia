/* ==========================================================================
   Aquademia Quiz Controller
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
  var viewSelector = document.getElementById("view-selector");
  var viewQuiz = document.getElementById("view-quiz");
  var viewResults = document.getElementById("view-results");
  var viewEmpty = document.getElementById("view-empty");

  // Selection controls
  var tabMath = document.getElementById("tab-math");
  var tabScience = document.getElementById("tab-science");
  var topicsContainer = document.getElementById("topics-container");
  var btnStartQuiz = document.getElementById("btn-start-quiz");
  var hostSay = document.getElementById("host-say");
  var adaptCard = document.getElementById("adapt-card");
  var adaptSub = document.getElementById("adapt-sub");
  var progWrap = document.getElementById("topic-progress");
  var progText = document.getElementById("prog-text");
  var progFill = document.getElementById("prog-fill");

  // Quiz player controls
  var quizCategoryTitle = document.getElementById("quiz-category-title");
  var quizProgressFill = document.getElementById("quiz-progress-fill");
  var quizQuestionBadge = document.getElementById("quiz-question-badge");
  var quizQuestionText = document.getElementById("quiz-question-text");
  var quizImageBox = document.getElementById("quiz-image-box");
  var quizImage = document.getElementById("quiz-image");
  var quizOptionsList = document.getElementById("quiz-options-list");
  var btnPrevQuestion = document.getElementById("btn-prev-question");
  var btnNextQuestion = document.getElementById("btn-next-question");
  var btnSubmitQuiz = document.getElementById("btn-submit-quiz");

  // State
  var currentStudent = null;
  var currentSubject = "Mathematics";
  var currentTopic = "Addition";
  var questions = [];
  var currentIndex = 0;
  var studentAnswers = {}; // { question_id: selected_option }
  var completedResult = null;
  var historyList = null; // null = not loaded (no stars/progress shown)
  var lastList = [];      // topics currently drawn

  // Preset topics for Year 4-6
  var TOPICS = {
    "Mathematics": [
      { name: "Addition", label: "Operasi Tambah", desc: "Penambahan nombor bulat hingga 100,000" },
      { name: "Subtraction", label: "Operasi Tolak", desc: "Penolakan nombor bulat dan masalah harian" },
      { name: "Multiplication", label: "Operasi Darab", desc: "Pendaraban nombor sehingga 3 digit" },
      { name: "Division", label: "Operasi Bahagi", desc: "Pembahagian nombor dengan baki & tanpa baki" },
      { name: "Fractions", label: "Pecahan", desc: "Pecahan wajar, tak wajar dan nombor bercampur" }
    ],
    "Science": [
      { name: "Living Things", label: "Alam Hidupan", desc: "Kemandirian spesies haiwan dan tumbuhan" },
      { name: "Forces", label: "Daya & Geseran", desc: "Kesan daya tarikan dan tolakan" },
      { name: "Energy", label: "Bentuk Tenaga", desc: "Sumber tenaga boleh baharu dan tidak boleh baharu" },
      { name: "Matter", label: "Keadaan Jirim", desc: "Pepejal, cecair dan gas di persekitaran laut" }
    ]
  };

  /* ------------------------------------------------------------------
     Initialization & Student session
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

      // Check URL search parameters (e.g. ?subject=Science)
      var params = new URLSearchParams(window.location.search);
      var sub = params.get("subject");
      if (sub && (sub === "Mathematics" || sub === "Science")) {
        setSubject(sub);
      } else {
        setSubject("Mathematics");
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

  // Past attempts -> stars, topic progress and the adaptive card.
  // Uses the existing read-only /api/learning/history route.
  fetch("/api/learning/history", { credentials: "same-origin" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !Array.isArray(d.history)) return;
      historyList = d.history;
      if (lastList.length) { drawTopicCards(lastList); } else { updateAdaptive(); }
    })
    .catch(function () { /* stars and adaptive card simply stay hidden */ });

  /* ------------------------------------------------------------------
     Subject & Topic Selection
     ------------------------------------------------------------------ */
  function setSubject(sub) {
    currentSubject = sub;
    tabMath.classList.toggle("active", sub === "Mathematics");
    tabScience.classList.toggle("active", sub === "Science");
    tabMath.setAttribute("aria-pressed", String(sub === "Mathematics"));
    tabScience.setAttribute("aria-pressed", String(sub === "Science"));
    say(sub === "Mathematics" ? "Masuk Gua Nombor! Pilih satu topik." : "Masuk Gua Penyelidik! Apa nak kaji hari ni?");
    renderTopicCards();
  }

  tabMath.addEventListener("click", function () { setSubject("Mathematics"); });
  tabScience.addEventListener("click", function () { setSubject("Science"); });

  var topicRequestId = 0;

  function renderTopicCards() {
    topicRequestId++; // cancels any topic request still in flight
    lastList = [];

    if (currentSubject === "Science") {
      loadScienceTopics();
      return;
    }

    drawTopicCards((TOPICS[currentSubject] || []).map(function (t) {
      return { name: t.name, label: t.label, desc: t.desc };
    }));
  }

  // Science topics come from the questions table, for this student's year
  function loadScienceTopics() {
    var reqId = topicRequestId;
    var year = (currentStudent && currentStudent.year_level) || 4;

    currentTopic = null;
    btnStartQuiz.disabled = true;
    progWrap.hidden = true;
    adaptCard.hidden = true;
    topicsContainer.innerHTML = '<p class="topics-status">Menyelam mencari topik...</p>';

    fetch("/api/topics?subject=Science&year=" + encodeURIComponent(year), { credentials: "same-origin" })
      .then(function (res) { return res.ok ? res.json() : []; })
      .catch(function () { return []; })
      .then(function (list) {
        if (reqId !== topicRequestId) return; // user switched tab meanwhile

        if (!Array.isArray(list) || list.length === 0) {
          topicsContainer.innerHTML =
            '<p class="topics-status">Belum ada topik Sains untuk Tahun ' + year + '.</p>';
          return;
        }

        drawTopicCards(list.map(function (t) {
          return { name: t.topic, label: t.topic, desc: t.count + " soalan" };
        }));
      });
  }

  /* ------------------------------------------------------------------
     Topic cards: colours, icons, stars
     ------------------------------------------------------------------ */
  var PALETTE = [
    ["#d4532f", "#9c3a1f"], ["#0d8aa6", "#095f73"], ["#7b4fd1", "#55329b"], ["#1e9a78", "#13694f"],
    ["#d6407f", "#9b2a59"], ["#2f7fd1", "#1e5594"], ["#b9740a", "#80500a"]
  ];
  // Icons follow the topic's meaning (not random sea creatures)
  var MATH_ICONS = { Addition: "\u2795", Subtraction: "\u2796", Multiplication: "\u2716\uFE0F", Division: "\u2797", Fractions: "\uD83C\uDF55" };
  // Exact icons per topic name (lower-case). Edit here to change an icon.
  var SCI_EXACT = {
    "kemahiran saintifik": "\uD83E\uDDEA",
    "manusia": "\uD83E\uDDCD",
    "mikroorganisma": "\uD83E\uDDA0",
    "interaksi antara hidupan": "\uD83D\uDC1D",
    "pemeliharaan dan pemulihan": "\uD83C\uDF33",
    "daya": "\uD83D\uDCAA",
    "kelajuan": "\uD83C\uDFCE\uFE0F",
    "teknologi pengawetan makanan": "\uD83E\uDD6B",
    "bahan buangan": "\uD83D\uDDD1\uFE0F",
    "gerhana": "\uD83C\uDF11",
    "galaksi": "\uD83C\uDF0C",
    "kestabilan dan kekuatan": "\uD83C\uDFD7\uFE0F",
    "teknologi": "\uD83E\uDD16",
    // Year 4 and Year 5 topics
    "haiwan": "\uD83D\uDC18",
    "tumbuh-tumbuhan": "\uD83C\uDF31",
    "elektrik": "\uD83D\uDCA1",
    "haba": "\uD83D\uDD25",
    "pengaratan": "\uD83D\uDD29",
    "jirim": "\uD83E\uDDCA",
    "fasa bulan dan buruj": "\uD83C\uDF19",
    "mesin": "\u2699\uFE0F",
    "sifat cahaya": "\uD83D\uDD26",
    "bunyi": "\uD83D\uDD0A",
    "tenaga": "\u26A1",
    "bahan": "\uD83E\uDDF1",
    "bumi": "\uD83C\uDF0D"
  };
  var SCI_ICONS = [
    [/plant|tumbuh|botani/i, "\uD83C\uDF31"],
    [/living|hidup|survival|kemandirian|adapt|penyesuaian/i, "\uD83C\uDF3F"],
    [/animal|haiwan|vertebr|invertebr/i, "\uD83D\uDC3E"],
    [/human|manusia|body|badan/i, "\uD83E\uDDB4"],
    [/sense|deria/i, "\uD83D\uDC40"], [/micro|mikro|bacteria|kuman/i, "\uD83E\uDDA0"],
    [/force|daya|geseran|friction|motion|gerak/i, "\uD83D\uDE80"],
    [/energy|tenaga|electric|elektrik/i, "\u26A1"],
    [/matter|jirim|state|keadaan|solid|pepejal|material|bahan/i, "\uD83E\uDDCA"],
    [/water|air\b|cecair|liquid/i, "\uD83D\uDCA7"],
    [/light|cahaya|shadow|bayang/i, "\uD83D\uDD26"], [/sound|bunyi|getaran/i, "\uD83D\uDD14"],
    [/heat|haba|temperature|suhu/i, "\uD83C\uDF21\uFE0F"], [/magnet/i, "\uD83E\uDDF2"],
    [/earth|bumi|space|angkasa|planet|solar/i, "\uD83E\uDE90"], [/weather|cuaca|climate|iklim/i, "\u26C5"],
    [/soil|tanah|rock|batu/i, "\uD83E\uDEA8"], [/food|makanan|nutri|pemakanan/i, "\uD83C\uDF4E"],
    [/machine|mesin|tuas|lever/i, "\u2699\uFE0F"], [/environment|alam sekitar|pencemaran|pollut/i, "\uD83C\uDF0D"]
  ];

  function iconFor(name) {
    if (MATH_ICONS[name]) return MATH_ICONS[name];
    var key = String(name || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*-\s*/g, "-");
    if (currentSubject === "Science" && SCI_EXACT[key]) return SCI_EXACT[key];
    for (var i = 0; i < SCI_ICONS.length; i++) {
      if (SCI_ICONS[i][0].test(name)) return SCI_ICONS[i][1];
    }
    // Neutral subject icon when a topic name is not recognised
    return currentSubject === "Science" ? "\uD83D\uDD2C" : "\uD83D\uDD22";
  }

  // 0 = not tried yet, 1-3 = best score so far (>=90 -> 3, >=70 -> 2, else 1), -1 = unknown
  function starsFor(name) {
    if (!historyList) return -1;
    var year = (currentStudent && currentStudent.year_level) || 4;
    var best = -1;
    historyList.forEach(function (a) {
      if (a.subject === currentSubject && a.topic === name && Number(a.year_level) === Number(year)) {
        best = Math.max(best, Number(a.score));
      }
    });
    if (best < 0) return 0;
    return best >= 90 ? 3 : best >= 70 ? 2 : 1;
  }

  function say(text) { if (hostSay) hostSay.textContent = text; }

  function labelFor(topic) {
    for (var i = 0; i < lastList.length; i++) { if (lastList[i].name === topic) return lastList[i].label; }
    return topic;
  }

  function updateAdaptive() {
    if (!adaptCard) return;
    if (historyList === null) { adaptCard.hidden = true; return; }

    var latest = null;
    for (var i = 0; i < historyList.length; i++) {   // history is newest first
      if (historyList[i].subject === currentSubject) { latest = historyList[i]; break; }
    }
    adaptCard.hidden = false;

    if (!latest) {
      adaptCard.disabled = true;
      adaptSub.textContent = "Buat satu kuiz dulu. Lepas tu latihan khas untuk kau akan siap.";
      adaptCard.onclick = null;
      return;
    }
    adaptCard.disabled = false;
    adaptSub.textContent = "Latihan khas berdasarkan kuiz terakhir kau: " + labelFor(latest.topic);
    adaptCard.onclick = function () {
      window.location.assign("/learning?attempt_id=" + encodeURIComponent(latest.attempt_id) + "&tab=adaptive");
    };
  }

  function drawTopicCards(list) {
    lastList = list;
    topicsContainer.innerHTML = "";
    if (!list.length) { btnStartQuiz.disabled = true; progWrap.hidden = true; updateAdaptive(); return; }

    btnStartQuiz.disabled = false;
    var stillThere = list.some(function (t) { return t.name === currentTopic; });
    if (!stillThere) currentTopic = list[0].name;

    var done = 0;
    list.forEach(function (t, idx) {
      var stars = starsFor(t.name);
      if (stars > 0) done++;
      var pal = PALETTE[idx % PALETTE.length];

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tcard" + (t.name === currentTopic ? " selected" : "");
      btn.style.setProperty("--c", pal[0]);
      btn.style.setProperty("--cd", pal[1]);
      btn.setAttribute("aria-pressed", t.name === currentTopic ? "true" : "false");

      var ico = document.createElement("span");
      ico.className = "tcard__ico";
      ico.setAttribute("aria-hidden", "true");
      ico.textContent = iconFor(t.name, idx);

      var name = document.createElement("span");
      name.className = "tcard__name";
      name.textContent = t.label;

      var desc = document.createElement("span");
      desc.className = "tcard__desc";
      desc.textContent = t.desc;

      btn.appendChild(ico);
      btn.appendChild(name);
      btn.appendChild(desc);

      if (stars >= 0) {
        var st = document.createElement("span");
        st.className = "tcard__stars";
        st.setAttribute("aria-label", stars + " daripada 3 bintang");
        for (var k = 0; k < 3; k++) {
          var star = document.createElement("span");
          star.textContent = "\u2B50";
          if (k >= stars) star.className = "off";
          st.appendChild(star);
        }
        btn.appendChild(st);
      }

      function hint() {
        if (stars === 0) say("Topik " + t.label + " belum dicuba. Jom!");
        else if (stars > 0 && stars < 3) say(t.label + ": kau dah ada " + stars + " bintang. Boleh dapat 3!");
        else if (stars === 3) say(t.label + ": 3 bintang! Hebat, kau memang jaguh!");
        else say("Jom selam topik " + t.label + "!");
      }
      btn.addEventListener("mouseenter", hint);
      btn.addEventListener("focus", hint);
      btn.addEventListener("click", function () {
        Array.prototype.forEach.call(topicsContainer.children, function (c) {
          c.classList.remove("selected");
          c.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("selected");
        btn.setAttribute("aria-pressed", "true");
        currentTopic = t.name;
        hint();
      });
      topicsContainer.appendChild(btn);
    });

    if (historyList) {
      progWrap.hidden = false;
      progText.textContent = done + "/" + list.length + " topik selesai";
      progFill.style.width = Math.round((done / list.length) * 100) + "%";
    } else {
      progWrap.hidden = true;
    }
    updateAdaptive();
  }

  // Small bubble burst when the dive starts (skipped for reduced motion)
  function burst(el) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var r = el.getBoundingClientRect();
    for (var i = 0; i < 12; i++) {
      var b = document.createElement("i");
      var size = 12 + Math.random() * 24;
      b.className = "burst";
      b.style.width = b.style.height = size + "px";
      b.style.left = (r.left + Math.random() * r.width) + "px";
      b.style.top = (r.top + r.height / 2) + "px";
      b.style.setProperty("--x", (Math.random() * 120 - 60) + "px");
      b.style.setProperty("--y", (-80 - Math.random() * 140) + "px");
      document.body.appendChild(b);
      setTimeout(function (n) { return function () { n.remove(); }; }(b), 1000);
    }
  }

  btnStartQuiz.addEventListener("click", function () {
    if (!currentTopic) return;
    burst(btnStartQuiz);
    loadQuestions();
  });

  /* ------------------------------------------------------------------
     Load Questions from Backend
     ------------------------------------------------------------------ */
  function loadQuestions() {
    var year = (currentStudent && currentStudent.year_level) || 4;
    var url = "/api/questions?year=" + encodeURIComponent(year) +
              "&subject=" + encodeURIComponent(currentSubject) +
              "&topic=" + encodeURIComponent(currentTopic);

    btnStartQuiz.disabled = true;
    btnStartQuiz.textContent = "Menyelam mencari soalan...";

    fetch(url, { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        btnStartQuiz.disabled = false;
        btnStartQuiz.textContent = "Mula Menyelam! \uD83E\uDEE7";

        if (!Array.isArray(data) || data.length === 0) {
          showEmptyState();
          return;
        }

        questions = data;
        currentIndex = 0;
        studentAnswers = {};
        startQuizSession();
      })
      .catch(function () {
        btnStartQuiz.disabled = false;
        btnStartQuiz.textContent = "Mula Menyelam! \uD83E\uDEE7";
        showEmptyState();
      });
  }

  function showEmptyState() {
    viewSelector.hidden = true;
    viewQuiz.hidden = true;
    viewResults.hidden = true;
    viewEmpty.hidden = false;
    document.getElementById("empty-topic-name").textContent = currentSubject + " - " + currentTopic;
  }

  document.getElementById("btn-back-to-topics").addEventListener("click", function () {
    viewEmpty.hidden = true;
    viewSelector.hidden = false;
  });

  /* ------------------------------------------------------------------
     Quiz Player Flow
     ------------------------------------------------------------------ */
  function startQuizSession() {
    viewSelector.hidden = true;
    viewEmpty.hidden = true;
    viewResults.hidden = true;
    viewQuiz.hidden = false;

    quizCategoryTitle.textContent = currentSubject + " : " + currentTopic;
    renderCurrentQuestion();
  }

  function renderCurrentQuestion() {
    var q = questions[currentIndex];
    var total = questions.length;

    // Progress bar
    var pct = Math.round(((currentIndex + 1) / total) * 100);
    quizProgressFill.style.width = pct + "%";
    quizQuestionBadge.textContent = "Soalan " + (currentIndex + 1) + " daripada " + total;
    quizQuestionText.textContent = q.question;

    // Image support
    if (q.image_path) {
      quizImage.src = q.image_path;
      quizImageBox.hidden = false;
    } else {
      quizImageBox.hidden = true;
    }

    // Options
    quizOptionsList.innerHTML = "";
    var letters = ["A", "B", "C", "D"];
    var currentAnswer = studentAnswers[String(q.id)];

    q.options.forEach(function (opt, idx) {
      var item = document.createElement("div");
      item.className = "option-choice" + (currentAnswer === opt ? " selected" : "");
      item.innerHTML =
        '<span class="option-letter">' + (letters[idx] || (idx + 1)) + '</span>' +
        '<span class="option-text">' + opt + '</span>';

      item.addEventListener("click", function () {
        studentAnswers[String(q.id)] = opt;
        Array.prototype.forEach.call(quizOptionsList.children, function (c) { c.classList.remove("selected"); });
        item.classList.add("selected");
      });

      quizOptionsList.appendChild(item);
    });

    // Navigation buttons
    btnPrevQuestion.disabled = currentIndex === 0;
    if (currentIndex === total - 1) {
      btnNextQuestion.hidden = true;
      btnSubmitQuiz.hidden = false;
    } else {
      btnNextQuestion.hidden = false;
      btnSubmitQuiz.hidden = true;
    }
  }

  btnPrevQuestion.addEventListener("click", function () {
    if (currentIndex > 0) {
      currentIndex--;
      renderCurrentQuestion();
    }
  });

  btnNextQuestion.addEventListener("click", function () {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      renderCurrentQuestion();
    }
  });

  /* ------------------------------------------------------------------
     Quiz Submission
     ------------------------------------------------------------------ */
  btnSubmitQuiz.addEventListener("click", function () {
    // Check if any question remains unanswered
    var unanswered = 0;
    questions.forEach(function (q) {
      if (!studentAnswers[String(q.id)]) unanswered++;
    });

    if (unanswered > 0) {
      var ok = confirm("Anda mempunyai " + unanswered + " soalan yang belum dijawab. Adakah anda pasti mahu menghantar kuiz sekarang?");
      if (!ok) return;
    }

    btnSubmitQuiz.disabled = true;
    btnSubmitQuiz.textContent = "Menghantar kuiz...";

    var year = (currentStudent && currentStudent.year_level) || 4;
    var payload = {
      year: year,
      subject: currentSubject,
      topic: currentTopic,
      answers: studentAnswers
    };

    fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        btnSubmitQuiz.disabled = false;
        btnSubmitQuiz.textContent = "Hantar Kuiz!";

        if (result.error) {
          alert("Ralat menghantar kuiz: " + result.error);
          return;
        }

        completedResult = result;
        // Save latest attempt ID for Ask Aqua and Learning page
        sessionStorage.setItem("latest_attempt_id", result.attempt_id);

        // The quiz IS saved at this point. If only the results screen fails to draw,
        // do not claim the server was unreachable - send the student to their notes.
        try {
          renderResults(result);
        } catch (renderErr) {
          if (window.console) console.error("Gagal memaparkan keputusan:", renderErr);
          window.location.assign("/learning?attempt_id=" + result.attempt_id + "&tab=notes");
        }
      })
      .catch(function (err) {
        if (window.console) console.error("Ralat hantar kuiz:", err);
        btnSubmitQuiz.disabled = false;
        btnSubmitQuiz.textContent = "Hantar Kuiz!";
        alert("Tidak dapat menghubungi pelayan kuiz. Sila cuba lagi!");
      });
  });

  /* ------------------------------------------------------------------
     Render Results
     ------------------------------------------------------------------ */
  function renderResults(result) {
    viewQuiz.hidden = true;
    viewResults.hidden = false;

    var score = Math.round(result.score || 0);
    document.getElementById("res-score-number").textContent = score + "%";
    document.getElementById("res-correct-count").textContent = result.correct_answers + " daripada " + result.total_questions + " betul";
    var rewardMessage = document.getElementById("res-reward-message");
    if (result.reward) {
      rewardMessage.textContent =
        "Tahniah! Anda mendapat " + result.reward.fish_type + " dan " +
        result.reward.pearls_earned + " mutiara.";
      rewardMessage.hidden = false;
      fetch("/api/shop/wallet", { credentials: "same-origin" })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (wallet) {
          if (wallet && typeof wallet.available_pearls !== "undefined") {
            document.getElementById("user-pearls").textContent = wallet.available_pearls;
          }
        });
    } else {
      rewardMessage.hidden = true;
    }

    // Mascot emotion & greeting
    var mascotImg = document.getElementById("res-mascot-img");
    var mascotMsg = document.getElementById("res-mascot-msg");

    if (score >= 80) {
      mascotImg.src = "/static/images/characters/cutouts/mal-happy.png";
      mascotMsg.textContent = "Luar biasa! Pengembaraan lautan anda sangat cemerlang!";
    } else if (score >= 50) {
      mascotImg.src = "/static/images/characters/cutouts/fania-happy.png";
      mascotMsg.textContent = "Bagus sekali! Sedikit lagi latihan dan anda akan menjadi pakar!";
    } else {
      mascotImg.src = "/static/images/characters/cutouts/mal-thinking.png";
      mascotMsg.textContent = "Jangan risau! Lautan penuh dengan peluang belajar. Jom semak nota!";
    }

    // Question breakdown
    var breakdownContainer = document.getElementById("res-breakdown-list");
    breakdownContainer.innerHTML = "";

    if (Array.isArray(result.question_results)) {
      result.question_results.forEach(function (q, idx) {
        breakdownContainer.appendChild(R.reviewCard({
          index: idx + 1,
          question: q.question,
          studentAnswer: q.student_answer,
          correctAnswer: q.correct_answer,
          isCorrect: !!q.is_correct,
          explanation: q.explanation
        }));
      });
    }

    // Adaptive Quiz button state
    var btnAdaptive = document.getElementById("btn-goto-adaptive");
    if (
      result.weak_skills &&
      Object.keys(result.weak_skills).length > 0
    ) {
      btnAdaptive.hidden = false;
      btnAdaptive.onclick = function () {
        window.location.assign("/learning?attempt_id=" + result.attempt_id + "&tab=adaptive");
      };
    } else {
      btnAdaptive.hidden = true;
    }

    // Notes button
    document.getElementById("btn-goto-notes").onclick = function () {
      window.location.assign("/learning?attempt_id=" + result.attempt_id + "&tab=notes");
    };

    // Chat with Aqua button
    document.getElementById("btn-ask-aqua-res").onclick = function () {
      window.location.assign("/learning?attempt_id=" + result.attempt_id + "&tab=chat");
    };
  }
})();