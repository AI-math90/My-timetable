const BLOCK_COUNT = 48; // 24시간 * 2 (30분 단위)
const STORAGE_KEY = "timetable_schedules_v1";

let schedules = [];
let currentDate = "2026-02-01"; // 초기 날짜: 2026-02-01

let isSelecting = false;
let dragStartIndex = null;
let selectionStartIndex = null;
let selectionEndIndex = null;

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
    clearSelection();
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

    const text = document.createElement("div");
    text.className = "time-content-text";
    content.appendChild(text);

    block.appendChild(timeLabel);
    block.appendChild(content);

    attachBlockEvents(block);
    grid.appendChild(block);
  }
}

function attachBlockEvents(block) {
  block.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const index = parseInt(block.dataset.index, 10);
    if (Number.isNaN(index)) return;

    isSelecting = true;
    dragStartIndex = index;
    selectionStartIndex = index;
    selectionEndIndex = index;
    updateSelectionVisual();

    try {
      block.setPointerCapture(event.pointerId);
    } catch {
      // 지원하지 않는 경우 무시
    }
  });

  block.addEventListener("pointerenter", () => {
    if (!isSelecting) return;
    const index = parseInt(block.dataset.index, 10);
    if (Number.isNaN(index)) return;

    updateSelectionRange(index);
  });

  block.addEventListener("pointerup", handlePointerEnd);
  block.addEventListener("pointercancel", handlePointerEnd);
}

function handlePointerEnd() {
  if (!isSelecting) return;

  isSelecting = false;

  if (
    selectionStartIndex === null ||
    selectionEndIndex === null ||
    selectionStartIndex > selectionEndIndex
  ) {
    clearSelection();
    return;
  }

  openTitleModal();
}

function updateSelectionRange(currentIndex) {
  if (dragStartIndex === null) return;
  let start = Math.min(dragStartIndex, currentIndex);
  let end = Math.max(dragStartIndex, currentIndex);

  start = Math.max(0, start);
  end = Math.min(BLOCK_COUNT - 1, end);

  selectionStartIndex = start;
  selectionEndIndex = end;
  updateSelectionVisual();
}

function updateSelectionVisual() {
  const grid = document.getElementById("timeGrid");
  if (!grid) return;

  const blocks = Array.from(grid.getElementsByClassName("time-block"));
  blocks.forEach((block) => {
    const index = parseInt(block.dataset.index, 10);
    if (Number.isNaN(index)) return;

    const isInRange =
      selectionStartIndex !== null &&
      selectionEndIndex !== null &&
      index >= selectionStartIndex &&
      index <= selectionEndIndex;

    if (isInRange) {
      block.classList.add("selected");
    } else {
      block.classList.remove("selected");
    }
  });
}

function clearSelection() {
  isSelecting = false;
  dragStartIndex = null;
  selectionStartIndex = null;
  selectionEndIndex = null;
  updateSelectionVisual();
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

function openTitleModal() {
  if (!modalElement || !titleInputElement) return;
  titleInputElement.value = "";
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
    clearSelection();
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

  if (
    selectionStartIndex === null ||
    selectionEndIndex === null ||
    selectionStartIndex > selectionEndIndex
  ) {
    closeTitleModal(true);
    return;
  }

  // 같은 날짜 + 겹치는 구간 기존 일정은 제거 (단순화)
  schedules = schedules.filter((s) => {
    if (s.date !== currentDate) return true;
    const noOverlap =
      s.endIndex < selectionStartIndex || s.startIndex > selectionEndIndex;
    return noOverlap;
  });

  const schedule = {
    id: Date.now(),
    date: currentDate,
    startIndex: selectionStartIndex,
    endIndex: selectionEndIndex,
    title: trimmed,
  };

  schedules.push(schedule);
  saveSchedules();

  closeTitleModal(false);
  clearSelection();
  renderForCurrentDate();
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

    const schedule = daySchedules.find(
      (s) => index >= s.startIndex && index <= s.endIndex
    );

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
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? 0 : 30;

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${hh}:${mm}`;
}

