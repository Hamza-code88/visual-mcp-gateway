import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { groqChat } from '@/lib/groq-model';

// Initialize the Groq client. Make sure to add GROQ_API_KEY to your .env.local file
const groq = new Groq({
  // Dummy fallback so the module loads (and the build passes) without a key;
  // real calls fail with a clear auth error instead of crashing the build.
  apiKey: process.env.GROQ_API_KEY || 'dummy_groq_key',
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const chatCompletion = await groqChat(groq, {
      messages: [{ role: 'user', content: prompt }],
    });

    return NextResponse.json({ result: chatCompletion.choices[0]?.message?.content || '' });
  } catch (error: any) {
    console.error('Groq API Error:', error);
    return NextResponse.json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}
