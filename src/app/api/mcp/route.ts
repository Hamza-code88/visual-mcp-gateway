import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { executeMcpTool } from '@/lib/mcp-client';
import { groqChat, cleanGroqErrorMessage } from '@/lib/groq-model';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'dummy_groq_key',
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy_gemini_key'
});

const VALID_SERVERS = ['github', 'sqlite', 'postman', 'neo4j', 'brightdata', 'algolia'] as const;
type ServerId = (typeof VALID_SERVERS)[number] | 'general';

/**
 * Deterministic keyword routing. Runs BEFORE the Groq classifier so routing
 * still works when Groq is down, and so obvious prompts never fall through
 * to "general". Order matters: the most specific servers are checked first
 * (e.g. "search github repos" must hit github, not algolia's generic
 * "search"). Matching is case-insensitive and word-boundary aware.
 */
const KEYWORD_ROUTES: Array<{ server: ServerId; keywords: string[] }> = [
  { server: 'github', keywords: ['github', 'repo', 'repository', 'commit', 'branch', 'pull request'] },
  { server: 'neo4j', keywords: ['neo4j', 'cypher', 'graph'] },
  { server: 'brightdata', keywords: ['brightdata', 'bright data', 'scrape', 'scraping', 'fetch url', 'fetch this url'] },
  { server: 'sqlite', keywords: ['sqlite', 'database', 'db ', 'sql', 'query', 'queries', 'table'] },
  { server: 'postman', keywords: ['postman', 'endpoint', 'api request'] },
  { server: 'algolia', keywords: ['algolia', 'search', 'logs', 'log', 'index', 'docs', 'documentation', 'error 500'] },
];

