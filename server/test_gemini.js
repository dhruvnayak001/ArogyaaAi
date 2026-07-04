require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing with API Key ending in:', apiKey.slice(-5));
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash'];
  
  for (const modelName of models) {
    console.log(`\nTesting model: ${modelName}`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say hello');
      console.log(`Success with ${modelName}! Response:`, result.response.text());
      return; // Stop on first success
    } catch (error) {
      console.error(`Failed with ${modelName}:`, error.message);
    }
  }
}

test();
