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
    if (configWarning) configWarning.hidden = false;
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
    recoveryCodeField: document.getElementById("recovery-code-field"),
    recoveryCode: document.getElementById("recovery-code"),
    recoveryEmailLabel: document.getElementById("recovery-email-label"),
    roleButtons: Array.from(document.querySelectorAll("[data-role]")),
    registerFields: Array.from(document.querySelectorAll("[data-register-only]")),
    trainerFields: Array.from(document.querySelectorAll("[data-trainer-only]")),
    traineeFields: Array.from(document.querySelectorAll("[data-trainee-only]")),
    courseField: document.querySelector("[data-course-field]"),
    authHeading: document.getElementById("auth-heading"),
    authModeLabel: document.getElementById("auth-mode-label"),
    authDescription: document.getElementById("auth-description"),
    submitAuth: document.getElementById("submit-auth"),
    modePrompt: document.getElementById("mode-prompt"),
    modeToggle: document.getElementById("mode-toggle"),
    trainerApprovalNote: document.getElementById("trainer-approval-note"),
    adminLoginNote: document.getElementById("admin-login-note"),
    email: document.getElementById("email"),
    password: document.getElementById("password"),
    welcomeHeading: document.getElementById("welcome-heading"),
    dashboardSubtitle: document.getElementById("dashboard-subtitle"),
    profileRole: document.getElementById("profile-role"),
    profileIdLabel: document.getElementById("profile-id-label"),
    profileId: document.getElementById("profile-id"),
    profileCourse: document.getElementById("profile-course"),
    attendanceStat: document.getElementById("attendance-stat"),
    // Panels
    traineePanel: document.getElementById("trainee-panel"),
    trainerPanel: document.getElementById("trainer-panel"),
    adminPanel: document.getElementById("admin-panel"),
    // Trainee view
    traineePassId: document.getElementById("trainee-pass-id"),
    traineePassCourse: document.getElementById("trainee-pass-course"),
    traineeRecords: document.getElementById("trainee-records"),
    traineeEmpty: document.getElementById("trainee-empty"),
    qrCode: document.getElementById("qr-code"),
    downloadQr: document.getElementById("download-qr"),
    showQr: document.getElementById("show-qr"),
    refreshTrainee: document.getElementById("refresh-trainee"),
    // Trainer view
    trainerPending: document.getElementById("trainer-pending"),
    trainerWorkspace: document.getElementById("trainer-workspace"),
    trainerRecordsCard: document.getElementById("trainer-records-card"),
    traineeSelect: document.getElementById("trainee-select"),
    trainerRecords: document.getElementById("trainer-records"),
    trainerEmpty: document.getElementById("trainer-empty"),
    refreshTrainer: document.getElementById("refresh-trainer"),
    // Admin view
    adminPendingBadge: document.getElementById("admin-pending-badge"),
    adminPendingContainer: document.getElementById("admin-pending-container"),
    adminPendingEmpty: document.getElementById("admin-pending-empty"),
    adminApprovedRecords: document.getElementById("admin-approved-records"),
    adminApprovedEmpty: document.getElementById("admin-approved-empty"),
    refreshAdmin: document.getElementById("refresh-admin")
  };

  let selectedRole = "trainee";
  let registering = false;
  let currentSession = null;
  let currentProfile = null;
  let authVersion = 0;
  let traineeRoster = [];
  let recoveryEmail = "";
  let recoveryOtpVerified = false;
  let recoveryMode = new URLSearchParams(window.location.search).get("view") === "recovery";

  // Password visibility toggle setup
  document.querySelectorAll(".password-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-toggle-for");
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.textContent = isPassword ? "🙈" : "👁";
      btn.title = isPassword ? "Hide password" : "Show password";
      btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    });
  });

  function showNotice(message, type) {
    if (!notice) return;
    notice.textContent = message;
    notice.classList.toggle("notice-error", type === "error");
    notice.hidden = !message;
    if (message) {
      notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function friendlyError(error) {
    if (!error) return "Something went wrong. Please try again.";
    if (/email rate limit exceeded|rate limit.*email/i.test(error.message || "")) {
      return "Supabase has temporarily rate-limited emails for this project. Please wait a few minutes before retrying.";
    }
    if (error.code === "23505" || /duplicate key|already registered/i.test(error.message || "")) {
      return "That email, admission number, or trainer ID is already registered.";
    }
    if (/Invalid login credentials/i.test(error.message || "")) {
      return "Incorrect email or password. Please check your credentials.";
    }
    if (/Email not confirmed/i.test(error.message || "")) {
      return "Please confirm your email address before signing in.";
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
    elements.trainerFields.forEach((field) => { field.hidden = !(isRegistering && role === "trainer"); });
    elements.traineeFields.forEach((field) => { field.hidden = !(isRegistering && role === "trainee"); });
    if (elements.courseField) {
      elements.courseField.hidden = !(isRegistering && role !== "admin");
    }

    elements.authHeading.textContent = isRegistering ? "Create your account" : "Sign in";
    elements.authModeLabel.textContent = isRegistering ? "GET STARTED" : "WELCOME BACK";

    if (role === "admin") {
      elements.authDescription.textContent = isRegistering
        ? "Create an administrator account."
        : "Sign in with your verified administrator credentials.";
      elements.trainerApprovalNote.hidden = true;
      elements.adminLoginNote.hidden = isRegistering;
    } else if (role === "trainer") {
      elements.authDescription.textContent = isRegistering
        ? "Register as an RVNP course trainer."
        : "Sign in to mark trainee session attendance.";
      elements.trainerApprovalNote.hidden = !isRegistering;
      elements.adminLoginNote.hidden = true;
    } else {
      elements.authDescription.textContent = isRegistering
        ? "Register with your admission number and course details."
        : "Sign in to view your attendance history and generate your QR pass.";
      elements.trainerApprovalNote.hidden = true;
      elements.adminLoginNote.hidden = true;
    }

    elements.submitAuth.textContent = isRegistering ? "Create account" : "Sign in";
    elements.modePrompt.textContent = isRegistering ? "Already registered?" : "New to the portal?";
    elements.modeToggle.textContent = isRegistering ? "Sign in" : "Create an account";
    elements.password.autocomplete = isRegistering ? "new-password" : "current-password";
  }

  function showAuth() {
    elements.authView.hidden = false;
    elements.dashboardView.hidden = true;
    elements.recoveryView.hidden = true;
  }

  function safeText(element, value) {
    if (!element) return;
    element.textContent = value == null ? "" : String(value);
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function addTableCell(row, value, statusType) {
    const cell = document.createElement("td");
    if (statusType) {
      const pill = document.createElement("span");
      const valLower = String(value).toLowerCase();
      pill.className = `status-pill ${valLower}`;
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
      .select("id, role, full_name, email, phone, admission_number, trainer_id, course, is_approved")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data;
  }

  // 1. TRAINEE DASHBOARD (READ-ONLY ATTENDANCE)
  async function loadTraineeDashboard() {
    const traineeId = currentSession.user.id;
    safeText(elements.traineePassId, currentProfile.admission_number || "—");
    safeText(elements.traineePassCourse, currentProfile.course || "—");

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

  // 2. TRAINER DASHBOARD (MARKS ATTENDANCE FOR TRAINEES)
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
    placeholder.textContent = traineeRoster.length ? "Select a trainee" : "No registered trainees in this course yet";
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

  // Helper to build email link for phone or desktop
  function buildApprovalEmailLinks(trainer) {
    const subject = `RVNP Attendance Portal - Your Trainer Account has been Approved`;
    const body = `Hello ${trainer.full_name},\n\nYour RVNP Trainer account (Trainer ID: ${trainer.trainer_id}) for ${trainer.course} has been approved by the RVNP portal administrator.\n\nYou can now sign in to mark attendance for your trainees at:\nhttps://rvnp-attendance.vercel.app\n\nIf you have any questions, feel free to reply to this email.\n\nRegards,\nRVNP Administration\nRift Valley National Polytechnic`;

    const mailto = `mailto:${encodeURIComponent(trainer.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const webGmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(trainer.email || "")}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { mailto, webGmail, subject, body };
  }

  // 3. ADMIN DASHBOARD (APPROVES TRAINERS & DISPATCHES EMAIL / PHONE NOTIFICATIONS)
  async function loadAdminDashboard() {
    elements.attendanceStat.hidden = true;

    // Load all trainers
    const [trainersResult, contactsResult] = await Promise.all([
      client.from("profiles").select("id, full_name, email, phone, trainer_id, course, is_approved, created_at").eq("role", "trainer").order("created_at", { ascending: false }),
      client.from("profile_contacts").select("user_id, phone")
    ]);

    if (trainersResult.error) throw trainersResult.error;

    const contactsMap = new Map((contactsResult.data || []).map((c) => [c.user_id, c.phone]));
    const allTrainers = (trainersResult.data || []).map((t) => ({
      ...t,
      phone: t.phone || contactsMap.get(t.id) || "Not provided",
      email: t.email || "No email stored"
    }));

    const pending = allTrainers.filter((t) => !t.is_approved);
    const approved = allTrainers.filter((t) => t.is_approved);

    // Update pending badge
    if (elements.adminPendingBadge) {
      elements.adminPendingBadge.textContent = pending.length;
      elements.adminPendingBadge.hidden = pending.length === 0;
    }

    // Render pending trainer requests
    elements.adminPendingContainer.replaceChildren();
    if (pending.length === 0) {
      elements.adminPendingEmpty.hidden = false;
    } else {
      elements.adminPendingEmpty.hidden = true;
      pending.forEach((trainer) => {
        const card = document.createElement("div");
        card.className = "trainer-request-item";

        const emailLinks = buildApprovalEmailLinks(trainer);
        const cleanPhone = (trainer.phone || "").replace(/[^0-9+]/g, "");

        card.innerHTML = `
          <div class="trainer-item-header">
            <div>
              <h3>${escapeHtml(trainer.full_name)} <span class="status-pill pending">Pending Approval</span></h3>
              <p>Trainer ID: <strong>${escapeHtml(trainer.trainer_id || "—")}</strong> · Course: <strong>${escapeHtml(trainer.course || "—")}</strong></p>
            </div>
            <span class="muted" style="font-size: 11px;">Registered ${formatDate(trainer.created_at)}</span>
          </div>

          <div class="trainer-contact-badges">
            <span class="trainer-contact-badge">✉️ ${escapeHtml(trainer.email)}</span>
            <span class="trainer-contact-badge">📞 ${escapeHtml(trainer.phone)}</span>
          </div>

          <div class="trainer-actions-row">
            <button type="button" class="button button-success btn-approve-trainer" data-trainer-id="${trainer.id}">
              ✓ Accept &amp; Approve Trainer
            </button>
            <a href="${emailLinks.mailto}" class="button button-gmail" title="Open Gmail or default email app on your phone">
              📱 Send Email to Trainer's Gmail
            </a>
            <a href="${emailLinks.webGmail}" target="_blank" rel="noopener" class="button button-secondary" title="Open Gmail web composer in new tab">
              🌐 Open Web Gmail
            </a>
            ${cleanPhone ? `
              <a href="tel:${cleanPhone}" class="button button-phone" title="Call trainer via phone">
                📞 Call
              </a>
              <a href="sms:${cleanPhone}?body=${encodeURIComponent("Hello " + trainer.full_name + ", your RVNP Trainer account has been approved. You can now sign in at https://rvnp-attendance.vercel.app")}" class="button button-phone" title="Send SMS text to trainer">
                💬 SMS
              </a>
            ` : ""}
          </div>
        `;

        // Handle Accept / Approve Click
        const approveBtn = card.querySelector(".btn-approve-trainer");
        approveBtn.addEventListener("click", async () => {
          approveBtn.disabled = true;
          approveBtn.textContent = "Approving…";
          try {
            // First try stored procedure admin_approve_trainer
            const { error: rpcErr } = await client.rpc("admin_approve_trainer", { target_trainer_id: trainer.id });
            if (rpcErr) {
              // Fallback to direct update
              const { error: updateErr } = await client.from("profiles").update({ is_approved: true }).eq("id", trainer.id);
              if (updateErr) throw updateErr;
            }

            showNotice(`✓ Trainer ${trainer.full_name} is approved! You can now send an email notification to ${trainer.email}.`, "");
            // Prompt to open email via phone / client
            window.location.href = emailLinks.mailto;
            await loadAdminDashboard();
          } catch (err) {
            showNotice(`Failed to approve trainer: ${friendlyError(err)}`, "error");
            approveBtn.disabled = false;
            approveBtn.textContent = "✓ Accept & Approve Trainer";
          }
        });

        elements.adminPendingContainer.appendChild(card);
      });
    }

    // Render approved trainers table
    elements.adminApprovedRecords.replaceChildren();
    if (approved.length === 0) {
      elements.adminApprovedEmpty.hidden = false;
    } else {
      elements.adminApprovedEmpty.hidden = true;
      approved.forEach((trainer) => {
        const row = document.createElement("tr");
        const emailLinks = buildApprovalEmailLinks(trainer);

        addTableCell(row, trainer.full_name);
        addTableCell(row, trainer.trainer_id || "—");
        addTableCell(row, trainer.course || "—");
        addTableCell(row, trainer.email);
        addTableCell(row, trainer.phone);
        addTableCell(row, "Approved", true);

        const actionsCell = document.createElement("td");
        actionsCell.innerHTML = `
          <a href="${emailLinks.mailto}" class="text-button" title="Send email to trainer">Email</a> ·
          <a href="tel:${(trainer.phone || "").replace(/[^0-9+]/g, "")}" class="text-button" title="Call trainer">Call</a>
        `;
        row.appendChild(actionsCell);

        elements.adminApprovedRecords.appendChild(row);
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

      // Visibility of panels
      elements.traineePanel.hidden = profile.role !== "trainee";
      elements.trainerPanel.hidden = profile.role !== "trainer";
      elements.adminPanel.hidden = profile.role !== "admin";

      safeText(elements.welcomeHeading, `Welcome, ${profile.full_name}`);
      safeText(elements.dashboardSubtitle, session.user.email || "");

      if (profile.role === "admin") {
        safeText(elements.profileRole, "Administrator");
        safeText(elements.profileIdLabel, "Admin Access");
        safeText(elements.profileId, "Verified");
        safeText(elements.profileCourse, "All Departments");
        await loadAdminDashboard();
      } else if (profile.role === "trainer") {
        safeText(elements.profileRole, "Trainer");
        safeText(elements.profileIdLabel, "Trainer ID");
        safeText(elements.profileId, profile.trainer_id || "—");
        safeText(elements.profileCourse, profile.course || "—");
        await loadTrainerDashboard();
      } else {
        safeText(elements.profileRole, "Trainee");
        safeText(elements.profileIdLabel, "Admission number");
        safeText(elements.profileId, profile.admission_number || "—");
        safeText(elements.profileCourse, profile.course || "—");
        await loadTraineeDashboard();
      }
    } catch (error) {
      if (version !== authVersion) return;
      showNotice(`Unable to load your account: ${friendlyError(error)}`, "error");
    }
  }

  // Role button switcher
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
    button.addEventListener("click", async () => {
      if (recoveryOtpVerified) {
        const { error } = await client.auth.signOut();
        if (error) {
          showNotice(friendlyError(error), "error");
          return;
        }
      }
      elements.recoveryView.hidden = true;
      elements.authView.hidden = false;
      elements.forgotView.hidden = true;
      elements.authFormView.hidden = false;
      recoveryOtpVerified = false;
      recoveryMode = false;
      window.history.replaceState({}, "", window.location.pathname);
      showNotice("", "");
    });
  });

  // Auth form submission (Sign In & Sign Up)
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
        const course = selectedRole === "admin" ? "Administration" : String(formData.get("course") || "").trim();
        const phone = String(formData.get("phone") || "").trim();
        const idValue = selectedRole === "admin"
          ? "ADMIN"
          : String(formData.get(selectedRole === "trainer" ? "trainer_id" : "admission_number") || "").trim();

        if (!fullName || !phone || (selectedRole !== "admin" && (!course || !idValue))) {
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
          options: {
            data: metadata,
            emailRedirectTo: window.location.origin + window.location.pathname
          }
        });
        if (error) throw error;

        if (data.session) {
          await showDashboard(data.session);
        } else {
          if (selectedRole === "trainer") {
            showNotice("Your trainer registration is saved! Confirm your email, then an RVNP administrator will review and approve your account.", "");
          } else if (selectedRole === "admin") {
            showNotice("Administrator registration submitted. Check your email to confirm your account.", "");
          } else {
            showNotice("Your trainee registration is saved. Check your email to confirm your account, then sign in.", "");
          }
          setAuthMode(selectedRole, false);
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const profile = await getProfile(data.user.id);

        if (profile.role !== selectedRole) {
          await client.auth.signOut();
          throw new Error(`This account is registered as a ${profile.role}. Please select "${profile.role.toUpperCase()}" above.`);
        }
        if (selectedRole === "trainer" && String(formData.get("trainer_id") || "").trim() && String(formData.get("trainer_id") || "").trim() !== profile.trainer_id) {
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

  // Forgot password
  elements.forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showNotice("", "");
    setBusy(elements.forgotForm, true);
    try {
      recoveryEmail = document.getElementById("recovery-email").value.trim();
      const { error } = await client.auth.resetPasswordForEmail(recoveryEmail);
      if (error) throw error;
      recoveryOtpVerified = false;
      recoveryMode = true;
      elements.recoveryForm.reset();
      elements.recoveryCodeField.hidden = false;
      elements.recoveryCode.required = true;
      safeText(elements.recoveryEmailLabel, `Enter the recovery code sent to ${recoveryEmail}, then choose a new password.`);
      elements.authView.hidden = true;
      elements.recoveryView.hidden = false;
      showNotice("If an account exists for that email, a recovery code has been sent.", "");
    } catch (error) {
      showNotice(friendlyError(error), "error");
    } finally {
      setBusy(elements.forgotForm, false);
    }
  });

  // Recovery form
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
    const token = elements.recoveryCode.value.trim();
    if (!recoveryOtpVerified && !/^\d{6}$/.test(token)) {
      showNotice("Enter the six-digit recovery code from your email.", "error");
      return;
    }
    setBusy(elements.recoveryForm, true);
    try {
      if (!recoveryOtpVerified) {
        const { error } = await client.auth.verifyOtp({
          email: recoveryEmail,
          token,
          type: "recovery"
        });
        if (error) throw error;
        recoveryOtpVerified = true;
        elements.recoveryCodeField.hidden = true;
        elements.recoveryCode.required = false;
      }
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

  // Resend code
  document.getElementById("resend-recovery-code").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (!recoveryEmail) throw new Error("Return to sign in and request a recovery code again.");
      const { error } = await client.auth.resetPasswordForEmail(recoveryEmail);
      if (error) throw error;
      elements.recoveryCode.value = "";
      recoveryOtpVerified = false;
      elements.recoveryCodeField.hidden = false;
      elements.recoveryCode.required = true;
      showNotice("If an account exists for that email, a new recovery code has been sent.", "");
    } catch (error) {
      showNotice(friendlyError(error), "error");
    } finally {
      button.disabled = false;
    }
  });

  // TRAINER MARKS ATTENDANCE (ONLY TRAINERS CAN RECORD ATTENDANCE)
  document.getElementById("trainer-attendance-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    showNotice("", "");
    setBusy(form, true);
    try {
      const traineeId = elements.traineeSelect.value;
      if (!traineeId) throw new Error("Please select a trainee from your course roster.");
      const unitName = document.getElementById("trainer-unit").value.trim();
      const status = document.getElementById("trainer-status").value;

      const { error } = await client.from("attendance").insert({
        trainee_id: traineeId,
        marked_by: currentSession.user.id,
        unit_name: unitName,
        status: status
      });
      if (error) throw error;

      form.reset();
      showNotice("✓ Attendance successfully marked for trainee.", "");
      await loadTrainerDashboard();
    } catch (error) {
      showNotice(`Unable to mark attendance: ${friendlyError(error)}`, "error");
    } finally {
      setBusy(form, false);
    }
  });

  // Refresh listeners
  if (elements.refreshTrainee) {
    elements.refreshTrainee.addEventListener("click", async () => {
      try {
        await loadTraineeDashboard();
        showNotice("Trainee attendance records refreshed.", "");
      } catch (error) {
        showNotice(friendlyError(error), "error");
      }
    });
  }

  if (elements.refreshTrainer) {
    elements.refreshTrainer.addEventListener("click", async () => {
      try {
        await loadTrainerDashboard();
        showNotice("Course records refreshed.", "");
      } catch (error) {
        showNotice(friendlyError(error), "error");
      }
    });
  }

  if (elements.refreshAdmin) {
    elements.refreshAdmin.addEventListener("click", async () => {
      try {
        await loadAdminDashboard();
        showNotice("Admin lists refreshed.", "");
      } catch (error) {
        showNotice(friendlyError(error), "error");
      }
    });
  }

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

  if (elements.traineeSelect) {
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
  }

  // QR Code generation for Trainee Pass
  if (elements.showQr) {
    elements.showQr.addEventListener("click", () => {
      if (!window.QRCode) {
        showNotice("QR code library did not load. Check your internet connection and try again.", "error");
        return;
      }
      elements.qrCode.replaceChildren();
      const qrPayload = JSON.stringify({
        admission_number: currentProfile.admission_number,
        course: currentProfile.course,
        full_name: currentProfile.full_name
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
  }

  if (elements.downloadQr) {
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
      link.download = `rvnp-${currentProfile.admission_number || "trainee"}-qr.png`;
      link.click();
    });
  }

  setAuthMode("trainee", false);
  if (recoveryMode) {
    elements.authView.hidden = true;
    elements.recoveryView.hidden = false;
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryMode = true;
      recoveryOtpVerified = true;
      recoveryEmail = session && session.user ? session.user.email || "" : "";
      elements.recoveryCodeField.hidden = true;
      elements.recoveryCode.required = false;
      safeText(elements.recoveryEmailLabel, "Choose a new password for your account.");
      elements.authView.hidden = true;
      elements.dashboardView.hidden = true;
      elements.recoveryView.hidden = false;
      return;
    }
    if (recoveryMode) return;
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
