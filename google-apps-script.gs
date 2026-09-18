const SHEET_NAME = "Enquiries";

const HEADERS = [
  "Timestamp", "Enquiry ID", "Name", "Phone", "Email", "Instagram", "City",
  "Contact preference", "Project type", "Event date", "Date flexible", "Venue",
  "Coverage duration", "Guest count", "Coverage", "Budget", "Style", "Vision",
  "Found via", "Best callback time", "Consent", "Status", "Page URL", "User agent"
];

function doPost(event) {
  let data;
  try {
    data = JSON.parse(event.postData.contents || "{}");
  } catch (error) {
    return jsonResponse({ ok: false, error: "Invalid request" });
  }

  if (data.website) return jsonResponse({ ok: true });
  if (!data.name || !data.phone || !data.eventType) {
    return jsonResponse({ ok: false, error: "Missing required fields" });
  }

  const lock = LockService.getScriptLock();
  let hasLock = false;
  let sheetUrl = "";
  try {
    lock.waitLock(10000);
    hasLock = true;

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    sheetUrl = spreadsheet.getUrl();
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight("bold")
        .setBackground("#101116")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    const safe = (value) => {
      const text = String(value == null ? "" : value);
      return /^[=+\-@]/.test(text) ? `'${text}` : text;
    };
    sheet.appendRow([
      data.timestamp || new Date().toISOString(), data.enquiryId, data.name, data.phone,
      data.email, data.instagram, data.city, data.contactPreference, data.eventType,
      data.eventDate, data.dateFlexible, data.venue, data.duration, data.guestCount,
      data.coverage, data.budget, data.style, data.story, data.source, data.callbackTime,
      data.consent, data.status || "New", data.pageUrl, data.userAgent
    ].map(safe));
    SpreadsheetApp.flush();
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  } finally {
    if (hasLock) lock.releaseLock();
  }

  // The enquiry is already safely stored. Notification failures are logged but
  // never remove the row or make the client retry and create a duplicate.
  const notifications = sendNewEnquiryNotifications(data, sheetUrl);
  return jsonResponse({ ok: true, enquiryId: data.enquiryId, notifications });
}

function sendNewEnquiryNotifications(data, sheetUrl) {
  const result = { email: "not_configured", telegram: "not_configured" };

  try {
    result.email = sendNewEnquiryEmail(data, sheetUrl);
  } catch (error) {
    result.email = "failed";
    console.error("New enquiry email failed: " + error);
  }

  try {
    result.telegram = sendNewEnquiryTelegram(data);
  } catch (error) {
    result.telegram = "failed";
    console.error("New enquiry Telegram notification failed: " + error);
  }

  return result;
}

function sendNewEnquiryEmail(data, sheetUrl) {
  const properties = PropertiesService.getScriptProperties();
  const recipient = (properties.getProperty("OWNER_EMAIL") || "").trim();
  if (!recipient) return "not_configured";
  if (!isValidEmail(recipient)) {
    throw new Error("OWNER_EMAIL is not a valid email address.");
  }

  const email = {
    to: recipient,
    name: "Sujit Photo Films Enquiries",
    subject: `New ${data.eventType} enquiry from ${data.name}`,
    body: buildNotificationMessage(data, sheetUrl),
    htmlBody: buildNotificationHtml(data, sheetUrl)
  };
  if (isValidEmail(data.email)) email.replyTo = data.email;

  MailApp.sendEmail(email);
  return "sent";
}

function sendNewEnquiryTelegram(data) {
  const properties = PropertiesService.getScriptProperties();
  const botToken = (properties.getProperty("TELEGRAM_BOT_TOKEN") || "").trim();
  const chatId = (properties.getProperty("TELEGRAM_CHAT_ID") || "").trim();
  if (!botToken || !chatId) return "not_configured";

  const response = UrlFetchApp.fetch(telegramApiUrl(botToken, "sendMessage"), {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramMessage(data),
      disable_web_page_preview: true
    }),
    muteHttpExceptions: true
  });
  assertTelegramSuccess(response, "sendMessage");
  return "sent";
}

