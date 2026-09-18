(() => {
  const form = document.querySelector("#enquiryForm");
  const nextBtn = document.querySelector("#nextBtn");
  const backBtn = document.querySelector("#backBtn");
  const submitBtn = document.querySelector("#submitBtn");
  const successDialog = document.querySelector("#successDialog");
  const setupDialog = document.querySelector("#setupDialog");
  const draftKey = "spf-enquiry-draft-v1";
  const budgetLabels = ["₹45K – ₹75K", "₹75K – ₹1L", "₹1L – ₹1.5L", "₹1.5L – ₹2L", "₹2L – ₹2.5L", "₹2.5L – ₹3L"];
  const stepContent = {
    1: ["Step 1 of 3", "Let’s start with you", "How can we reach you about your shoot?"],
    2: ["Step 2 of 3", "Tell us about the project", "A few details help us recommend the right coverage."],
    3: ["Step 3 of 3", "Shape the creative brief", "Give us the feeling, priorities and references that matter."],
  };
  let currentStep = 1;
  let startedAt = Date.now();
  let toastTimer;

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function toast(message) {
    const el = qs("#toast");
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
  }

  function collectData() {
    const data = Object.fromEntries(new FormData(form).entries());
    data.coverage = qsa('input[name="coverage"]:checked').map((el) => el.value).join(", ");
    data.style = qsa('input[name="style"]:checked').map((el) => el.value).join(", ");
    data.dateFlexible = qs('[name="dateFlexible"]').checked ? "Yes" : "No";
    data.consent = qs('[name="consent"]').checked ? "Yes" : "No";
    data.phone = data.phone ? `+91 ${data.phone}` : "";
    data.instagram = data.instagram ? `@${data.instagram.replace(/^@/, "")}` : "";
    return data;
  }

  function saveDraft(showMessage = true) {
    const data = collectData();
    delete data.website;
    sessionStorage.setItem(draftKey, JSON.stringify({ data, step: currentStep }));
    qs("#draftStatus").textContent = "Draft saved";
    if (showMessage) toast("Draft saved on this device");
  }

  function restoreDraft() {
    const raw = sessionStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const { data, step } = JSON.parse(raw);
      Object.entries(data).forEach(([key, value]) => {
        if (["coverage", "style"].includes(key)) {
          value.split(", ").filter(Boolean).forEach((item) => {
            const input = qsa(`[name="${key}"]`).find((el) => el.value === item);
            if (input) input.checked = true;
          });
          return;
        }
        if (["dateFlexible", "consent"].includes(key)) {
          const input = qs(`[name="${key}"]`);
          if (input) input.checked = value === "Yes";
          return;
        }
        const inputs = qsa(`[name="${key}"]`);
        const cleanValue = key === "phone" ? value.replace(/\D/g, "").slice(-10) : key === "instagram" ? value.replace(/^@/, "") : value;
        const match = inputs.find((el) => el.type === "radio" && el.value === cleanValue);
        if (match) match.checked = true;
        else if (inputs[0] && inputs[0].type !== "radio") inputs[0].value = cleanValue;
      });
      goToStep(Math.min(Number(step) || 1, 3), false);
      updateBudget();
      updateStoryCount();
      updateStyleCount();
      updateSummary();
      toast("Your saved draft has been restored");
    } catch {
      sessionStorage.removeItem(draftKey);
    }
  }

  function clearFieldError(input) {
    const field = input.closest(".field");
    if (field) field.classList.remove("has-error");
    input.removeAttribute("aria-invalid");
  }

  function setFieldError(input, message) {
    const field = input.closest(".field");
    if (field) {
      field.classList.add("has-error");
      const error = qs(".field-error", field);
      if (error) error.textContent = message;
    }
    input.setAttribute("aria-invalid", "true");
  }

  function validateStep(step) {
    let valid = true;
    const panel = qs(`[data-step="${step}"]`);
    qsa("[required]", panel).forEach((input) => {
      clearFieldError(input);
      const radioGroup = input.type === "radio" ? qsa(`[name="${input.name}"]`, panel) : [];
      const isMissing = input.type === "checkbox" ? !input.checked : input.type === "radio" ? !radioGroup.some((el) => el.checked) : !input.value.trim();
      if (isMissing) {
        valid = false;
        if (input.type === "radio" || input.type === "checkbox") {
          const error = qs(`[data-error-for="${input.name}"]`, panel);
          if (error) {
            error.textContent = input.name === "consent" ? "Please confirm before sending." : "Please select one option.";
            error.classList.add("is-visible");
          }
        } else setFieldError(input, "Please complete this field.");
      }
    });

    const phone = qs('[name="phone"]', panel);
    if (phone && phone.value && !/^\d{10}$/.test(phone.value.replace(/\D/g, ""))) {
      valid = false;
      setFieldError(phone, "Enter a valid 10-digit mobile number.");
    }
    const email = qs('[name="email"]', panel);
    if (email && email.value && !email.checkValidity()) {
      valid = false;
      setFieldError(email, "Enter a valid email address.");
    }
    if (!valid) {
      const firstError = qs('[aria-invalid="true"], .group-error.is-visible', panel);
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (firstError?.focus) firstError.focus({ preventScroll: true });
    }
    return valid;
  }

  function goToStep(step, shouldScroll = true) {
    currentStep = step;
    qsa(".form-step").forEach((panel) => {
      const active = Number(panel.dataset.step) === step;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    qsa(".progress-step").forEach((button, index) => {
      const buttonStep = index + 1;
      button.classList.toggle("is-active", buttonStep === step);
      button.classList.toggle("is-complete", buttonStep < step);
      button.disabled = buttonStep > step;
      button.toggleAttribute("aria-current", buttonStep === step);
    });
    const [kicker, title, description] = stepContent[step];
    qs("#stepKicker").textContent = kicker;
    qs("#stepTitle").textContent = title;
    qs("#stepDescription").textContent = description;
    backBtn.hidden = step === 1;
    nextBtn.hidden = step === 3;
    submitBtn.hidden = step !== 3;
    updateSummary();
    saveDraft(false);
    if (shouldScroll) {
      const top = qs(".form-panel").getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }

  function updateBudget() {
    const range = qs("#budgetRange");
    const value = budgetLabels[Number(range.value)];
    qs("#budgetOutput").textContent = value;
    qs('[name="budget"]').value = value;
    const percent = (Number(range.value) / Number(range.max)) * 100;
    range.style.background = `linear-gradient(90deg, var(--accent) ${percent}%, #d9d5ce ${percent}%)`;
    updateSummary();
  }

  function updateStoryCount() {
    qs("#storyCount").textContent = qs('[name="story"]').value.length;
  }

  function updateStyleCount(event) {
    const checked = qsa('input[name="style"]:checked');
    if (checked.length > 3 && event?.target) {
      event.target.checked = false;
      toast("Choose up to three styles");
    }
    qs("#styleHint").textContent = `${Math.min(checked.length, 3)} of 3 selected`;
  }

  function formatDate(dateString, flexible) {
    if (!dateString) return flexible ? "Flexible" : "Not added";
    const formatted = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${dateString}T12:00:00`));
    return flexible ? `${formatted} · flexible` : formatted;
  }

  function updateSummary() {
    const data = collectData();
    const values = [
      data.eventType || "Not selected",
      formatDate(data.eventDate, data.dateFlexible === "Yes"),
      data.venue || "Not added",
      data.budget || budgetLabels[2],
    ];
    qsa("#briefSummary dd").forEach((dd, index) => { dd.textContent = values[index]; });
  }

  function makeReference() {
    const date = new Date();
    return `SPF-${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  function toCopyText(data) {
    const labels = {
      name: "Name", phone: "Phone", email: "Email", instagram: "Instagram", city: "City",
      contactPreference: "Contact via", eventType: "Project", eventDate: "Date", dateFlexible: "Date flexible",
      venue: "Venue", duration: "Duration", guestCount: "Guests", coverage: "Coverage", budget: "Budget",
      style: "Style", story: "Vision", source: "Found via", callbackTime: "Best time",
    };
    return Object.entries(labels).map(([key, label]) => `${label}: ${data[key] || "—"}`).join("\n");
  }

  async function submitToSheet(payload) {
    const endpoint = window.SPF_CONFIG?.googleScriptUrl?.trim();
    if (!endpoint) return false;
    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validateStep(3)) return;
    const raw = collectData();
    if (raw.website || Date.now() - startedAt < 1800) return;
    const reference = makeReference();
    const payload = {
      timestamp: new Date().toISOString(),
      enquiryId: reference,
      ...raw,
      status: "New",
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
    };
    delete payload.website;

    submitBtn.disabled = true;
    qs("span", submitBtn).textContent = "Sending…";
    try {
      const connected = await submitToSheet(payload);
      if (!connected) {
        window.__pendingEnquiry = payload;
        setupDialog.showModal();
        return;
      }
      sessionStorage.removeItem(draftKey);
      qs("#successName").textContent = payload.name.split(" ")[0];
      qs("#enquiryReference").textContent = reference;
      successDialog.showModal();
      form.reset();
      currentStep = 1;
      updateBudget();
      updateStoryCount();
      updateStyleCount();
    } catch {
      toast("We couldn’t send that. Your draft is safe—please try again.");
      saveDraft(false);
    } finally {
      submitBtn.disabled = false;
      qs("span", submitBtn).textContent = "Send enquiry";
    }
  }

  nextBtn.addEventListener("click", () => {
    if (validateStep(currentStep)) goToStep(currentStep + 1);
  });
  backBtn.addEventListener("click", () => goToStep(currentStep - 1));
  form.addEventListener("submit", handleSubmit);
  form.addEventListener("input", (event) => {
    clearFieldError(event.target);
    if (event.target.name) qs(`[data-error-for="${event.target.name}"]`)?.classList.remove("is-visible");
    if (event.target.name === "story") updateStoryCount();
    if (event.target.name === "style") updateStyleCount(event);
    updateSummary();
    qs("#draftStatus").textContent = "";
  });
  qs("#budgetRange").addEventListener("input", updateBudget);
  qs("#saveDraftBtn").addEventListener("click", () => saveDraft(true));
  qsa("[data-go-step]").forEach((button) => button.addEventListener("click", () => {
    const requested = Number(button.dataset.goStep);
    if (requested <= currentStep || validateStep(currentStep)) goToStep(requested);
  }));
  qs("#closeSuccess").addEventListener("click", () => {
    successDialog.close();
    goToStep(1);
  });
  qs("#closeSetup").addEventListener("click", () => setupDialog.close());
  qs("#keepEditing").addEventListener("click", () => setupDialog.close());
  qs("#copyEnquiry").addEventListener("click", async () => {
    await navigator.clipboard.writeText(toCopyText(window.__pendingEnquiry || collectData()));
    toast("Enquiry details copied");
    setupDialog.close();
  });
  qs('[name="eventDate"]').min = new Date().toISOString().slice(0, 10);

  function registerWebMCP() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "stage_photo_enquiry",
        title: "Stage photo enquiry",
        description: "Fill the visible Sujit Photo Films enquiry form with contact and project details without submitting it.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, city: { type: "string" },
            eventType: { type: "string", enum: ["Wedding", "Pre-wedding", "Event", "Portrait", "Commercial", "Other"] },
            eventDate: { type: "string" }, venue: { type: "string" }, story: { type: "string" }
          },
          required: ["name", "phone", "city", "eventType"],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const allowedEvents = ["Wedding", "Pre-wedding", "Event", "Portrait", "Commercial", "Other"];
          if (!input || typeof input !== "object") throw new Error("Enquiry details are required.");
          for (const key of ["name", "phone", "city", "eventType"]) {
            if (typeof input[key] !== "string" || !input[key].trim()) throw new Error(`${key} is required.`);
          }
          if (!/^\d{10}$/.test(input.phone.replace(/\D/g, ""))) throw new Error("phone must contain 10 digits.");
          if (!allowedEvents.includes(input.eventType)) throw new Error("eventType is not supported.");
          Object.entries(input).forEach(([key, value]) => {
            const controls = qsa(`[name="${key}"]`);
            const radio = controls.find((el) => el.type === "radio" && el.value === value);
            if (radio) radio.checked = true;
            else if (controls[0]) controls[0].value = String(value);
          });
          goToStep(3);
          updateSummary();
          saveDraft(false);
          return { status: "staged", currentStep: 3 };
        }
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* WebMCP is optional in unsupported browsers. */ }
  }

  updateBudget();
  restoreDraft();
  registerWebMCP();
})();
