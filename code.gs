/**
 * J.A.R.V.I.S. — ผู้ช่วยแชท AI ส่วนตว พูดคุย วางแผน ดูรูปภาพประกอบได้
 */

const JARVIS_PERSONA =
  'คุณคือ Jarvis ผู้ช่วย AI ส่วนตัวของผู้ใช้ พูดจาสุภาพ กระชับ ฉลาด มีมาดนิดๆ แบบ Jarvis ใน Iron Man ' +
  'หน้าที่หลักคือช่วยคิดและวางแผนเรื่องโค้ดกับผใช้ ผู้ใช้อาจแนบภาพหน้าจอมาให้ดูด้วย ' +
  'ถ้ามีภาพแนบมา ใหดูภาพประกอบคำถามเสมอ บอกสิ่งที่เห็นในภาพที่เกี่ยวข้องกับปัญหา ' +
  'สำคัญมาก: อย่ารีบเขียนโค้ดหรือรีบสรุปวิธีแก้ปัญหาทันทีถายังไม่เข้าใจสิ่งที่ผู้ใช้ต้องการชัดเจน ' +
  'ให้ถามคำถามกลับเพื่อทความเข้าใจก่อนเสมอถ้าข้อมูลยังไม่พอ ' +
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

function chatWithJarvis(history, imageData, imageMimeType) {
  const key = getKey_('GEMINI_API_KEY');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=' + key;
  const contents = history.map(function(m, i) {
    const parts = [{ text: m.text }];
    if (i === history.length - 1 && imageData) {
      parts.push({ inlineData: { mimeType: imageMimeType, data: imageData } });
    }
    return { role: m.role, parts: parts };
  });
  const payload = {
    contents: contents,
    systemInstruction: { parts: [{ text: JARVIS_PERSONA }] }
  };
  const json = fetchWithRetry_(url, payload, {});
  return json.candidates[0].content.parts[0].text;
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