function buildTelegramMessage(data) {
  return [
    "📸 SUJIT PHOTO FILMS",
    "NEW ENQUIRY RECEIVED",
    "",
    `Name: ${data.name || "—"}`,
    `Phone: ${data.phone || "—"}`,
    `Email: ${data.email || "—"}`,
    `City: ${data.city || "—"}`,
    `Project/Event Type: ${data.eventType || "—"}`,
    `Event Date: ${data.eventDate || "—"}`,
    `Venue: ${data.venue || "—"}`,
    `Budget: ${data.budget || "—"}`,
    `Preferred Contact: ${data.contactPreference || "—"}`,
    "",
    "Please check the Photography Enquiries sheet for full details."
  ].join("\n");
}

function telegramApiUrl(botToken, methodName) {
  return `https://api.telegram.org/bot${botToken}/${methodName}`;
}

function assertTelegramSuccess(response, methodName) {
  const status = response.getResponseCode();
  let payload;
  try {
    payload = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error(`Telegram ${methodName} returned an unreadable response (HTTP ${status}).`);
  }

  if (status < 200 || status >= 300 || payload.ok !== true) {
    throw new Error(`Telegram ${methodName} failed: ${payload.description || `HTTP ${status}`}`);
  }
  return payload;
}

function buildNotificationMessage(data, sheetUrl) {
  return [
    "You have received a new enquiry. Please check the sheet.",
    "",
    `Reference: ${data.enquiryId || "—"}`,
    `Client: ${data.name || "—"}`,
    `Phone: ${data.phone || "—"}`,
    `Email: ${data.email || "—"}`,
    `Project: ${data.eventType || "—"}`,
    `Date: ${data.eventDate || "—"}`,
    `Venue: ${data.venue || "—"}`,
    `Budget: ${data.budget || "—"}`,
    "",
    `Open enquiries: ${sheetUrl}`
  ].join("\n");
}

function buildNotificationHtml(data, sheetUrl) {
  const details = [
    ["Reference", data.enquiryId], ["Client", data.name], ["Phone", data.phone],
    ["Email", data.email], ["Project", data.eventType], ["Date", data.eventDate],
    ["Venue", data.venue], ["Budget", data.budget]
  ].map(([label, value]) => `<tr><td style="padding:6px 14px 6px 0;color:#777">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(value || "—")}</td></tr>`).join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#202126;max-width:620px">
      <p style="color:#ef6a3d;font-weight:700;letter-spacing:.08em;text-transform:uppercase">New enquiry</p>
      <h2 style="margin:0 0 8px">You have received a new enquiry.</h2>
      <p style="color:#666">Please review the client details and follow up.</p>
      <table style="border-collapse:collapse;margin:20px 0">${details}</table>
      <a href="${escapeHtml(sheetUrl)}" style="display:inline-block;background:#101116;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Open enquiry sheet</a>
    </div>`;
}

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function testNotifications() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return sendNewEnquiryNotifications({
    enquiryId: "SPF-TEST",
    name: "Test Client",
    phone: "Test phone",
    email: "",
    city: "Pune",
    eventType: "Wedding",
    eventDate: "2027-01-24",
    venue: "Test Venue",
    budget: "₹1L – ₹1.5L",
    contactPreference: "WhatsApp"
  }, spreadsheet.getUrl());
}

function getTelegramChatId() {
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty("TELEGRAM_BOT_TOKEN");

  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is missing from Script Properties."
    );
  }

  const url =
    "https://api.telegram.org/bot" +
    token +
    "/getUpdates";

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const body = response.getContentText();

    console.log("Telegram HTTP status: " + statusCode);
    console.log("Telegram response: " + body);

    if (statusCode !== 200) {
      throw new Error(
        "Telegram API returned HTTP " +
        statusCode +
        ". Check the Execution log."
      );
    }

    const data = JSON.parse(body);

    if (!data.result || data.result.length === 0) {
      console.log(
        "No Telegram messages found. Send a new message to the bot and run this function again."
      );
      return;
    }

    data.result.forEach(function (update) {
      let chat = null;

      if (update.message && update.message.chat) {
        chat = update.message.chat;
      } else if (
        update.channel_post &&
        update.channel_post.chat
      ) {
        chat = update.channel_post.chat;
      }

      if (chat) {
        console.log("TELEGRAM_CHAT_ID = " + chat.id);
        console.log("Chat type = " + chat.type);
      }
    });

  } catch (error) {
    console.error("Telegram error: " + error.message);
    throw error;
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
