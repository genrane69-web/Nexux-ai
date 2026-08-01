/**
 * J.A.R.V.I.S. — แชทวางแผนก่อน + Pipeline 4 เอเจนต์ (กดลงมือทำเมื่อพร้อม) + เก็บเรื่องสำคัญแยกชีท
 */

const JARVIS_PERSONA =
  'คุณคือ Jarvis ผู้ช่วย AI ส่วนตัวของผู้ใช้ พูดจาสุภาพ กระชับ ฉลาด มีมาดนิดๆ แบบ Jarvis ใน Iron Man ' +
  'หน้าที่หลักคือช่วยคิดและวางแผนเรื่องโค้ดกับผู้ใช้ ผู้ใช้อาจแนบภาพหน้าจอมาให้ดูด้วย ' +
  'ถ้ามีภาพแนบมา ให้ดูภาพประกอบคำถามเสมอ บอกสิ่งที่เห็นในภาพที่เกี่ยวข้องกับปัญหา ' +
  'สำคัญมาก: อย่ารีบเขียนโค้ดหรือรีบสรุปวิธีแก้ปัญหาทันทีถ้ายังไม่เข้าใจสิ่งที่ผู้ใช้ต้องการชัดเจน ' +
  'ให้ถามคำถามกลับเพื่อทำความเข้าใจก่อนเสมอถ้าข้อมูลยังไม่พอ เมื่อเข้าใจชัดพอแล้วให้บอกผู้ใช้ว่าพร้อมกดปุ่ม "ลงมือทำ" ได้เลย ' +
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
function getSpreadsheet_() {
  let ssId = PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID');
  let spreadsheet;
  if (ssId) {
    spreadsheet = SpreadsheetApp.openById(ssId);
  } else {
    spreadsheet = SpreadsheetApp.create('Jarvis Chat Log');
    PropertiesService.getScriptProperties().setProperty('DB_SHEET_ID', spreadsheet.getId());
  }
  return spreadsheet;
}

function getDbSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName('ChatLog');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('ChatLog');
    sheet.appendRow(['timestamp', 'userId', 'role', 'text']);
  }
  return sheet;
}

function getImportantSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName('Important');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Important');
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

function saveImportant(text, role, userId) {
  userId = userId || 'master';
  const sheet = getImportantSheet_();
  sheet.appendRow([new Date(), userId, role || 'user', text]);
  return true;
}

function loadImportant(userId) {
  userId = userId || 'master';
  const sheet = getImportantSheet_();
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  const items = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1] === userId) items.push({ role: rows[i][2], text: rows[i][3] });
  }
  return items;
}

function callChatWithFallback_(prompt, imageData, imageMimeType) {
  const attempts = [
    { name: 'Gemini', fn: function () { return callGeminiChat_(prompt, imageData, imageMimeType); } },
    { name: 'Groq', fn: function () { return callGroq_(prompt, 'llama-3.3-70b-versatile'); } },
    { name: 'Mistral', fn: function () { return callMistral_(prompt, 'mistral-small-latest'); } },
    { name: 'OpenRouter', fn: function () { return callOpenRouter_(prompt, 'openai/gpt-oss-20b:free'); } }
  ];
  let lastError;
  for (let i = 0; i < attempts.length; i++) {
    try {
      const reply = attempts[i].fn();
      if (i === 0) return reply;
      return '⚠️ (สลับไปใช้ ' + attempts[i].name + ' แทน เพราะช่องทางก่อนหน้าเต็มโควตา)\n\n' + reply;
    } catch (e) {
      Logger.log(attempts[i].name + ' ใช้งานไม่ได้: ' + e.message);
      lastError = e;
    }
  }
  throw new Error('ทุกช่องทางเต็มโควตาวันนี้หมดแล้ว ลองใหม่พรุ่งนี้ครับ: ' + lastError.message);
}

