const form = document.querySelector("#lesson-report-form");
const submitButton = document.querySelector("#submit-button");
const statusBox = document.querySelector("#form-status");
const lessonDate = document.querySelector("#lessonDate");
const startTime = document.querySelector("#lessonStartTime");
const endTime = document.querySelector("#lessonEndTime");
const arrivalStatus = document.querySelector("#arrivalStatus");
const minutesLateField = document.querySelector("#minutes-late-field");
const minutesLate = document.querySelector("#minutesLate");
const technicalDetailsField = document.querySelector("#technical-details-field");
const technicalDetails = document.querySelector("#technicalIssueDetails");
const safeguardingDetailsField = document.querySelector("#safeguarding-details-field");
const safeguardingDetails = document.querySelector("#safeguardingConcernDetails");
const safeguardingWarning = document.querySelector("#safeguarding-warning");

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
lessonDate.max = localToday;

function selectedValue(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value ?? "";
}

function setConditionalField(container, input, visible) {
  container.hidden = !visible;
  input.required = visible;
  if (!visible) {
    input.value = "";
    input.setCustomValidity("");
  }
}

function updateAttendanceFields() {
  setConditionalField(minutesLateField, minutesLate, arrivalStatus.value === "Late");
}

function updateTechnicalFields() {
  setConditionalField(technicalDetailsField, technicalDetails, selectedValue("technicalIssue") === "Yes");
}

function updateSafeguardingFields() {
  const hasConcern = selectedValue("safeguardingConcern") === "Yes";
  setConditionalField(safeguardingDetailsField, safeguardingDetails, hasConcern);
  safeguardingWarning.hidden = !hasConcern;
}

function validateTimes() {
  endTime.setCustomValidity("");
  if (startTime.value && endTime.value && endTime.value <= startTime.value) {
    endTime.setCustomValidity("Lesson end time must be later than the start time.");
  }
}

function showStatus(type, message) {
  statusBox.className = `form-status ${type}`;
  statusBox.textContent = message;
  statusBox.hidden = false;
  statusBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

arrivalStatus.addEventListener("change", updateAttendanceFields);
startTime.addEventListener("change", validateTimes);
endTime.addEventListener("change", validateTimes);

form.querySelectorAll('input[name="technicalIssue"]').forEach((input) => {
  input.addEventListener("change", updateTechnicalFields);
});

form.querySelectorAll('input[name="safeguardingConcern"]').forEach((input) => {
  input.addEventListener("change", updateSafeguardingFields);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  validateTimes();
  updateAttendanceFields();
  updateTechnicalFields();
  updateSafeguardingFields();

  if (!form.checkValidity()) {
    form.reportValidity();
    showStatus("error", "Something went wrong. Please check your details and try again.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Submitting report...";
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
      throw new Error(result?.message || "Something went wrong. Please check your details and try again.");
    }

    form.reset();
    updateAttendanceFields();
    updateTechnicalFields();
    updateSafeguardingFields();
    showStatus("success", "Thank you. Your lesson report has been submitted successfully.");
  } catch (error) {
    showStatus("error", error instanceof Error ? error.message : "Something went wrong. Please check your details and try again.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit Lesson Report";
  }
});
