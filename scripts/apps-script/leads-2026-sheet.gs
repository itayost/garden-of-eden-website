/**
 * Google Apps Script for the "לידים 2026" sheet.
 *
 * Sends every new row to POST /api/webhooks/leads and writes the outcome in
 * the status column, so each row is sent once. Runs every 5 minutes from a
 * time trigger (rows written by Meta/Zapier do not fire onEdit) and from the
 * sheet menu "לידים > שלח לידים עכשיו".
 *
 * Columns: A נוצר | B שם | C טלפון | D מחיפה? | E גיל | F הערות | G status
 *
 * Setup:
 *   1. Extensions > Apps Script, paste this file, save.
 *   2. Project Settings > Script Properties: add LEADS_API_KEY with the value
 *      of LEADS_WEBHOOK_API_KEY (the same key the old sheet uses).
 *   3. Run installTrigger once and approve the permissions.
 */

var WEBHOOK_URL = 'https://www.edengarden.co.il/api/webhooks/leads';
var TAB_SLUG = 'paid'; // "ממומנים" in the leads page
var SHEET_NAME = 'גיליון1';
var HEADER_ROWS = 1;

var COL = { name: 2, phone: 3, haifa: 4, age: 5, note: 6, status: 7 };
var STATUS_HEADER = 'סונכרן למערכת';
var MAX_ROWS_PER_RUN = 50;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('לידים')
    .addItem('שלח לידים עכשיו', 'syncLeads')
    .addToUi();
}

function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'syncLeads'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncLeads').timeBased().everyMinutes(5).create();
}

function syncLeads() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // a previous run is still going

  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty('LEADS_API_KEY');
    if (!apiKey) throw new Error('Missing script property LEADS_API_KEY');

    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    var lastRow = sheet.getLastRow();
    if (lastRow <= HEADER_ROWS) return;

    sheet.getRange(1, COL.status).setValue(STATUS_HEADER);

    var rows = sheet
      .getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, COL.status)
      .getValues();

    var sent = 0;
    for (var i = 0; i < rows.length && sent < MAX_ROWS_PER_RUN; i++) {
      var row = rows[i];
      if (String(row[COL.status - 1]).trim() !== '') continue;

      var rawPhone = String(row[COL.phone - 1]).trim();
      var rawName = String(row[COL.name - 1]).trim();
      if (rawPhone === '' && rawName === '') continue; // empty row

      var status = sendLead(row, apiKey);
      if (status) {
        sheet.getRange(HEADER_ROWS + 1 + i, COL.status).setValue(status + ' - ' + now());
      }
      sent++;
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Returns the text to write in the status column, or null to leave the row
 * empty and retry on the next run (server or network trouble).
 */
function sendLead(row, apiKey) {
  var phone = normalizePhone(row[COL.phone - 1]);
  if (!phone) return 'Error - טלפון לא תקין';

  var payload = {
    phone: phone,
    name: (String(row[COL.name - 1]).trim() || 'ללא שם').slice(0, 100),
    is_from_haifa: isYes(row[COL.haifa - 1]),
    tab_slug: TAB_SLUG,
  };
  var note = String(row[COL.note - 1]).trim();
  if (note) payload.note = note.slice(0, 2000);
  var birthYear = toBirthYear(row[COL.age - 1]);
  if (birthYear) payload.birth_year = birthYear;

  var response;
  try {
    response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error('Network error for ' + phone + ': ' + err);
    return null;
  }

  var code = response.getResponseCode();
  if (code === 201) return 'Created';
  if (code === 409) return 'Duplicate';
  if (code === 401) throw new Error('Unauthorized: check LEADS_API_KEY');
  if (code >= 500) {
    console.error('Server error ' + code + ' for ' + phone + ': ' + response.getContentText());
    return null;
  }
  return 'Error ' + code + ' - ' + response.getContentText().slice(0, 200);
}

/**
 * Accepts the shapes Meta and people write: 0541234567, 541234567,
 * +972541234567, 972541234567, +9720541234567, p:+972541234567.
 * Returns 972XXXXXXXXX or null.
 */
function normalizePhone(value) {
  var digits = String(value).replace(/\D/g, '');
  if (digits.indexOf('9720') === 0) digits = '972' + digits.slice(4);
  else if (digits.indexOf('0') === 0) digits = '972' + digits.slice(1);
  else if (digits.length === 9 && digits.indexOf('5') === 0) digits = '972' + digits;
  return /^9725\d{8}$/.test(digits) ? digits : null;
}

function isYes(value) {
  var v = String(value).trim().toLowerCase();
  return v === 'כן' || v === 'yes' || v === 'true' || value === true;
}

/** The age column may hold an age (12) or a birth year (2013). */
function toBirthYear(value) {
  var n = parseInt(String(value).replace(/\D/g, ''), 10);
  if (!n) return null;
  var year = n >= 1990 ? n : new Date().getFullYear() - n;
  return year >= 1990 && year <= 2030 ? year : null;
}

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'd.M.yyyy, HH:mm:ss');
}
