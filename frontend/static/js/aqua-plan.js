(function () {
  "use strict";

  var form = document.getElementById("ap-form");
  var builder = document.getElementById("ap-builder");
  var buildButton = document.getElementById("ap-build-button");
  var editButton = document.getElementById("ap-edit-button");
  var errorBox = document.getElementById("ap-form-error");
  var statusBox = document.getElementById("ap-status");
  var grid = document.getElementById("ap-week-grid");
  var reasoning = document.getElementById("ap-reasoning");
  var progressWrap = document.getElementById("ap-progress-wrap");
  var pearls = document.getElementById("ap-pearls");
  var speech = document.getElementById("ap-speech");
  var plan = null;

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function setStatus(message, kind) {
    statusBox.textContent = message;
    statusBox.className = "ap-status" + (kind ? " is-" + kind : "");
  }

  function showFormError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  function setFormPreferences(preferences) {
    form.querySelectorAll('input[name="free_days"]').forEach(function (input) {
      input.checked = (preferences.free_days || []).indexOf(Number(input.value)) !== -1;
    });
    document.getElementById("ap-minutes").value = String(preferences.minutes_per_day);
    document.getElementById("ap-exam-date").value = preferences.exam_date || "";
  }

  function setBuilderButtonLabel() {
    buildButton.textContent = plan ? "Simpan jadual" : "🐚 Bina misi minggu ini";
  }

  function safeInternalHref(href) {
    try {
      var parsed = new URL(href, window.location.origin);
      return parsed.origin === window.location.origin ? parsed.pathname + parsed.search : "/learning";
    } catch (error) {
      return "/learning";
    }
  }

  function updateProgress() {
    if (!plan) return;
    var total = Number(plan.task_count) || 0;
    var completed = Number(plan.completed_count) || 0;
    var percent = total ? Math.round((completed / total) * 100) : 0;
    document.getElementById("ap-progress-label").textContent =
      completed + " / " + total + " tugasan · " + percent + "%";
    document.getElementById("ap-progress-bar").style.width = percent + "%";
    progressWrap.hidden = false;
  }

  function renderTask(task, completed) {
    var card = element("article", "ap-task" + (completed ? " is-done" : ""));
    var title = element("h4", "", task.title);
    card.appendChild(title);

    var meta = element("div", "ap-task__meta");
    meta.appendChild(element("span", "", "⏱ " + task.minutes + " minit"));
    meta.appendChild(element("span", "", "· " + task.skill));
    card.appendChild(meta);
    card.appendChild(element("p", "ap-task__why", task.why));

    var actions = element("div", "ap-task__actions");
    var link = element("a", "", task.label + " ↗");
    link.href = safeInternalHref(task.href);
    actions.appendChild(link);
    var finish = element(
      "button",
      "",
      completed ? "✓ Selesai" : "Tandakan selesai · +5 🐚"
    );
    finish.type = "button";
    finish.disabled = completed;
    if (!completed) {
      finish.addEventListener("click", function () {
        completeTask(task.task_id, finish);
      });
    }
    actions.appendChild(finish);
    card.appendChild(actions);
    return card;
  }

  function updateSchedule(day, action, extra) {
    return requestJson("/api/aquaplan/" + plan.plan_id + "/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({
        date: day.date,
        action: action
      }, extra || {}))
    }).then(function (payload) {
      renderPlan(payload.plan);
      setStatus("Jadual berjaya dikemas kini.", "success");
    }).catch(function (error) {
      requestJson("/api/aquaplan").then(function (payload) {
        renderPlan(payload.plan);
        setStatus(error.message, "error");
      }).catch(function (refreshError) {
        setStatus(refreshError.message, "error");
      });
    });
  }

  function renderDayTools(day, dayCard) {
    if (day.is_catch_up) return;

    var tools = element("div", "ap-day-tools");
    var busyButton = element(
      "button",
      "",
      day.is_busy ? "Hari ini sibuk · Pulihkan misi" : "📅 Tandakan hari sibuk"
    );
    busyButton.type = "button";
    busyButton.addEventListener("click", function () {
      busyButton.disabled = true;
      updateSchedule(day, "set_busy", { is_busy: !day.is_busy });
    });
    tools.appendChild(busyButton);

    var addEventButton = element("button", "", "＋ Tambah acara / aktiviti");
    addEventButton.type = "button";
    tools.appendChild(addEventButton);
    dayCard.appendChild(tools);

    var events = day.events || [];
    if (events.length) {
      var eventList = element("div", "ap-event-list");
      events.forEach(function (event) {
        var eventRow = element("div", "ap-event");
        var eventLabel = (event.time ? event.time + " · " : "") + event.title;
        eventRow.appendChild(element("span", "", "📌 " + eventLabel));
        var removeButton = element("button", "", "×");
        removeButton.type = "button";
        removeButton.setAttribute("aria-label", "Buang acara " + event.title);
        removeButton.addEventListener("click", function () {
          removeButton.disabled = true;
          updateSchedule(day, "remove_event", { event_id: event.event_id });
        });
        eventRow.appendChild(removeButton);
        eventList.appendChild(eventRow);
      });
      dayCard.appendChild(eventList);
    }

    var eventForm = element("form", "ap-event-form");
    eventForm.hidden = true;
    var titleInput = element("input");
    titleInput.type = "text";
    titleInput.maxLength = 80;
    titleInput.required = true;
    titleInput.placeholder = "Contoh: Acara sekolah";
    titleInput.setAttribute("aria-label", "Nama acara atau aktiviti");
    var timeInput = element("input");
    timeInput.type = "time";
    timeInput.setAttribute("aria-label", "Masa acara (pilihan)");
    var saveButton = element("button", "", "Tambah");
    saveButton.type = "submit";
    eventForm.appendChild(titleInput);
    eventForm.appendChild(timeInput);
    eventForm.appendChild(saveButton);
    eventForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!titleInput.value.trim()) {
        titleInput.focus();
        return;
      }
      saveButton.disabled = true;
      updateSchedule(day, "add_event", {
        title: titleInput.value.trim(),
        time: timeInput.value
      });
    });
    addEventButton.addEventListener("click", function () {
      eventForm.hidden = !eventForm.hidden;
      if (!eventForm.hidden) titleInput.focus();
    });
    dayCard.appendChild(eventForm);
  }

  function renderPlan(nextPlan) {
    plan = nextPlan;
    grid.replaceChildren();
    reasoning.replaceChildren();
    if (!plan) {
      builder.hidden = false;
      editButton.hidden = true;
      setBuilderButtonLabel();
      progressWrap.hidden = true;
      reasoning.hidden = true;
      setStatus("Belum ada pelan. Pilih masa dan hari lapang, kemudian Mal akan sediakan misi khas untuk kamu.");
      return;
    }

    setFormPreferences(plan);
    builder.hidden = true;
    editButton.hidden = false;
    editButton.textContent = "✏️ Edit jadual";
    setBuilderButtonLabel();

    var completedIds = new Set(plan.completed_task_ids || []);
    plan.completed_count = completedIds.size;
    plan.task_count = (plan.days || []).reduce(function (count, day) {
      return count + day.tasks.length;
    }, 0);
    updateProgress();
    reasoning.hidden = false;
    reasoning.appendChild(element("strong", "", "🔍 Kenapa misi ini dipilih?"));
    reasoning.appendChild(document.createTextNode(plan.insight));
    (plan.focus || []).slice(0, 3).forEach(function (item, index) {
      var rate = Math.round((item.accuracy || 0) * 100);
      var label = item.errors
        ? item.topic + " · " + item.skill.replace(/_/g, " ") + " · " + item.errors + " kesilapan"
        : item.topic + " · pengukuhan";
      reasoning.appendChild(element("span", "ap-focus-chip", (index + 1) + ". " + label + (item.errors ? " · " + rate + "% tepat" : "")));
    });

    var activeDays = plan.days.filter(function (day) {
      return day.is_free && !day.is_busy && !day.is_catch_up;
    }).length;
    setStatus(
      plan.week_complete
        ? "Misi minggu ini selesai! Hebat — kamu dah dapat bonus mingguan. 🐠"
        : "Misi siap untuk " + activeDays + " hari lapang. Tandakan hari sibuk untuk pindahkan misi belum siap ke hari ganti.",
      plan.week_complete ? "success" : ""
    );
    speech.textContent = plan.focus && plan.focus.length
      ? "Minggu ini kita fokus " + plan.focus[0].topic + " ya!"
      : "Jom bina rutin belajar yang seronok!";

    plan.days.forEach(function (day) {
      var dayCard = element(
        "article",
        "ap-day-card" +
          (day.is_busy ? " is-busy" : day.is_free ? " is-free" : "") +
          (day.is_catch_up ? " is-catch-up" : "")
      );
      var header = element("div", "ap-day-card__head");
      var dateWrap = element("div");
      dateWrap.appendChild(element("h3", "", "Hari " + day.day_number + " · " + day.weekday));
      var date = new Date(day.date + "T12:00:00");
      dateWrap.appendChild(element("time", "", date.toLocaleDateString("ms-MY", {
        day: "numeric", month: "short"
      })));
      header.appendChild(dateWrap);
      header.appendChild(element(
        "span",
        "ap-day-tag" +
          (day.is_busy ? " is-busy" : day.is_catch_up ? " is-catch-up" : day.is_free ? "" : " is-rest"),
        day.is_busy ? "Sibuk" : day.is_catch_up ? "Misi ganti" : day.is_free ? day.tasks.length + " misi" : "Hari rehat"
      ));
      dayCard.appendChild(header);
      renderDayTools(day, dayCard);

      if (day.is_free || day.is_catch_up || day.tasks.length) {
        day.tasks.forEach(function (task) {
          dayCard.appendChild(renderTask(task, completedIds.has(task.task_id)));
        });
      } else if (!day.is_busy) {
        dayCard.appendChild(element("p", "ap-task__why", "Rehat pun sebahagian daripada belajar. Jumpa Mal pada hari lapang kamu!"));
      }
      grid.appendChild(dayCard);
    });
  }

  editButton.addEventListener("click", function () {
    if (builder.hidden) {
      builder.hidden = false;
      editButton.textContent = "Tutup editor";
      builder.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (plan) setFormPreferences(plan);
    builder.hidden = true;
    editButton.textContent = "✏️ Edit jadual";
  });

  function requestJson(url, options) {
    return fetch(url, Object.assign({ credentials: "same-origin" }, options || {}))
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) throw new Error(body.error || "Permintaan tidak berjaya.");
          return body;
        });
      });
  }

  function completeTask(taskId, button) {
    if (!plan || button.disabled) return;
    button.disabled = true;
    requestJson("/api/aquaplan/" + plan.plan_id + "/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId })
    }).then(function (result) {
      return requestJson("/api/aquaplan").then(function (payload) {
        renderPlan(payload.plan);
        if (result.bonus) {
          var rewardText = result.bonus.inventory_id
            ? "hiasan baharu: " + result.bonus.reward_label
            : "lencana: " + result.bonus.reward_label;
          setStatus("Minggu lengkap! +25 mutiara dan " + rewardText + " 🎉", "success");
        } else if (result.already_completed) {
          setStatus("Tugasan ini sudah pun dikira. Mutiara tak akan diberi dua kali.");
        } else {
          setStatus("Tugasan selesai! +5 mutiara masuk ke dompet kamu. 🐚", "success");
        }
        return requestJson("/api/shop/wallet").then(function (wallet) {
          pearls.textContent = wallet.available_pearls;
        });
      });
    }).catch(function (error) {
      button.disabled = false;
      setStatus(error.message, "error");
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    showFormError("");
    var isEditing = Boolean(plan);
    var selectedDays = Array.prototype.slice.call(
      form.querySelectorAll('input[name="free_days"]:checked')
    ).map(function (input) { return Number(input.value); });
    if (!selectedDays.length) {
      showFormError("Pilih sekurang-kurangnya satu hari lapang.");
      return;
    }

    buildButton.disabled = true;
    buildButton.textContent = "Mal sedang merancang...";
    setStatus("Mal sedang menyusun misi berdasarkan prestasi dan masa kamu...");
    requestJson("/api/aquaplan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        free_days: selectedDays,
        minutes_per_day: Number(document.getElementById("ap-minutes").value),
        exam_date: document.getElementById("ap-exam-date").value
      })
    }).then(function (payload) {
      renderPlan(payload.plan);
      setStatus(
        isEditing
          ? "Jadual AquaPlan dikemas kini. Tugasan siap dan ganjaran kamu kekal. 🌊"
          : "Pelan peribadi kamu dah siap. Jom mulakan misi pertama! 🌊",
        "success"
      );
      document.getElementById("ap-plan-title").scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function (error) {
      setStatus("Mal tak dapat bina pelan sekarang. Cuba sebentar lagi.", "error");
      showFormError(error.message);
    }).finally(function () {
      buildButton.disabled = false;
      setBuilderButtonLabel();
    });
  });

  var today = new Date();
  var localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
  document.getElementById("ap-exam-date").min = localToday;

  requestJson("/api/aquaplan").then(function (payload) {
    renderPlan(payload.plan);
  }).catch(function () {
    setStatus("Mal tak dapat membaca pelan sekarang. Cuba muat semula halaman.", "error");
  });
  requestJson("/api/shop/wallet").then(function (wallet) {
    pearls.textContent = wallet.available_pearls;
  }).catch(function () {
    pearls.textContent = "—";
  });
})();
