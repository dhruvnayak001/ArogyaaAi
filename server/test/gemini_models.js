require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];

async function test() {
  for (const m of models) {
    try {
      const model = ai.getGenerativeModel({ model: m });
      const r = await model.generateContent('Say WORKING');
      console.log(`✅ ${m}: ${r.response.text().slice(0,40)}`);
    } catch (e) {
      console.log(`❌ ${m}: ${e.message.slice(0,80)}`);
    }
  }
}
test();
