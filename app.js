const BLOCK_COUNT = 36; // 06:00 ~ 24:00, 30분 단위 (18시간 * 2)
const STORAGE_KEY = "timetable_schedules_v2";

let schedules = [];
let currentDate = "2026-02-01"; // 초기 날짜: 2026-02-01

let clipboardTitle = "";
let currentEditIndex = null;

document.addEventListener("DOMContentLoaded", () => {
  loadSchedules();
  setupDateInput();
  buildTimeGrid();
  setupModal();
  renderForCurrentDate();
});

function setupDateInput() {
  const dateInput = document.getElementById("dateInput");
  if (!dateInput) return;

  dateInput.value = currentDate;
  dateInput.addEventListener("change", (e) => {
    currentDate = e.target.value || currentDate;
    renderForCurrentDate();
  });
}

function buildTimeGrid() {
  const grid = document.getElementById("timeGrid");
  if (!grid) return;

  grid.innerHTML = "";

  for (let index = 0; index < BLOCK_COUNT; index++) {
    const block = document.createElement("div");
    block.className = "time-block";
    block.dataset.index = index.toString();

    const timeLabel = document.createElement("div");
    timeLabel.className = "time-label";
    timeLabel.textContent = formatTimeLabel(index);

    const content = document.createElement("div");
    content.className = "time-content time-content-empty";

    const textWrapper = document.createElement("div");
    textWrapper.className = "time-text-wrapper";

    const text = document.createElement("div");
    text.className = "time-content-text";
    textWrapper.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "time-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn edit-btn";
    editBtn.type = "button";
    editBtn.textContent = "입력";

    const copyBtn = document.createElement("button");
    copyBtn.className = "icon-btn copy-btn";
    copyBtn.type = "button";
    copyBtn.textContent = "복사";

    const pasteBtn = document.createElement("button");
    pasteBtn.className = "icon-btn paste-btn";
    pasteBtn.type = "button";
    pasteBtn.textContent = "붙여넣기";

    actions.appendChild(editBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(pasteBtn);

    content.appendChild(textWrapper);
    content.appendChild(actions);

    block.appendChild(timeLabel);
    block.appendChild(content);

    attachBlockEvents(block, { editBtn, copyBtn, pasteBtn });
    grid.appendChild(block);
  }
}

function attachBlockEvents(block, { editBtn, copyBtn, pasteBtn }) {
  const index = parseInt(block.dataset.index, 10);
  if (Number.isNaN(index)) return;

  editBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    openTitleModal(index);
  });

  copyBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    handleCopy(index);
  });

  pasteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    handlePaste(index);
  });
}

// 모달 관련

let modalElement = null;
let titleInputElement = null;
let charCountElement = null;
let saveButtonElement = null;
let cancelButtonElement = null;

function setupModal() {
  modalElement = document.getElementById("titleModal");
  titleInputElement = document.getElementById("titleInput");
  charCountElement = document.getElementById("charCount");
  saveButtonElement = document.getElementById("saveButton");
  cancelButtonElement = document.getElementById("cancelButton");

  if (!modalElement || !titleInputElement) return;

  titleInputElement.addEventListener("input", () => {
    updateCharCount();
  });

  if (saveButtonElement) {
    saveButtonElement.addEventListener("click", () => {
      saveScheduleFromModal();
    });
  }

  if (cancelButtonElement) {
    cancelButtonElement.addEventListener("click", () => {
      closeTitleModal(true);
    });
  }

  modalElement.addEventListener("click", (event) => {
    if (event.target === modalElement) {
      closeTitleModal(true);
    }
  });
}

function openTitleModal(index) {
  if (!modalElement || !titleInputElement) return;

  currentEditIndex = index;

  const existing = getScheduleForCurrentDate(index);
  titleInputElement.value = existing ? existing.title : "";
  updateCharCount();

  modalElement.classList.remove("hidden");

  setTimeout(() => {
    titleInputElement.focus();
  }, 50);
}

