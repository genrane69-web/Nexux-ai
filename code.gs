/**
 * JARVIS CODING PIPELINE — 4 agents, 4 free providers
 * 1) Analyzer -> Gemini (gemini-2.5-flash)
 * 2) Planner  -> Groq (llama-3.3-70b-versatile)
 * 3) Coder    -> OpenRouter (qwen/qwen3-coder:free)
 * 4) Reviewer -> Gemini (gemini-2.5-flash-lite)
 *
 * SETUP:
 * 1. Get free keys: aistudio.google.com/apikey , console.groq.com/keys , openrouter.ai/keys
 * 2. Project Settings > Script Properties, add:
 *    GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY
 * 3. Run testPipeline() and check Logs
 */

function getKey_(name) {
  const key = PropertiesService.getScriptProperties().getProperty(name);
  if (!key) throw new Error('Missing Script Property: ' + name);
  return key;
}

function runJarvisPipeline(userRequest) {
  const analysis = analyzeProblem_(userRequest);
  const plan = planFix_(analysis);
  const code = writeCode_(plan);
  const review = reviewCode_(code);
  return { analysis: analysis, plan: plan, code: code, review: review };
}

function testPipeline() {
  const result = runJarvisPipeline('ปุ่มบันทึกในฟอร์ม HTML ของฉันกดแล้วไม่บันทึกข้อมูลลง Google Sheet');
  Logger.log(JSON.stringify(result, null, 2));
}

function analyzeProblem_(userRequest) {
  const prompt = 'คุณคือผู้ช่วยวิเคราะห์ปัญหาโค้ด อ่านคำขอนี้แล้วสรุปสั้นๆ ว่า 1) ปัญหาคืออะไร 2) น่าจะเกี่ยวข้องกับส่วนไหนของโค้ด ไม่ต้องเขียนโค้ด แค่วิเคราะห์เท่านั้น\n\nคำขอ: ' + userRequest;
return callGemini_(prompt, 'gemini-3.6-flash');
}

function planFix_(analysis) {
  const prompt = 'คุณคือผู้ช่วยวางแผนแก้โค้ด จากการวิเคราะห์นี้ ให้วางแผนเป็นข้อๆ ว่าต้องทำอะไรบ้าง ไม่ต้องเขียนโค้ดจริง\n\nการวิเคราะห์: ' + analysis;
  return callGroq_(prompt, 'llama-3.3-70b-versatile');
}

function writeCode_(plan) {
  const prompt = 'คุณคือโปรแกรมเมอร์ เขียนโค้ดตามแผนนี้ให้ครบถ้วน ใส่คอมเมนต์อธิบายสั้นๆ\n\nแผน: ' + plan;
return callOpenRouter_(prompt, 'openai/gpt-oss-20b:free');
}

function reviewCode_(code) {
  const prompt = 'คุณคือผู้ตรวจโค้ด ตรวจโค้ดนี้หาบั๊กหรือจุดที่ควรปรับปรุง สรุปเป็นข้อๆ ถ้าดีอยู่แล้วตอบว่า "ผ่าน"\n\nโค้ด: ' + code;
return callGemini_(prompt, 'gemini-3.5-flash-lite');
}

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
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), headers: extraHeaders, muteHttpExceptions: true };
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
