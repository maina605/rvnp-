function authorizeGmail() {
  GmailApp.getRemainingDailyQuota();
}

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("RVNP_EMAIL_BRIDGE_SECRET");
    if (!expectedSecret || !constantTimeEquals(payload.secret, expectedSecret)) {
      return jsonOutput({ ok: false });
    }

    const user = payload.user || {};
    const emailData = payload.email_data || {};
    const action = emailData.email_action_type;
    const messages = buildMessages(user, emailData, action);
    if (!messages.length) {
      throw new Error("No email message was generated.");
    }

    messages.forEach(function (message) {
      if (!isValidEmail(message.to)) {
        throw new Error("The recipient email is invalid.");
      }
      GmailApp.sendEmail(message.to, message.subject, message.body, {
        name: "RVNP Attendance Portal"
      });
    });

    return jsonOutput({ ok: true });
  } catch (error) {
    console.error("RVNP auth email delivery failed: " + error.message);
    return jsonOutput({ ok: false });
  }
}

function buildMessages(user, emailData, action) {
  const email = String(user.email || "").trim();
  const token = String(emailData.token || "").trim();
  const tokenNew = String(emailData.token_new || "").trim();
  const newEmail = String(user.new_email || "").trim();
  const messages = [];

  if (action === "email_change") {
    if (emailData.token_hash_new && token && email) {
      messages.push(codeMessage(email, "Confirm your RVNP email change", token));
    }
    if (newEmail && tokenNew && emailData.token_hash) {
      messages.push(codeMessage(newEmail, "Confirm your RVNP email change", tokenNew));
    } else if (newEmail && token && emailData.token_hash && !emailData.token_hash_new) {
      messages.push(codeMessage(newEmail, "Confirm your RVNP email change", token));
    }
    return messages;
  }

  const templates = {
    signup: {
      subject: "Confirm your RVNP Attendance Portal email",
      intro: "Use this code to confirm your email address."
    },
    recovery: {
      subject: "Your RVNP password recovery code",
      intro: "Use this code to reset your RVNP Attendance Portal password."
    },
    invite: {
      subject: "Your RVNP Attendance Portal invitation",
      intro: "Use this code to accept your invitation."
    },
    email: {
      subject: "Confirm your RVNP Attendance Portal email",
      intro: "Use this code to confirm your email address."
    },
    magiclink: {
      subject: "Your RVNP Attendance Portal sign-in code",
      intro: "Use this code to sign in."
    },
    reauthentication: {
      subject: "Your RVNP verification code",
      intro: "Use this code to verify your identity."
    }
  };
  const template = templates[action];
  if (template) {
    if (!email || !token) {
      throw new Error("The auth email is missing its recipient or code.");
    }
    messages.push({
      to: email,
      subject: template.subject,
      body: template.intro + "\n\n" + token + "\n\nIf you did not request this, you can ignore this email."
    });
    return messages;
  }

  const notifications = {
    trainer_approved: {
      subject: "RVNP Attendance Portal - Your Trainer Account is Approved",
      body: "Hello,\n\nYour RVNP Trainer account has been approved by the administrator.\n\nYou can now sign in to mark attendance at https://rvnp-attendance.vercel.app.\n\nRegards,\nRVNP Administration"
    },
    password_changed_notification: {
      subject: "Your RVNP password was changed",
      body: "The password for your RVNP Attendance Portal account was changed. If you did not make this change, contact your portal administrator."
    },
    email_changed_notification: {
      subject: "Your RVNP email address was changed",
      body: "The email address for your RVNP Attendance Portal account was changed. If you did not make this change, contact your portal administrator."
    },
    phone_changed_notification: {
      subject: "Your RVNP phone number was changed",
      body: "The phone number for your RVNP Attendance Portal account was changed. If you did not make this change, contact your portal administrator."
    },
    identity_linked_notification: {
      subject: "A sign-in method was added to your RVNP account",
      body: "A sign-in method was linked to your RVNP Attendance Portal account. If you did not make this change, contact your portal administrator."
    },
    identity_unlinked_notification: {
      subject: "A sign-in method was removed from your RVNP account",
      body: "A sign-in method was unlinked from your RVNP Attendance Portal account. If you did not make this change, contact your portal administrator."
    },
    mfa_factor_enrolled_notification: {
      subject: "Multi-factor authentication was enabled",
      body: "A multi-factor authentication method was enabled for your RVNP account. If you did not make this change, contact your portal administrator."
    },
    mfa_factor_unenrolled_notification: {
      subject: "A multi-factor authentication method was removed",
      body: "A multi-factor authentication method was removed from your RVNP account. If you did not make this change, contact your portal administrator."
    }
  };
  const notification = notifications[action];
  if (!notification || !email) {
    throw new Error("Unsupported auth email action or missing recipient.");
  }
  messages.push({
    to: email,
    subject: notification.subject,
    body: notification.body
  });
  return messages;
}

function codeMessage(to, subject, token) {
  return {
    to: to,
    subject: subject,
    body: "Use this code to confirm your email change:\n\n" + token + "\n\nIf you did not request this, you can ignore this email."
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function constantTimeEquals(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string" || actual.length !== expected.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