function closeTitleModal(cancelOnly) {
  if (!modalElement) return;
  modalElement.classList.add("hidden");
  if (cancelOnly) {
    currentEditIndex = null;
  }
}

function updateCharCount() {
  if (!titleInputElement || !charCountElement || !saveButtonElement) return;
  const length = titleInputElement.value.length;
  const max = 20;
  charCountElement.textContent = `${length} / ${max}`;

  if (length >= max) {
    charCountElement.classList.add("max");
  } else {
    charCountElement.classList.remove("max");
  }

  const trimmed = titleInputElement.value.trim();
  saveButtonElement.disabled = trimmed.length === 0;
}

function saveScheduleFromModal() {
  if (!titleInputElement) return;
  const raw = titleInputElement.value;
  const trimmed = raw.trim();
  if (!trimmed) return;

  if (currentEditIndex === null) {
    closeTitleModal(true);
    return;
  }

  upsertSchedule(currentEditIndex, trimmed);
  closeTitleModal(false);
  currentEditIndex = null;
}

// 렌더링

function renderForCurrentDate() {
  const grid = document.getElementById("timeGrid");
  if (!grid) return;

  const daySchedules = schedules.filter((s) => s.date === currentDate);

  const blocks = Array.from(grid.getElementsByClassName("time-block"));
  blocks.forEach((block) => {
    const index = parseInt(block.dataset.index, 10);
    if (Number.isNaN(index)) return;

    const schedule = daySchedules.find((s) => {
      const start = typeof s.startIndex === "number" ? s.startIndex : s.index;
      const end =
        typeof s.endIndex === "number" ? s.endIndex : start;
      return index >= start && index <= end;
    });

    const content = block.querySelector(".time-content");
    const text = block.querySelector(".time-content-text");

    if (!content || !text) return;

    if (schedule) {
      block.classList.add("has-schedule");
      content.classList.remove("time-content-empty");
      text.textContent = schedule.title;
    } else {
      block.classList.remove("has-schedule");
      content.classList.add("time-content-empty");
      text.textContent = "";
    }
  });
}

// 복사 / 붙여넣기 및 스케줄 관리

function getScheduleForCurrentDate(index) {
  return schedules.find((s) => {
    if (s.date !== currentDate) return false;
    const start = typeof s.startIndex === "number" ? s.startIndex : s.index;
    const end =
      typeof s.endIndex === "number" ? s.endIndex : start;
    return index >= start && index <= end;
  });
}

function upsertSchedule(index, title) {
  const trimmed = title.trim();

  // 기존: 같은 날짜 + 해당 인덱스를 포함하는 일정 제거
  schedules = schedules.filter((s) => {
    if (s.date !== currentDate) return true;
    const start = typeof s.startIndex === "number" ? s.startIndex : s.index;
    const end =
      typeof s.endIndex === "number" ? s.endIndex : start;
    const containsIndex = index >= start && index <= end;
    return !containsIndex;
  });

  if (trimmed) {
    schedules.push({
      id: Date.now(),
      date: currentDate,
      startIndex: index,
      endIndex: index,
      title: trimmed,
    });
  }

  saveSchedules();
  renderForCurrentDate();
}

function handleCopy(index) {
  const schedule = getScheduleForCurrentDate(index);
  if (!schedule || !schedule.title) return;
  clipboardTitle = schedule.title;
}

function handlePaste(index) {
  if (!clipboardTitle) return;
  upsertSchedule(index, clipboardTitle);
}

// 저장 / 불러오기

function loadSchedules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      schedules = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      schedules = parsed;
    } else {
      schedules = [];
    }
  } catch {
    schedules = [];
  }
}

function saveSchedules() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  } catch {
    // 저장 실패는 조용히 무시
  }
}

// 유틸

function formatTimeLabel(index) {
  // 06:00을 시작으로 24:00 직전까지 표시 (06:00 ~ 23:30)
  const hour = 6 + Math.floor(index / 2);
  const minute = index % 2 === 0 ? 0 : 30;

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${hh}:${mm}`;
}

