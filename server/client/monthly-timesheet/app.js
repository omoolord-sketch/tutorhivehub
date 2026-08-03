const form = document.querySelector("#timesheet-form");
const rowsContainer = document.querySelector("#lesson-rows");
const rowTemplate = document.querySelector("#lesson-row-template");
const addLessonButton = document.querySelector("#add-lesson-button");
const addLessonMobileButton = document.querySelector("#add-lesson-mobile-button");
const submitButton = document.querySelector("#submit-button");
const statusBox = document.querySelector("#form-status");
const monthCovered = document.querySelector("#monthCovered");
const yearCovered = document.querySelector("#yearCovered");
const paymentCurrency = document.querySelector("#paymentCurrency");
const lessonsJson = document.querySelector("#lessonsJson");

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

let rowSequence = 0;

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function numberValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function field(row, name) {
  return row.querySelector(`[data-field="${name}"]`);
}

function getRows() {
  return Array.from(rowsContainer.querySelectorAll(".lesson-row"));
}

function setCurrentPeriod() {
  const now = new Date();
  monthCovered.value = monthNames[now.getMonth()];
  yearCovered.value = String(now.getFullYear());
}

function updateDateLimits() {
  const monthIndex = monthNames.indexOf(monthCovered.value);
  const year = Number.parseInt(yearCovered.value, 10);

  getRows().forEach((row) => {
    const dateInput = field(row, "date");
    dateInput.min = "";
    dateInput.max = "";
    dateInput.setCustomValidity("");

    if (monthIndex >= 0 && Number.isInteger(year) && year >= 2020 && year <= 2100) {
      const month = String(monthIndex + 1).padStart(2, "0");
      const lastDay = String(new Date(year, monthIndex + 1, 0).getDate()).padStart(2, "0");
      dateInput.min = `${year}-${month}-01`;
      dateInput.max = `${year}-${month}-${lastDay}`;

      if (dateInput.value && (dateInput.value < dateInput.min || dateInput.value > dateInput.max)) {
        dateInput.setCustomValidity("The lesson date must fall within the month and year covered by this timesheet.");
      }
    }
  });
}

function updateRowState(row) {
  const hours = numberValue(field(row, "hours").value);
  const rate = numberValue(field(row, "rate").value);
  const amount = roundMoney(hours * rate);
  const reportSubmitted = field(row, "reportSubmitted").value;
  const warning = row.querySelector(".row-warning");

  field(row, "amount").textContent = amount.toFixed(2);
  row.classList.toggle("report-missing", reportSubmitted === "No");
  warning.hidden = reportSubmitted !== "No";
}

function rowHasLessonData(row) {
  return ["date", "time", "student", "subject", "lessonType", "hours", "rate", "reportSubmitted"].some(
    (name) => String(field(row, name).value).trim() !== "",
  );
}

function uniqueCount(values) {
  return new Set(values.map((value) => value.trim().toLocaleLowerCase()).filter(Boolean)).size;
}

function updateTotals() {
  const rows = getRows();
  const populatedRows = rows.filter(rowHasLessonData);
  const hours = populatedRows.reduce((sum, row) => sum + numberValue(field(row, "hours").value), 0);
  const amount = populatedRows.reduce((sum, row) => sum + numberValue(field(row, "amount").textContent), 0);
  const students = uniqueCount(populatedRows.map((row) => field(row, "student").value));
  const subjects = uniqueCount(populatedRows.map((row) => field(row, "subject").value));
  const currency = paymentCurrency.value || "Currency";

  document.querySelector("#table-total-lessons").textContent = String(populatedRows.length);
  document.querySelector("#table-total-hours").textContent = hours.toFixed(2);
  document.querySelector("#table-total-amount").textContent = roundMoney(amount).toFixed(2);
  document.querySelector("#table-currency").textContent = currency;

  document.querySelector("#summary-lessons").textContent = String(populatedRows.length);
  document.querySelector("#summary-students").textContent = String(students);
  document.querySelector("#summary-subjects").textContent = String(subjects);
  document.querySelector("#summary-hours").textContent = hours.toFixed(2);
  document.querySelector("#summary-amount").textContent = roundMoney(amount).toFixed(2);
  document.querySelector("#summary-currency").textContent = currency;
}

