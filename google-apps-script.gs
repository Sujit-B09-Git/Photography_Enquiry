const SHEET_NAME = "Enquiries";

const HEADERS = [
  "Timestamp", "Enquiry ID", "Name", "Phone", "Email", "Instagram", "City",
  "Contact preference", "Project type", "Event date", "Date flexible", "Venue",
  "Coverage duration", "Guest count", "Coverage", "Budget", "Style", "Vision",
  "Found via", "Best callback time", "Consent", "Status", "Page URL", "User agent"
];

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = JSON.parse(event.postData.contents || "{}");
    if (data.website) return jsonResponse({ ok: true });
    if (!data.name || !data.phone || !data.eventType) {
      return jsonResponse({ ok: false, error: "Missing required fields" });
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#101116").setFontColor("#ffffff");
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

    return jsonResponse({ ok: true, enquiryId: data.enquiryId });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