function keywordRoute(prompt: string): ServerId | null {
  const text = ` ${prompt.toLowerCase()} `;
  const hasWord = (kw: string) => {
    // Multi-word keywords: plain substring. Single words: word boundaries
    // with an optional plural suffix, so "repos" matches "repo", "tables"
    // matches "table" and "indexes" matches "index" — but "db" never
    // matches "debug" and "api" never matches "rapid".
    if (kw.includes(' ')) return text.includes(kw);
    return new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?\\b`).test(text);
  };
  for (const route of KEYWORD_ROUTES) {
    if (route.keywords.some(hasWord)) return route.server;
  }
  return null;
}

/**
 * Friendly, specific error text for the user. Never includes raw JSON and
 * never blames the wrong thing (the old message blamed the user's token and
 * the GitHub server for every failure, including Groq model errors).
 */
function friendlyErrorMessage(error: any, server: string): string {
  const raw = String(error?.message || '');
  // Tool-specific failures MUST be checked before the generic Groq-model
  // check below: an Algolia 404 says "Index system_logs does not exist",
  // and that phrase used to match the model check and get misreported as
  // "Groq model not found" — the exact bug seen in the 11:30 live test.
  const missingIndex = raw.match(/Index (\S+) does not exist/i);
  if (missingIndex) {
    return `Algolia index '${missingIndex[1]}' tumhare Algolia account mein maujood nahi hai. Algolia dashboard mein ye index banao (aur usmein data daalo), phir dobara try karein.`;
  }
  if (/Algolia Search Failed/i.test(raw)) {
    return 'Algolia search fail ho gayi. Application ID / API Key aur index name check karein.';
  }
  if (/Bright Data Fetch Failed/i.test(raw)) {
    return 'Bright Data fetch fail ho gaya. Proxy URL aur target URL check karein.';
  }
  if (/Neo4j query failed/i.test(raw)) {
    return 'Neo4j query fail ho gayi. Connection string aur Cypher query check karein.';
  }
  // Tightened: a bare 404 or "does not exist" is not enough — the message
  // must actually mention the model, or it is some other service's 404.
  if (
    raw.includes('model_not_found') ||
    /the model .* does not exist/i.test(raw) ||
    (error?.status === 404 && /model/i.test(raw))
  ) {
    return 'AI model abhi available nahi hai (Groq model not found). Please thodi der baad dobara try karein.';
  }
  if (
    error?.status === 401 ||
    raw.includes('401') ||
    /invalid api key|authentication/i.test(raw) ||
    /GROQ_API_KEY/i.test(raw)
  ) {
    return 'Groq API key missing ya galat hai. Vercel env vars ya .env.local mein GROQ_API_KEY check karein.';
  }
  if (error?.status === 429 || raw.includes('429') || /rate limit/i.test(raw)) {
    return 'Rate limit exceed ho gaya hai. Thodi der baad dobara try karein.';
  }
  if (raw.includes('No server configured')) {
    return `Is tool ke liye koi MCP server configured nahi hai (${server}).`;
  }
  // Tool-specific failures are already checked at the top of this function
  // (before the Groq-model check), so a failed Algolia fetch is never
  // misreported as a local-server problem here either.
  if (/ECONNREFUSED|connect ECONNREFUSED|Failed to fetch|fetch failed/i.test(raw)) {
    // Only local MCP servers (GitHub/SQLite/Postman) run on localhost.
    if (['github', 'sqlite', 'postman'].includes(server)) {
      return `MCP server se connect nahi ho pa raha (${server}). Agar ye local server hai to check karein ke wo chal raha hai.`;
    }
    return `Service se connect nahi ho pa raha (${server}). Please settings check karein ya dobara try karein.`;
  }
  return `Tool run karte waqt error aaya (${server}). Please settings check karein ya dobara try karein.`;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, tokens = {}, overrideServer } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let targetServer: ServerId = 'general';

    if (overrideServer && (VALID_SERVERS as readonly string[]).includes(overrideServer)) {
      targetServer = overrideServer;
    } else {
      // 1. Keyword routing first (deterministic, works even if Groq is down)
      targetServer = keywordRoute(prompt) || 'general';

      // 2. Only ask Groq to classify when no keyword matched
      if (targetServer === 'general') {
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
          const classificationResponse = await groqChat(groq, {
            messages: [{ role: 'user', content: classificationPrompt }],
            temperature: 0,
            max_tokens: 10,
          });
          const classified = (classificationResponse.choices[0]?.message?.content || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          if ((VALID_SERVERS as readonly string[]).includes(classified)) {
            targetServer = classified as ServerId;
          }
        } catch (e) {
          console.error('Groq classification failed, staying on general', cleanGroqErrorMessage(e));
        }
      }
    }

    // 3. Fetch context from the targeted MCP server
    let mcpContext = '';
    let usedMockFallback = false;

    try {
      if (targetServer !== 'general') {
        // Every tool needs its own key/token in Settings. Say so clearly
        // instead of running the tool and failing with a cryptic MCP error.
        // (GitHub also accepts a server-side GITHUB_PERSONAL_ACCESS_TOKEN.)
        const TOOL_LABELS: Record<string, string> = {
          github: 'GitHub',
          sqlite: 'Local SQLite',
          postman: 'Postman API',
          neo4j: 'Neo4j Graph',
          brightdata: 'Bright Data',
          algolia: 'Algolia Search',
        };
        const hasTokenFor = (server: string) => {
          if (server === 'github') return !!(tokens[server] || process.env.GITHUB_PERSONAL_ACCESS_TOKEN);
          return !!String(tokens[server] || '').trim();
        };
        if (!hasTokenFor(targetServer)) {
          return NextResponse.json({
            result: `${TOOL_LABELS[targetServer]} ke liye key/token settings mein nahi hai. Gear icon se ${TOOL_LABELS[targetServer]} Settings khol kar apni key daalein, phir dobara try karein.`,
            classification: targetServer
          });
        }
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
        result: friendlyErrorMessage(error, targetServer),
        classification: targetServer
      });
    }

    // 4. Synthesis
    let synthesis = '';

    if (usedMockFallback) {
        // Only synthesize with Groq if we fell back to general
        try {
          const systemInstruction = `You are a friendly AI assistant in a Visual MCP Gateway.
CRITICAL RULES:
1. Reply in the same language as the user (e.g. Roman Urdu).
2. DO NOT output any Python code, JSON, or function calls.
3. Keep it brief.
Here is the context: ${mcpContext}`;

          const synthesisRes = await groqChat(groq, {
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
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