// ---------- PIPELINE 4 เอเจนต์ (เรียกเมื่อกด "ลงมือทำ" เท่านั้น) ----------
function executeFromChat(userId) {
  userId = userId || 'master';
  const recent = loadHistory(userId).slice(-14);
  const transcript = recent.map(function (m) {
    return (m.role === 'model' ? 'Jarvis' : 'ผู้ใช้') + ': ' + m.text;
  }).join('\n');
  return runJarvisPipeline(transcript);
}

function runJarvisPipeline(userRequest) {
  const analysis = analyzeProblem_(userRequest);
  const plan = planFix_(analysis);
  const code = writeCode_(plan);
  const review = reviewCode_(code);
  return { analysis: analysis, plan: plan, code: code, review: review };
}

function analyzeProblem_(userRequest) {
  const prompt =
    'ตอบเป็นภาษาไทยทั้งหมด คุณคือผู้ช่วยวิเคราะห์ปัญหาโค้ด อ่านบทสนทนานี้แล้วสรุปสั้นๆ ว่า ' +
    '1) ผู้ใช้ต้องการอะไรกันแน่ 2) เกี่ยวข้องกับส่วนไหนของโค้ด ' +
    'ไม่ต้องเขียนโค้ด แค่วิเคราะห์เท่านั้น\n\nบทสนทนา:\n' + userRequest;
  return callGemini_(prompt, 'gemini-3.5-flash-lite');
}

function planFix_(analysis) {
  const prompt =
    'ตอบเป็นภาษาไทยทั้งหมด คุณคือผู้ช่วยวางแผนแก้โค้ด จากการวิเคราะห์นี้ ให้วางแผนเป็นข้อๆ ' +
    'ว่าต้องทำอะไรบ้างเพื่อให้ได้ตามที่ผู้ใช้ต้องการ ไม่ต้องเขียนโค้ดจริง แค่วางแผนขั้นตอน\n\n' +
    'การวิเคราะห์: ' + analysis;
  return callGroq_(prompt, 'llama-3.3-70b-versatile');
}

function writeCode_(plan) {
  const prompt =
    'สำคัญ: คอมเมนต์และคำอธิบายทุกจุดในโค้ดต้องเป็นภาษาไทยเท่านั้น ' +
    '(ชื่อตัวแปร/ฟังก์ชัน/คำสั่งโปรแกรมยังเป็นอังกฤษได้ตามปกติ) ' +
    'คุณคือโปรแกรมเมอร์ เขียนโค้ดตามแผนนี้ให้ครบถ้วน\n\nแผน: ' + plan;
  return callOpenRouter_(prompt, 'openai/gpt-oss-20b:free');
}

function reviewCode_(code) {
  const prompt =
    'ตอบเป็นภาษาไทยทั้งหมด คุณคือผู้ตรวจโค้ด ตรวจโค้ดนี้หาบั๊กหรือจุดที่ควรปรับปรุง ' +
    'สรุปเป็นข้อๆ สั้นๆ ถ้าโค้ดใช้ได้ดีอยู่แล้วให้ตอบว่า "ผ่าน"\n\nโค้ด: ' + code;
  return callGemini_(prompt, 'gemini-3.5-flash-lite');
}

// ---------- PROVIDERS ----------
function callGemini_(prompt, model) {
  const key = getKey_('GEMINI_API_KEY');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  const json = fetchWithRetry_(url, payload, {});
  return json.candidates[0].content.parts[0].text;
}

function callGroq_(prompt, model) {
  const key = getKey_('GROQ_API_KEY');
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const payload = { model: model, messages: [{ role: 'user', content: prompt }] };
  const json = fetchWithRetry_(url, payload, { Authorization: 'Bearer ' + key });
  return json.choices[0].message.content;
}

function callOpenRouter_(prompt, model) {
  const key = getKey_('OPENROUTER_API_KEY');
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const payload = { model: model, messages: [{ role: 'user', content: prompt }] };
  const json = fetchWithRetry_(url, payload, { Authorization: 'Bearer ' + key });
  return json.choices[0].message.content;
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
