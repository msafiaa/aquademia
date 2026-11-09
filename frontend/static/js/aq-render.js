/* ==========================================================================
   Aquademia shared renderers
   - AqRender.markdown(text)  : tiny, SAFE markdown -> HTML (escapes everything first)
   - AqRender.reviewCard(opts): kid-friendly question review card
   - AqRender.prettySkill(s)  : "kemahiran_saintifik" -> "Kemahiran saintifik"
   ========================================================================== */
(function (root) {
  "use strict";

  var AQUA_IMG = "/static/images/characters/cutouts/fania-happy.png";
  var AQUA_THINK_IMG = "/static/images/characters/cutouts/fania-thinking.png";

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>'"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c];
    });
  }

  // **bold**, *italic*, `code` on text that is ALREADY escaped
  function inline(s) {
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+?)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
    return s;
  }

  function markdown(text) {
    if (text == null) return "";
    var t = String(text).replace(/\r\n?/g, "\n");

    // Recover structure when the model squashed everything onto one line
    t = t.replace(/([^\n-])[ \t]+-{3,}[ \t]+(?=\S)/g, "$1\n---\n");
    t = t.replace(/([^\n#])[ \t]+(#{2,4})[ \t]+(?=\S)/g, "$1\n$2 ");

    var lines = t.split("\n");
    var html = [];
    var para = [];
    var list = null;

    function flushPara() {
      if (para.length) {
        html.push("<p>" + para.map(function (l) { return inline(esc(l)); }).join("<br>") + "</p>");
        para = [];
      }
    }
    function flushList() {
      if (list) {
        var open = list.type === "ol" && list.start > 1 ? ' start="' + list.start + '"' : "";
        html.push("<" + list.type + open + ">" +
          list.items.map(function (i) { return "<li>" + i + "</li>"; }).join("") +
          "</" + list.type + ">");
        list = null;
      }
    }

    lines.forEach(function (line) {
      var tr = line.trim();
      var m;

      if (!tr) { flushPara(); flushList(); return; }

      if (/^([-*_]\s*){3,}$/.test(tr)) {
        flushPara(); flushList(); html.push("<hr>"); return;
      }

      if ((m = tr.match(/^#{1,6}\s+(.*)$/))) {
        flushPara(); flushList();
        html.push('<p class="md-heading">' + inline(esc(m[1])) + "</p>");
        return;
      }

      if ((m = tr.match(/^[-*\u2022]\s+(.*)$/))) {
        flushPara();
        if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
        list.items.push(inline(esc(m[1])));
        return;
      }

      if ((m = tr.match(/^(\d+)[.)]\s+(.*)$/))) {
        flushPara();
        if (!list || list.type !== "ol") { flushList(); list = { type: "ol", start: parseInt(m[1], 10), items: [] }; }
        list.items.push(inline(esc(m[2])));
        return;
      }

      flushList();
      para.push(tr);
    });

    flushPara();
    flushList();
    return html.join("");
  }

  function prettySkill(s) {
    var t = String(s == null ? "" : s).replace(/_/g, " ").trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  /**
   * opts: { index, question, studentAnswer, correctAnswer, isCorrect, explanation }
   */
  function reviewCard(opts) {
    var ok = !!opts.isCorrect;
    var el = document.createElement("article");
    el.className = "rv-card " + (ok ? "rv-card--right" : "rv-card--wrong");

    var chips;
    if (ok) {
      chips = '<div class="rv-chip rv-chip--right"><small>Jawapan anda</small><strong>' + esc(opts.studentAnswer) + " ✓</strong></div>";
    } else {
      chips =
        '<div class="rv-chip rv-chip--yours-wrong"><small>Jawapan anda</small><strong>' +
        esc(opts.studentAnswer || "Tidak dijawab") + "</strong></div>" +
        (opts.correctAnswer
          ? '<div class="rv-chip rv-chip--right"><small>Jawapan betul</small><strong>' + esc(opts.correctAnswer) + "</strong></div>"
          : "");
    }

    el.innerHTML =
      '<header class="rv-head">' +
        '<span class="rv-num">' + esc(opts.index) + "</span>" +
        '<h4 class="rv-question">' + (opts.question ? esc(opts.question) : "Soalan " + esc(opts.index)) + "</h4>" +
        '<span class="rv-badge">' + (ok ? "Betul! 🎉" : "Belum betul 💪") + "</span>" +
      "</header>" +
      '<div class="rv-answers">' + chips + "</div>" +
      (opts.explanation
        ? '<div class="rv-aqua">' +
            '<img class="rv-aqua__avatar" src="' + (ok ? AQUA_IMG : AQUA_THINK_IMG) + '" alt="Aqua">' +
            '<div class="rv-aqua__bubble">' +
              '<div class="rv-aqua__label">💡 Penerangan Aqua</div>' +
              '<div class="md">' + markdown(opts.explanation) + "</div>" +
            "</div>" +
          "</div>"
        : "");

    return el;
  }

  root.AqRender = { esc: esc, markdown: markdown, prettySkill: prettySkill, reviewCard: reviewCard };
})(window);
