/**
 * Pick 6 Pool – Google Apps Script Backend
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet (the one connected to your Google Form, or a new one)
 * 2. Extensions → Apps Script
 * 3. Paste this entire file
 * 4. Click "Deploy" → "New Deployment"
 * 5. Type: Web App
 * 6. Execute as: Me
 * 7. Who has access: Anyone
 * 8. Click Deploy → copy the Web App URL
 * 9. Paste that URL into the Pick 6 Admin panel under "Google Apps Script URL"
 *
 * SPREADSHEET STRUCTURE:
 * This script writes entries to a sheet named "Entries" with columns:
 * A: Timestamp | B: Name | C: Email | D: Team1 | E: Team2 | F: Team3 | G: Team4 | H: Team5 | I: Team6 | J: TOD
 *
 * The leaderboard reads from the PUBLISHED CSV of this sheet.
 */

const SHEET_NAME = 'Entries';

/**
 * Handles form submissions from the pick submission page.
 * Called via fetch() POST from submit.html.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Validate required fields
    const required = ['name', 'email', 'team1', 'team2', 'team3', 'team4', 'team5', 'team6', 'tod'];
    for (const field of required) {
      if (!data[field] || String(data[field]).trim() === '') {
        return jsonResponse({ success: false, error: `Missing required field: ${field}` });
      }
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Create the Entries sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['Timestamp', 'Name', 'Email', 'Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Team 6', 'Team of Destiny']);
      sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Write the entry
    sheet.appendRow([
      new Date(),
      String(data.name).trim(),
      String(data.email).trim().toLowerCase(),
      String(data.team1).trim(),
      String(data.team2).trim(),
      String(data.team3).trim(),
      String(data.team4).trim(),
      String(data.team5).trim(),
      String(data.team6).trim(),
      String(data.tod).trim(),
    ]);

    return jsonResponse({ success: true, message: 'Entry recorded!' });

  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse({ success: false, error: err.message });
  }
}

/**
 * Optional: GET handler returns all entries as JSON.
 * Not used by default (leaderboard uses published CSV instead),
 * but useful for debugging.
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ entries: [], count: 0 });
    }

    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return jsonResponse({ entries: [], count: 0 });
    }

    const headers = values[0];
    const entries = values.slice(1).map(row => {
      const entry = {};
      headers.forEach((h, i) => { entry[String(h).toLowerCase().replace(/\s/g, '_')] = row[i]; });
      return entry;
    });

    return jsonResponse({ entries, count: entries.length });

  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ---- Helper ----
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * =============================================
 * HOW TO PUBLISH THE SHEET AS CSV
 * =============================================
 *
 * Once entries start coming in, publish the Entries sheet so the
 * leaderboard can read it:
 *
 * 1. In your Google Sheet, go to File → Share → Publish to web
 * 2. Under "Link", change the first dropdown to "Entries" (the sheet name)
 * 3. Change the second dropdown to "Comma-separated values (.csv)"
 * 4. Click "Publish" → copy the URL
 * 5. Paste it into Admin → "Google Sheets CSV URL"
 *
 * The URL will look like:
 * https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/pub?gid=SHEET_GID&single=true&output=csv
 *
 * IMPORTANT: The CSV URL is publicly accessible to anyone with the link.
 * Only share the leaderboard URL with pool participants, not the spreadsheet itself.
 */
