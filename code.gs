/**
 * J.A.R.V.I.S. — แชท AI ส่วนตัว จำบทสนทนาไว้ใน Google Sheet
 * (สร้าง Sheet อัตโนมัติครั้งแรกที่รัน ไม่ต้องสร้างเองก่อน)
 */

const JARVIS_PERSONA =
  'คุณคือ Jarvis ผู้ช่วย AI ส่วนตัวของผู้ใช้ พูดจาสุภาพ กระชับ ฉลาด มีมาดนิดๆ แบบ Jarvis ใน Iron Man ' +
  'หน้าที่หลักคือช่วยคิดและวางแผนเรื่องโค้ดกับผู้ใช้ ผู้ใช้อาจแนบภาพหน้าจอมาให้ดูด้วย ' +
  'ถ้ามีภาพแนบมา ให้ดูภาพประกอบคำถามเสมอ บอกสิ่งที่เห็นในภาพที่เกี่ยวข้องกับปัญหา ' +
  'สำคัญมาก: อย่ารีบเขียนโค้ดหรือรีบสรุปวิธีแก้ปัญหาทันทีถ้ายังไม่เข้าใจสิ่งที่ผู้ใช้ต้องการชัดเจน ' +
  'ให้ถามคำถามกลับเพื่อทำความเข้าใจก่อนเสมอถ้าข้อมูลยังไม่พอ ' +
  'ตอบเป็นภาษาไทยเสมอ (ยกเว้นโค้ด/ชื่อตัวแปรที่ต้องเป็นอังกฤษตามปกติ)';

function getKey_(name) {
  const key = PropertiesService.getScriptProperties().getProperty(name);
  if (!key) throw new Error('Missing Script Property: ' + name);
  return key;
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('J.A.R.V.I.S.')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------- ฐานข้อมูล (Google Sheet) ----------
function getDbSheet_() {
  let ssId = PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID');
  let spreadsheet;
  if (ssId) {
    spreadsheet = SpreadsheetApp.openById(ssId);
  } else {
    spreadsheet = SpreadsheetApp.create('Jarvis Chat Log');
    PropertiesService.getScriptProperties().setProperty('DB_SHEET_ID', spreadsheet.getId());
  }
  let sheet = spreadsheet.getSheetByName('ChatLog');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('ChatLog');
    sheet.appendRow(['timestamp', 'userId', 'role', 'text']);
  }
  return sheet;
}

function loadHistory(userId) {
  userId = userId || 'master';
  const sheet = getDbSheet_();
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  const messages = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1] === userId) messages.push({ role: rows[i][2], text: rows[i][3] });
  }
  return messages.slice(-40);
}

function clearHistory(userId) {
  userId = userId || 'master';
  const sheet = getDbSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === userId) sheet.deleteRow(i + 1);
  }
  return true;
}

// ---------- แชทหลัก ----------
function chatWithJarvis(userText, imageData, imageMimeType, userId) {
  userId = userId || 'master';
  const sheet = getDbSheet_();
  sheet.appendRow([new Date(), userId, 'user', userText]);

  const key = getKey_('GEMINI_API_KEY');
const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + key;

  // ส่งบทสนทนาล่าสุด 10 ข้อความให้ Gemini เพื่อให้จำบริบทได้ (ไม่ส่งทั้งหมดเพื่อประหยัด token)
  const recent = loadHistory(userId).slice(-10);
  const contents = recent.map(function (m, i) {
    const isLast = i === recent.length - 1;
    const parts = [{ text: m.text }];
    if (isLast && imageData) {
      parts.push({ inlineData: { mimeType: imageMimeType, data: imageData } });
    }
    return { role: m.role === 'model' ? 'model' : 'user', parts: parts };
  });

  const payload = {
    contents: contents,
    systemInstruction: { parts: [{ text: JARVIS_PERSONA }] }
  };

  const json = fetchWithRetry_(url, payload, {});
  const jarvisReply = json.candidates[0].content.parts[0].text;

  sheet.appendRow([new Date(), userId, 'model', jarvisReply]);
  return jarvisReply;
}

function fetchWithRetry_(url, payload, extraHeaders, maxRetries) {
  maxRetries = maxRetries || 3;
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: extraHeaders,
    muteHttpExceptions: true
  };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const text = response.getContentText();
    if (code === 200) return JSON.parse(text);
    if (code === 429 && attempt < maxRetries) {
      Utilities.sleep(Math.pow(2, attempt) * 2000);
      continue;
    }
    throw new Error('API error ' + code + ': ' + text);
  }
}
