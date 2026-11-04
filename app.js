(function () {
  "use strict";

  const projectUrl = window.RVNP_SUPABASE_URL;
  const publishableKey = window.RVNP_SUPABASE_PUBLISHABLE_KEY;
  const configured = Boolean(
    projectUrl &&
    publishableKey &&
    !projectUrl.includes("YOUR_PROJECT_ID") &&
    !publishableKey.includes("YOUR_SUPABASE_PUBLISHABLE_KEY")
  );

  const configWarning = document.getElementById("config-warning");
  const notice = document.getElementById("notice");
  if (!configured || !window.supabase || typeof window.supabase.createClient !== "function") {
    configWarning.hidden = false;
    return;
  }

  const client = window.supabase.createClient(projectUrl, publishableKey);
  const elements = {
    authView: document.getElementById("auth-view"),
    dashboardView: document.getElementById("dashboard-view"),
    recoveryView: document.getElementById("recovery-view"),
    authFormView: document.getElementById("auth-form-view"),
    forgotView: document.getElementById("forgot-view"),
    authForm: document.getElementById("auth-form"),
    forgotForm: document.getElementById("forgot-form"),
    recoveryForm: document.getElementById("recovery-form"),
    roleButtons: Array.from(document.querySelectorAll("[data-role]")),
    registerFields: Array.from(document.querySelectorAll("[data-register-only]")),
    trainerFields: Array.from(document.querySelectorAll("[data-trainer-only]")),
    traineeFields: Array.from(document.querySelectorAll("[data-trainee-only]")),
    authHeading: document.getElementById("auth-heading"),
    authModeLabel: document.getElementById("auth-mode-label"),
    authDescription: document.getElementById("auth-description"),
    submitAuth: document.getElementById("submit-auth"),
    modePrompt: document.getElementById("mode-prompt"),
    modeToggle: document.getElementById("mode-toggle"),
    trainerApprovalNote: document.getElementById("trainer-approval-note"),
    email: document.getElementById("email"),
    password: document.getElementById("password"),
    welcomeHeading: document.getElementById("welcome-heading"),
    dashboardSubtitle: document.getElementById("dashboard-subtitle"),
    profileRole: document.getElementById("profile-role"),
    profileIdLabel: document.getElementById("profile-id-label"),
    profileId: document.getElementById("profile-id"),
    profileCourse: document.getElementById("profile-course"),
    attendanceStat: document.getElementById("attendance-stat"),
    traineePanel: document.getElementById("trainee-panel"),
    trainerPanel: document.getElementById("trainer-panel"),
    traineeRecords: document.getElementById("trainee-records"),
    traineeEmpty: document.getElementById("trainee-empty"),
    trainerRecords: document.getElementById("trainer-records"),
    trainerEmpty: document.getElementById("trainer-empty"),
    trainerPending: document.getElementById("trainer-pending"),
    trainerWorkspace: document.getElementById("trainer-workspace"),
    trainerRecordsCard: document.getElementById("trainer-records-card"),
    traineeSelect: document.getElementById("trainee-select"),
    qrCode: document.getElementById("qr-code"),
    downloadQr: document.getElementById("download-qr")
  };

  let selectedRole = "trainee";
  let registering = false;
  let currentSession = null;
  let currentProfile = null;
  let authVersion = 0;
  let traineeRoster = [];
  let recoveryMode = new URLSearchParams(window.location.search).get("view") === "recovery";

  function showNotice(message, type) {
    notice.textContent = message;
    notice.classList.toggle("notice-error", type === "error");
    notice.hidden = !message;
  }

  function friendlyError(error) {
    if (!error) return "Something went wrong. Please try again.";
    if (/email rate limit exceeded|rate limit.*email/i.test(error.message || "")) {
      return "Supabase has temporarily limited confirmation emails for this project. Wait before trying again, or configure a custom SMTP provider in Supabase → Authentication → SMTP Settings. Repeated retries will not bypass the limit.";
    }
    if (error.code === "23505" || /duplicate key|already registered/i.test(error.message || "")) {
      return "That email, admission number, or trainer ID is already in use.";
    }
    if (/Invalid login credentials/i.test(error.message || "")) {
      return "The email or password is incorrect.";
    }
    if (/Email not confirmed/i.test(error.message || "")) {
      return "Please confirm your email before signing in.";
    }
    return error.message || "Something went wrong. Please try again.";
  }

  function setBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = busy;
    button.dataset.originalText ||= button.textContent;
    button.textContent = busy ? "Please wait…" : button.dataset.originalText;
  }

  function setAuthMode(role, isRegistering) {
    selectedRole = role;
    registering = isRegistering;
    elements.roleButtons.forEach((button) => {
      const active = button.dataset.role === role;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.registerFields.forEach((field) => { field.hidden = !isRegistering; });
    elements.trainerFields.forEach((field) => { field.hidden = role !== "trainer"; });
    elements.traineeFields.forEach((field) => { field.hidden = !(isRegistering && role === "trainee"); });
    elements.authHeading.textContent = isRegistering ? "Create your account" : "Sign in";
    elements.authModeLabel.textContent = isRegistering ? "GET STARTED" : "WELCOME BACK";
    elements.authDescription.textContent = isRegistering
      ? "Register with your RVNP course details."
      : "Use your email and password to continue.";
    elements.submitAuth.textContent = isRegistering ? "Create account" : "Sign in";
    elements.modePrompt.textContent = isRegistering ? "Already registered?" : "New to the portal?";
    elements.modeToggle.textContent = isRegistering ? "Sign in" : "Create an account";
    elements.trainerApprovalNote.hidden = !(isRegistering && role === "trainer");
    elements.password.autocomplete = isRegistering ? "new-password" : "current-password";
  }

  function showAuth() {
    elements.authView.hidden = false;
    elements.dashboardView.hidden = true;
    elements.recoveryView.hidden = true;
  }

  function safeText(element, value) {
    element.textContent = value == null ? "" : String(value);
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  }

  function addTableCell(row, value, status) {
    const cell = document.createElement("td");
    if (status) {
      const pill = document.createElement("span");
      pill.className = `status-pill${String(value).toLowerCase() === "absent" ? " absent" : ""}`;
      pill.textContent = value;
      cell.appendChild(pill);
    } else {
      cell.textContent = value == null ? "" : String(value);
    }
    row.appendChild(cell);
  }

  function renderAttendance(rows, body, empty, includeTrainee) {
    body.replaceChildren();
    rows.forEach((record) => {
      const row = document.createElement("tr");
      if (includeTrainee) addTableCell(row, record.traineeName || "Trainee");
      addTableCell(row, record.unit_name || "—");
      addTableCell(row, record.status, true);
      addTableCell(row, formatDate(record.recorded_at));
      body.appendChild(row);
    });
    empty.hidden = rows.length > 0;
  }

  async function getProfile(userId) {
    const { data, error } = await client
      .from("profiles")
      .select("id, role, full_name, admission_number, trainer_id, course, is_approved")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data;
  }

  async function loadTraineeDashboard() {
    const traineeId = currentSession.user.id;
    const [totalResult, presentResult, recordsResult] = await Promise.all([
      client.from("attendance").select("id", { count: "exact", head: true }).eq("trainee_id", traineeId),
      client.from("attendance").select("id", { count: "exact", head: true }).eq("trainee_id", traineeId).eq("status", "Present"),
      client.from("attendance").select("id, unit_name, status, recorded_at").eq("trainee_id", traineeId).order("recorded_at", { ascending: false }).limit(50)
    ]);
    const error = totalResult.error || presentResult.error || recordsResult.error;
    if (error) throw error;
    const total = totalResult.count || 0;
    const present = presentResult.count || 0;
    safeText(document.getElementById("total-count"), total);
    safeText(document.getElementById("present-count"), present);
    safeText(document.getElementById("attendance-rate"), total ? Math.round((present / total) * 100) : 0);
    renderAttendance(recordsResult.data || [], elements.traineeRecords, elements.traineeEmpty, false);
  }

  async function loadTrainerDashboard() {
    const isApproved = currentProfile.is_approved === true;
    elements.trainerPending.hidden = isApproved;
    elements.trainerWorkspace.hidden = !isApproved;
    elements.trainerRecordsCard.hidden = !isApproved;
    elements.attendanceStat.hidden = true;
    safeText(document.getElementById("pending-trainer-id"), currentProfile.trainer_id);
    if (!isApproved) return;

    const [rosterResult, recordsResult] = await Promise.all([
      client.from("profiles").select("id, full_name, admission_number, course").eq("role", "trainee").eq("course", currentProfile.course).order("full_name"),
      client.from("attendance").select("id, trainee_id, unit_name, status, recorded_at").order("recorded_at", { ascending: false }).limit(50)
    ]);
    const error = rosterResult.error || recordsResult.error;
    if (error) throw error;

    traineeRoster = rosterResult.data || [];
    elements.traineeSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = traineeRoster.length ? "Select a trainee" : "No trainees in this course";
    elements.traineeSelect.appendChild(placeholder);
    traineeRoster.forEach((trainee) => {
      const option = document.createElement("option");
      option.value = trainee.id;
      option.textContent = `${trainee.full_name} (${trainee.admission_number})`;
      elements.traineeSelect.appendChild(option);
    });

    const traineesById = new Map(traineeRoster.map((trainee) => [trainee.id, trainee]));
    const rows = (recordsResult.data || [])
      .filter((record) => traineesById.has(record.trainee_id))
      .map((record) => ({ ...record, traineeName: traineesById.get(record.trainee_id).full_name }));
    renderAttendance(rows, elements.trainerRecords, elements.trainerEmpty, true);
  }

  async function showDashboard(session) {
    const version = ++authVersion;
    currentSession = session;
    currentProfile = null;
    if (!session) {
      showAuth();
      return;
    }
    showNotice("", "");
    try {
      const profile = await getProfile(session.user.id);
      if (version !== authVersion) return;
      currentProfile = profile;
      elements.authView.hidden = true;
      elements.recoveryView.hidden = true;
      elements.dashboardView.hidden = false;
      elements.traineePanel.hidden = profile.role !== "trainee";
      elements.trainerPanel.hidden = profile.role !== "trainer";
      safeText(elements.welcomeHeading, `Welcome, ${profile.full_name}`);
      safeText(elements.dashboardSubtitle, session.user.email || "");
      safeText(elements.profileRole, profile.role === "trainer" ? "Trainer" : "Trainee");
      safeText(elements.profileIdLabel, profile.role === "trainer" ? "Trainer ID" : "Admission number");
      safeText(elements.profileId, profile.role === "trainer" ? profile.trainer_id : profile.admission_number);
      safeText(elements.profileCourse, profile.course);
      document.getElementById("attendance-rate").textContent = "0";
      document.getElementById("present-count").textContent = "0";
      document.getElementById("total-count").textContent = "0";
      if (profile.role === "trainee") {
        await loadTraineeDashboard();
      } else {
        await loadTrainerDashboard();
      }
    } catch (error) {
      if (version !== authVersion) return;
      showNotice(`Unable to load your account: ${friendlyError(error)}`, "error");
    }
  }

  elements.roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setAuthMode(button.dataset.role, false);
      showNotice("", "");
    });
  });

  elements.modeToggle.addEventListener("click", () => {
    setAuthMode(selectedRole, !registering);
    showNotice("", "");
  });

  document.getElementById("forgot-link").addEventListener("click", () => {
    elements.authFormView.hidden = true;
    elements.forgotView.hidden = false;
    document.getElementById("recovery-email").value = elements.email.value;
    showNotice("", "");
  });

  document.querySelectorAll("[data-back-auth]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.forgotView.hidden = true;
      elements.authFormView.hidden = false;
    });
  });

  elements.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showNotice("", "");
    const formData = new FormData(elements.authForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    setBusy(elements.authForm, true);
    try {
      if (registering) {
        const fullName = String(formData.get("full_name") || "").trim();
        const course = String(formData.get("course") || "").trim();
        const phone = String(formData.get("phone") || "").trim();
        const idValue = String(formData.get(selectedRole === "trainer" ? "trainer_id" : "admission_number") || "").trim();
        if (!fullName || !course || !phone || !idValue) {
          throw new Error("Complete all the registration fields.");
        }
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        const metadata = {
          role: selectedRole,
          full_name: fullName,
          phone,
          course,
          admission_number: selectedRole === "trainee" ? idValue : null,
          trainer_id: selectedRole === "trainer" ? idValue : null
        };
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: metadata, emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (error) throw error;
        if (data.session) {
          await showDashboard(data.session);
        } else {
          showNotice(selectedRole === "trainer"
            ? "Registration received. Confirm your email, then wait for an RVNP administrator to approve your trainer account."
            : "Registration received. Check your email to confirm your account, then sign in.", "");
          setAuthMode(selectedRole, false);
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const profile = await getProfile(data.user.id);
        if (profile.role !== selectedRole) {
          await client.auth.signOut();
          throw new Error(`This account is registered as a ${profile.role}. Choose the matching account type.`);
        }
        if (selectedRole === "trainer" && String(formData.get("trainer_id") || "").trim() !== profile.trainer_id) {
          await client.auth.signOut();
          throw new Error("The trainer ID does not match this account.");
        }
        await showDashboard(data.session);
      }
    } catch (error) {
      showNotice(friendlyError(error), "error");
    } finally {
      setBusy(elements.authForm, false);
    }
  });

  elements.forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showNotice("", "");
    setBusy(elements.forgotForm, true);
    try {
      const email = document.getElementById("recovery-email").value.trim();
      const redirectTo = `${window.location.origin}${window.location.pathname}?view=recovery`;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      showNotice("If an account exists for that email, a password reset link has been sent.", "");
    } catch (error) {
      showNotice(friendlyError(error), "error");
    } finally {
      setBusy(elements.forgotForm, false);
    }
  });

  elements.recoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showNotice("", "");
    const password = document.getElementById("new-password").value;
    const confirmation = document.getElementById("confirm-password").value;
    if (password.length < 8) {
      showNotice("Password must be at least 8 characters.", "error");
      return;
    }
    if (password !== confirmation) {
      showNotice("The passwords do not match.", "error");
      return;
    }
    setBusy(elements.recoveryForm, true);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      recoveryMode = false;
      window.history.replaceState({}, "", window.location.pathname);
      showNotice("Password updated. You can now sign in with your new password.", "");
      await client.auth.signOut();
      elements.recoveryView.hidden = true;
      elements.authView.hidden = false;
      elements.forgotView.hidden = true;
      elements.authFormView.hidden = false;
    } catch (error) {
      showNotice(friendlyError(error), "error");
    } finally {
      setBusy(elements.recoveryForm, false);
    }
  });

  document.getElementById("trainee-attendance-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const buttonForm = event.currentTarget;
    showNotice("", "");
    setBusy(buttonForm, true);
    try {
      const { error } = await client.from("attendance").insert({
        trainee_id: currentSession.user.id,
        marked_by: currentSession.user.id,
        unit_name: document.getElementById("trainee-unit").value.trim(),
        status: document.getElementById("trainee-status").value
      });
      if (error) throw error;
      buttonForm.reset();
      showNotice("Attendance recorded.", "");
      await loadTraineeDashboard();
    } catch (error) {
      showNotice(`Unable to record attendance: ${friendlyError(error)}`, "error");
    } finally {
      setBusy(buttonForm, false);
    }
  });

  document.getElementById("trainer-attendance-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    showNotice("", "");
    setBusy(form, true);
    try {
      const traineeId = elements.traineeSelect.value;
      if (!traineeId) throw new Error("Select a trainee.");
      const { error } = await client.from("attendance").insert({
        trainee_id: traineeId,
        marked_by: currentSession.user.id,
        unit_name: document.getElementById("trainer-unit").value.trim(),
        status: document.getElementById("trainer-status").value
      });
      if (error) throw error;
      form.reset();
      showNotice("Attendance recorded.", "");
      await loadTrainerDashboard();
    } catch (error) {
      showNotice(`Unable to record attendance: ${friendlyError(error)}`, "error");
    } finally {
      setBusy(form, false);
    }
  });

  document.getElementById("refresh-trainee").addEventListener("click", async () => {
    try {
      await loadTraineeDashboard();
      showNotice("Attendance history refreshed.", "");
    } catch (error) {
      showNotice(friendlyError(error), "error");
    }
  });
  document.getElementById("refresh-trainer").addEventListener("click", async () => {
    try {
      await loadTrainerDashboard();
      showNotice("Course records refreshed.", "");
    } catch (error) {
      showNotice(friendlyError(error), "error");
    }
  });
  document.getElementById("signout-button").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) showNotice(friendlyError(error), "error");
  });
  document.getElementById("password-link").addEventListener("click", () => {
    elements.dashboardView.hidden = true;
    elements.authView.hidden = false;
    elements.authFormView.hidden = true;
    elements.forgotView.hidden = false;
    document.getElementById("recovery-email").value = currentSession.user.email || "";
    showNotice("", "");
  });
  elements.traineeSelect.addEventListener("change", async () => {
    const traineeId = elements.traineeSelect.value;
    if (!traineeId) return;
    try {
      const { data, error } = await client
        .from("attendance")
        .select("id, trainee_id, unit_name, status, recorded_at")
        .eq("trainee_id", traineeId)
        .order("recorded_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const trainee = traineeRoster.find((item) => item.id === traineeId);
      const rows = (data || []).map((record) => ({ ...record, traineeName: trainee ? trainee.full_name : "Trainee" }));
      renderAttendance(rows, elements.trainerRecords, elements.trainerEmpty, true);
    } catch (error) {
      showNotice(friendlyError(error), "error");
    }
  });

  document.getElementById("show-qr").addEventListener("click", () => {
    if (!window.QRCode) {
      showNotice("QR code library did not load. Check your internet connection and try again.", "error");
      return;
    }
    elements.qrCode.replaceChildren();
    const qrPayload = JSON.stringify({
      admission_number: currentProfile.admission_number,
      course: currentProfile.course
    });
    new window.QRCode(elements.qrCode, {
      text: qrPayload,
      width: 176,
      height: 176,
      correctLevel: window.QRCode.CorrectLevel.H
    });
    elements.qrCode.hidden = false;
    elements.downloadQr.hidden = false;
  });
  elements.downloadQr.addEventListener("click", () => {
    const image = elements.qrCode.querySelector("img");
    const canvas = elements.qrCode.querySelector("canvas");
    const source = image ? image.src : (canvas ? canvas.toDataURL("image/png") : "");
    if (!source) {
      showNotice("The QR code is not ready yet.", "error");
      return;
    }
    const link = document.createElement("a");
    link.href = source;
    link.download = "rvnp-trainee-qr.png";
    link.click();
  });

  setAuthMode("trainee", false);
  if (recoveryMode) {
    elements.authView.hidden = true;
    elements.recoveryView.hidden = false;
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryMode = true;
      elements.authView.hidden = true;
      elements.dashboardView.hidden = true;
      elements.recoveryView.hidden = false;
      return;
    }
    window.setTimeout(() => { void showDashboard(session); }, 0);
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      showNotice(friendlyError(error), "error");
      return;
    }
    if (recoveryMode) return;
    void showDashboard(data.session);
  });
})();
