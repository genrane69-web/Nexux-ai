/**
 * J.A.R.V.I.S. — ผู้ช่วยแชท AI ส่วนตัว พร้อมระบบ Persistence Memory (Google Sheets)
 * Architecture: Option B (Save All, Context Light)
 */

const JARVIS_PERSONA =
  'คุณคือ Jarvis ผู้ช่วย AI ส่วนตัวของผู้ใช้ พูดจาสุภาพ กระชับ ฉลาด มีมาดนิดๆ แบบ Jarvis ใน Iron Man ' +
  'หน้าที่หลักคือช่วยคิดและวางแผนเรื่องโค้ดกับผใช้ ผู้ใช้อาจแนบภาพหน้าจอมาให้ดูด้วย ' +
  'ถ้ามีภาพแนบมา ใหดูภาพประกอบคำถามเสมอ บอกสิ่งที่เห็นในภาพที่เกี่ยวข้องกับปัญหา ' +
  'สำคัญมาก: อย่ารีบเขียนโค้ดหรือรีบสรุปวิธีแก้ปัญหาทันทีถายังไม่เข้าใจสิ่งที่ผู้ใช้ต้องการชัดเจน ' +
  'ให้ถามคำถามกลับเพื่อทความเข้าใจก่อนเสมอถ้าข้อมูลยังไม่พอ ' +
  'ตอบเป็นภาษาไทยเสมอ (ยกเว้นโค้ด/ชื่อตัวแปรที่ต้องเป็นอังกฤษตามปกติ)';

// ดึงค่าจาก Script Properties
function getKey_(name) {
  const key = PropertiesService.getScriptProperties().getProperty(name);
  if (!key) throw new Error('Missing Script Property: ' + name);
  return key;
}

// เชื่อมต่อ Sheet ฐานข้อมูล
function getDbSheet_() {
  const sheetId = getKey_('SPREADSHEET_ID');
  return SpreadsheetApp.openById(sheetId).getActiveSheet();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('J.A.R.V.I.S.')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * ฟังก์ชันหลักในการรับ-ส่งข้อความ
 * บันทึกลง Sheet แต่ส่งเฉพาะ Prompt ปัจจุบันให้ Gemini เพื่อความเร็วและประหยัด Token
 */
function chatWithJarvis(userText, imageData, imageMimeType, userId = 'master') {
  const sheet = getDbSheet_();

  // 1. บันทึกข้อความของผู้ใช้ลง Sheet (Database)
  sheet.appendRow([new Date(), userId, 'user', userText]);

  // 2. เตรียมข้อมูลส่งให้ Gemini (ส่งเฉพาะข้อความล่าสุดตาม Option B)
  const key = getKey_('GEMINI_API_KEY');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=' + key;

  const userPart = [{ text: userText }];
  if (imageData) {
    userPart.push({ inlineData: { mimeType: imageMimeType, data: imageData } });
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts: userPart
      }
    ],
    systemInstruction: { parts: [{ text: JARVIS_PERSONA }] }
  };

  // 3. เรียก API และรับคำตอบ
  const json = fetchWithRetry_(url, payload, {});
  const jarvisReply = json.candidates[0].content.parts[0].text;

  // 4. บันทึกคำตอบของ Jarvis ลง Sheet
  sheet.appendRow([new Date(), userId, 'model', jarvisReply]);

  return jarvisReply;
}

/**
 * ฟังก์ชันค้นหาอดีต (เตรียมไว้ใช้ในอนาคต เมื่อต้องการให้ Jarvis ค้นความจำ)
 */
function searchMemory(keyword, userId = 'master') {
  const sheet = getDbSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  return data.filter(row => row[1] === userId && row[3].toString().includes(keyword));
}

/**
 * ฟังก์ชันลบความทรงจำของผู้ใช้ (สั่งรันจากใน Script หรือทำระบบสั่งลบได้)
 */
function clearChatHistory(userId = 'master') {
  const sheet = getDbSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return true;

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i][1] === userId) {
      sheet.deleteRow(i + 2);
    }
  }
  return true;
}

function fetchWithRetry_(url, payload, extraHeaders, maxRetries = 3) {
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