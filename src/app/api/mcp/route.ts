import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { executeMcpTool } from '@/lib/mcp-client';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'dummy_groq_key',
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy_gemini_key'
});

export async function POST(req: NextRequest) {
  try {
    const { prompt, tokens = {}, overrideServer } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let targetServer = 'general';
    
    if (overrideServer) {
      targetServer = overrideServer;
    } else {
      // 1. Classify the prompt using Groq (to decide which server to route to)
      const classificationPrompt = `Classify this prompt into one of these categories: 'github', 'sqlite', 'postman', 'neo4j', 'brightdata', 'algolia', or 'general'. 
  Consider Roman Urdu prompts too. 
  - Words like 'commit', 'repo', 'code', 'github', 'branch' -> 'github'.
  - Words like 'db', 'database', 'sql', 'query', 'table' -> 'sqlite'.
  - Words like 'api', 'request', 'postman', 'endpoint' -> 'postman'.
  - Words like 'graph', 'node', 'relationship', 'neo4j' -> 'neo4j'.
  - Words like 'scrape', 'live', 'internet', 'brightdata', 'bright data', 'fetch url' -> 'brightdata'.
  - Words like 'search logs', 'algolia', 'index', 'docs', 'error 500' -> 'algolia'.
  Prompt: "${prompt}"
  Respond with ONLY the category name in lowercase.`;

      try {
        const classificationResponse = await groq.chat.completions.create({
          messages: [{ role: 'user', content: classificationPrompt }],
          model: 'llama-3.1-8b-instant',
          temperature: 0,
          max_tokens: 10,
        });
        targetServer = classificationResponse.choices[0]?.message?.content?.trim().toLowerCase() || 'general';
        targetServer = targetServer.replace(/[^a-z0-9]/g, '');
        if (!['github', 'sqlite', 'postman', 'neo4j', 'brightdata', 'algolia'].includes(targetServer)) targetServer = 'general';
      } catch (e) {
        console.error('Groq classification failed, fallback to general', e);
      }
    }
    
    // 2. Fetch context from the targeted MCP server
    let mcpContext = '';
    let usedMockFallback = false;
    
    try {
      if (targetServer !== 'general') {
        console.log(`[MCP Router] Attempting real connection to ${targetServer} MCP server...`);
        const targetToken = tokens[targetServer] || '';
        mcpContext = await executeMcpTool(targetServer, prompt, targetToken);
        console.log(`[MCP Router] Real MCP agent completed successfully.`);
      } else {
        mcpContext = 'Mujhe samajh nahi aaya ke aap kis tool ki baat kar rahe hain. Please GitHub, Database, ya API ka zikr karein.';
        usedMockFallback = true;
      }
    } catch (error: any) {
      console.error(`[MCP Router] Real MCP connection failed:`, error);
      // DO NOT FALLBACK TO MOCK DATA!
      return NextResponse.json({ 
        result: `🚨 Error: ${error.message}\n\nAapka token shayad galat hai, ya GitHub MCP server connect nahi ho pa raha. Please settings check karein.`,
        classification: targetServer
      });
    }

    // 3. Synthesis
    let synthesis = '';
    
    if (usedMockFallback) {
        // Only synthesize with Llama if we fell back to general
        try {
          const systemInstruction = `You are a friendly AI assistant in a Visual MCP Gateway.
CRITICAL RULES:
1. Reply in the same language as the user (e.g. Roman Urdu).
2. DO NOT output any Python code, JSON, or function calls.
3. Keep it brief.
Here is the context: ${mcpContext}`;
          
          const synthesisRes = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
            model: 'llama-3.1-8b-instant',
            temperature: 0.7,
          });
          synthesis = synthesisRes.choices[0]?.message?.content || 'No response generated.';
        } catch (e: any) {
          synthesis = mcpContext;
        }
    } else {
        // If real connection succeeded, the agent inside executeMcpTool already synthesized the final answer!
        synthesis = mcpContext;
    }

    return NextResponse.json({ 
      result: synthesis,
      classification: targetServer
    });

  } catch (error: any) {
    console.error('MCP Route Error:', error);
    return NextResponse.json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}
