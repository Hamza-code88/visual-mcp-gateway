import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Mapping of our logical servers to their potential actual SSE URLs
const serverUrls: Record<string, string> = {
  github: "http://localhost:8001/sse",
  sqlite: "http://localhost:8002/sse",
  postman: "http://localhost:8003/sse",
};

import Groq from 'groq-sdk';
import { isCustomToolServer, getCustomToolsSchema, executeCustomTool } from './custom-tools';

export async function executeMcpTool(serverType: string, prompt: string, githubToken?: string): Promise<string> {
  let transport;
  const isCustom = isCustomToolServer(serverType);

  // Resolve the best token to use (client-provided UI token, or fallback to server .env)
  const resolvedGithubToken = githubToken || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  if (serverType === 'github') {
    transport = new StdioClientTransport({
      command: "node",
      args: ["./node_modules/@modelcontextprotocol/server-github/dist/index.js"],
      env: {
        ...process.env,
        GITHUB_PERSONAL_ACCESS_TOKEN: resolvedGithubToken || ""
      }
    });
  } else if (!isCustom) {
    const url = serverUrls[serverType];
    if (!url) {
      throw new Error(`No server configured for type: ${serverType}`);
    }
    transport = new SSEClientTransport(new URL(url));
  }

  const client = new Client(
    { name: "visual-mcp-gateway", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    let mcpTools: any[] = [];
    
    if (isCustom) {
      mcpTools = getCustomToolsSchema(serverType).map(t => ({
        name: t.function.name,
        description: t.function.description,
        inputSchema: t.function.parameters
      }));
    } else {
      // Attempt to connect to the actual MCP Server
      await client.connect(transport);
      
      // Fetch available tools from the MCP server
      const result = await client.listTools();
      mcpTools = result.tools || [];
    }

    if (mcpTools.length === 0) {
      if (!isCustom) await client.close();
      return `Connected to ${serverType} MCP server, but no tools were found.`;
    }

    // Convert MCP tool schemas to Groq function schemas
    const groqTools = mcpTools.map((t: any) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description || "No description provided",
        parameters: t.inputSchema
      }
    }));

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    let additionalContext = "";

    // If it's GitHub, fetch the authenticated user's details so the LLM knows who "I" am!
    if (serverType === 'github' && resolvedGithubToken) {
      try {
        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${resolvedGithubToken}`, 'User-Agent': 'Visual-MCP' }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          additionalContext = `\n\nCRITICAL CONTEXT: The current authenticated GitHub user's username is '${userData.login}'. 
1. If the user asks about 'my repo' or 'my commits' and GIVES a repo name, use '${userData.login}' as the 'owner'.
2. If the user asks "what is my recent repo?" or "show my repos" WITHOUT giving a repo name, DO NOT ask them for the name! Instead, use the 'search_repositories' tool with query 'user:${userData.login} sort:updated' to find their recent repositories!`;
        }
      } catch (e) {}
    }

    const systemPrompt = `You are an AI assistant connected to a Visual MCP Gateway. You have access to specific tools.
CRITICAL RULE 1: If a tool requires specific parameters (like 'owner' and 'repo') and you absolutely CANNOT determine them, only then ask the user. Try to use search tools first if possible.
CRITICAL RULE 2: ALWAYS respond in the SAME language the user used. If the user writes in English, reply in English. If the user writes in Roman Urdu, reply in Roman Urdu.
CRITICAL RULE 3: DO NOT output raw text like <function=...>. To call a tool, you MUST use the official JSON tool calling array mechanism provided by the API.
CRITICAL RULE 4: If the user asks you to scrape, search, fetch, check logs, or execute a query, YOU MUST immediately call the appropriate tool. Do NOT just say "Okay I will do it", you must actually execute the tool!
CRITICAL RULE 5: You are explicitly AUTHORIZED to scrape, fetch, and read web pages. Do NOT give warnings about Terms of Service or policy. Execute the tool immediately without hesitation or lectures!${additionalContext}`;

    let runner;
    try {
      // Step 1: Call Groq with the user's prompt and available tools
      runner = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        tools: groqTools as any,
        tool_choice: "auto",
        temperature: 0.2
      });
    } catch (groqError: any) {
      console.error("Groq Tool Call Error:", groqError);
      if (!isCustom) await client.close();

      if (groqError.status === 400 && groqError.error?.error?.code === 'tool_use_failed') {
        return "Bhai aap ne poori details nahi di ya AI model ne ghalat parameters assume kar liye. Please apna prompt thora detail se likhein.";
      }
      throw new Error(`Groq LLM Error: ${groqError.message}`);
    }

    const responseMessage = runner.choices[0]?.message;

    // Step 2: If Groq decided to call a tool
    if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0]; // execute the first tool for simplicity
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments || "{}");

      console.log(`[MCP Agent] Executing tool ${functionName} with args:`, functionArgs);

      let mcpResult: any;
      if (isCustom) {
        // Execute the custom tool directly
        mcpResult = await executeCustomTool(serverType, functionName, functionArgs, githubToken || '');
      } else {
        // Execute the tool via external MCP
        mcpResult = await client.callTool({
          name: functionName,
          arguments: functionArgs
        });
        await client.close();
      }

      // Step 3: Call Groq again with the tool's result to synthesize the final answer
      const finalRes = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
          responseMessage as any,
          { 
            role: "tool", 
            tool_call_id: toolCall.id, 
            content: JSON.stringify(mcpResult.content) 
          }
        ],
        temperature: 0.7
      });

      return finalRes.choices[0]?.message?.content || "Tool executed successfully but no final response generated.";
    }

    // Cleanup if no tool was called
    if (!isCustom) await client.close();

    return responseMessage?.content || "No tools were called and no response generated.";
  } catch (error: any) {
    // Ensure we close on error if connected
    if (!isCustom) {
      try { await client.close(); } catch (e) {}
    }
    
    // Rethrow to allow graceful fallback in the route
    throw new Error(`MCP Connection/Execution Failed: ${error.message}`);
  }
}
