/* ==========================================================================
   Aquademia Quiz Controller
   ========================================================================== */
(function () {
  "use strict";

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
      if (d && typeof d.pearls !== "undefined") {
        document.getElementById("user-pearls").textContent = d.pearls;
      }
    });

  /* ------------------------------------------------------------------
     Subject & Topic Selection
     ------------------------------------------------------------------ */
  function setSubject(sub) {
    currentSubject = sub;
    tabMath.classList.toggle("active", sub === "Mathematics");
    tabScience.classList.toggle("active", sub === "Science");
    renderTopicCards();
  }

  tabMath.addEventListener("click", function () { setSubject("Mathematics"); });
  tabScience.addEventListener("click", function () { setSubject("Science"); });

  var topicRequestId = 0;

  function renderTopicCards() {
    topicRequestId++; // cancels any topic request still in flight

    if (currentSubject === "Science") {
      loadScienceTopics();
      return;
    }

    drawTopicCards((TOPICS[currentSubject] || []).map(function (t) {
      return { name: t.name, label: t.label, meta: t.name + " \u2022 " + t.desc };
    }));
  }

  // Science topics come from the questions table, for this student's year
  function loadScienceTopics() {
    var reqId = topicRequestId;
    var year = (currentStudent && currentStudent.year_level) || 4;

    currentTopic = null;
    btnStartQuiz.disabled = true;
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
          return { name: t.topic, label: t.topic, meta: "Tahun " + year + " \u2022 " + t.count + " soalan" };
        }));
      });
  }

  function drawTopicCards(list) {
    topicsContainer.innerHTML = "";
    if (!list.length) { btnStartQuiz.disabled = true; return; }

    btnStartQuiz.disabled = false;
    currentTopic = list[0].name;

    list.forEach(function (t, idx) {
      var btn = document.createElement("div");
      btn.className = "topic-btn" + (idx === 0 ? " selected" : "");

      var name = document.createElement("div");
      name.className = "topic-btn__name";
      name.textContent = t.label;

      var meta = document.createElement("div");
      meta.className = "topic-btn__meta";
      meta.textContent = t.meta;

      btn.appendChild(name);
      btn.appendChild(meta);
      btn.addEventListener("click", function () {
        Array.prototype.forEach.call(topicsContainer.children, function (c) { c.classList.remove("selected"); });
        btn.classList.add("selected");
        currentTopic = t.name;
      });
      topicsContainer.appendChild(btn);
    });
  }

  btnStartQuiz.addEventListener("click", function () {
    if (!currentTopic) return;
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
        btnStartQuiz.textContent = "Mula Menyelam!";

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
        btnStartQuiz.textContent = "Mula Menyelam!";
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
        renderResults(result);
      })
      .catch(function (err) {
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
        breakdownContainer.appendChild(window.AqRender.reviewCard({
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
    if (result.weak_skills && result.weak_skills.length > 0) {
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