function updateRemoveButtons() {
  const rows = getRows();
  rows.forEach((row) => {
    const button = row.querySelector(".remove-row-button");
    button.disabled = rows.length === 1;
    button.title = rows.length === 1 ? "At least one lesson row is required" : "Remove this lesson";
  });
}

function assignRowLabels(row, rowNumber) {
  row.querySelectorAll("[data-field]").forEach((control) => {
    const fieldName = control.dataset.field;
    const id = `lesson-${rowNumber}-${fieldName}`;
    control.id = id;
    const label = control.closest("td")?.querySelector("label");
    if (label) {
      label.htmlFor = id;
      label.textContent = `${label.textContent}, lesson ${rowNumber}`;
    }
  });
}

function addLessonRow(values = {}) {
  rowSequence += 1;
  const fragment = rowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".lesson-row");
  assignRowLabels(row, rowSequence);

  ["date", "time", "student", "subject", "lessonType", "hours", "rate", "reportSubmitted", "notes"].forEach((name) => {
    if (values[name] !== undefined) {
      field(row, name).value = values[name];
    }
  });

  row.querySelectorAll("input, select, textarea").forEach((control) => {
    control.addEventListener("input", () => {
      updateDateLimits();
      updateRowState(row);
      updateTotals();
    });
    control.addEventListener("change", () => {
      updateDateLimits();
      updateRowState(row);
      updateTotals();
    });
  });

  row.querySelector(".remove-row-button").addEventListener("click", () => {
    row.remove();
    updateRemoveButtons();
    updateTotals();
  });

  rowsContainer.appendChild(fragment);
  updateDateLimits();
  updateRowState(row);
  updateRemoveButtons();
  updateTotals();
}

function collectLessons() {
  return getRows().map((row) => {
    const hours = numberValue(field(row, "hours").value);
    const rate = numberValue(field(row, "rate").value);

    return {
      date: field(row, "date").value,
      time: field(row, "time").value,
      student: field(row, "student").value.trim(),
      subject: field(row, "subject").value.trim(),
      lessonType: field(row, "lessonType").value,
      hours,
      rate,
      amount: roundMoney(hours * rate),
      reportSubmitted: field(row, "reportSubmitted").value,
      notes: field(row, "notes").value.trim(),
    };
  });
}

function showStatus(type, message) {
  statusBox.className = `form-status ${type}`;
  statusBox.textContent = message;
  statusBox.hidden = false;
  statusBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function handleAddLesson() {
  addLessonRow();
  const rows = getRows();
  field(rows[rows.length - 1], "date").focus();
}

addLessonButton.addEventListener("click", handleAddLesson);
addLessonMobileButton.addEventListener("click", handleAddLesson);
monthCovered.addEventListener("change", updateDateLimits);
yearCovered.addEventListener("input", updateDateLimits);
paymentCurrency.addEventListener("change", updateTotals);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateDateLimits();
  getRows().forEach(updateRowState);
  updateTotals();

  const lessons = collectLessons();
  lessonsJson.value = JSON.stringify(lessons);

  if (!form.checkValidity() || lessons.length === 0) {
    form.reportValidity();
    showStatus("error", "Something went wrong. Please check your details and try again.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Submitting timesheet...";
  statusBox.hidden = true;

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: {
        Accept: "application/json",
      },
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      throw new Error();
    }

    form.reset();
    rowsContainer.replaceChildren();
    setCurrentPeriod();
    addLessonRow();
    updateTotals();
    showStatus(
      "success",
      "Thank you. Your monthly timesheet has been submitted successfully. TutorHiveHub will review and verify your submitted sessions.",
    );
  } catch (_error) {
    showStatus("error", "Something went wrong. Please check your details and try again.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit Monthly Timesheet";
  }
});

setCurrentPeriod();
addLessonRow();
