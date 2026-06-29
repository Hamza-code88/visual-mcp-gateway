import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import fs from 'fs';

// Load .env.local manually
try {
  const envFile = fs.readFileSync('.env.local', 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
} catch (err) {
  console.log("Error reading .env.local file");
}

async function testKeys() {
  console.log("🔍 API Keys ki Testing shuru ho rahi hai...\n");

  // 1. Test Groq
  console.log("➡️ 1. Groq API Key test kar rahe hain...");
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const groqRes = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Say exactly: "Groq is working perfectly!"' }],
      model: 'llama-3.1-8b-instant',
    });
    console.log("✅ Groq Success! Response:", groqRes.choices[0]?.message?.content);
  } catch (e) {
    console.log("❌ Groq Failed:", e.message);
  }

  console.log("\n--------------------------------------------------\n");

  // 2. Test Gemini
  console.log("➡️ 2. Gemini API Key test kar rahe hain...");
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const geminiRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Say exactly: "Gemini is working perfectly!"',
    });
    console.log("✅ Gemini Success! Response:", geminiRes.text);
  } catch (e) {
    console.log("❌ Gemini Failed:", e.message);
  }
}

testKeys();
