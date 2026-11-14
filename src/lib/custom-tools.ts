import neo4j from 'neo4j-driver';
import axios from 'axios';

export const isCustomToolServer = (serverType: string) => {
  // GitHub is a custom tool too: it talks to the GitHub REST API directly.
  // The old stdio MCP server (spawning a local node process) cannot work on
  // Vercel serverless — the server file is not in the function bundle.
  return ['github', 'neo4j', 'brightdata', 'algolia'].includes(serverType);
};

export const getCustomToolsSchema = (serverType: string) => {
  if (serverType === 'github') {
    return [
      {
        type: "function",
        function: {
          name: "search_repositories",
          description: "Search GitHub repositories by keyword. Use query 'user:<username> sort:updated' to find a user's most recent repositories.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query (e.g., 'user:Hamza-code88 sort:updated' or 'mcp gateway').",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "list_user_repos",
          description: "List a GitHub user's repositories, most recently updated first.",
          parameters: {
            type: "object",
            properties: {
              username: {
                type: "string",
                description: "The GitHub username.",
              },
            },
            required: ["username"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_repository",
          description: "Get details of one GitHub repository.",
          parameters: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "The repository owner (username or org).",
              },
              repo: {
                type: "string",
                description: "The repository name.",
              },
            },
            required: ["owner", "repo"],
          },
        },
      }
    ];
  }

  if (serverType === 'neo4j') {
    return [
      {
        type: "function",
        function: {
          name: "execute_cypher_query",
          description: "Execute a Neo4j Cypher query to retrieve or map graph relationships.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The Cypher query string to execute (e.g., MATCH (n) RETURN n LIMIT 5).",
              },
            },
            required: ["query"],
          },
        },
      }
    ];
  }

  if (serverType === 'brightdata') {
    return [
      {
        type: "function",
        function: {
          name: "fetch_web_content",
          description: "Fetch live web content or HTML from a specific URL using Bright Data Web Unlocker proxy.",
          parameters: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "The target URL to fetch data from.",
              },
            },
            required: ["url"],
          },
        },
      }
    ];
  }

  if (serverType === 'algolia') {
    return [
      {
        type: "function",
        function: {
          name: "search_logs",
          description: "Search system logs, documentation, or indices instantly using Algolia.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query (e.g., 'error 500' or 'database connection').",
              }
            },
            required: ["query"],
          },
        },
      }
    ];
  }

  return [];
};

export const executeCustomTool = async (serverType: string, functionName: string, args: any, token: string) => {
  if (serverType === 'github') {
    const headers: Record<string, string> = {
      'User-Agent': 'Visual-MCP',
      'Accept': 'application/vnd.github+json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const ghFetch = async (url: string) => {
      const res = await fetch(url, { headers });
      if (res.status === 401) throw new Error('GitHub token invalid or expired. Please check the token in Settings.');
      if (res.status === 403) {
        const remaining = res.headers.get('x-ratelimit-remaining');
        if (remaining === '0') throw new Error('GitHub API rate limit exceeded. Please try again later.');
        throw new Error('GitHub API access forbidden. Check the token scope (needs repo access).');
      }
      if (res.status === 404) throw new Error('GitHub resource not found. Check the owner/repo name.');
      if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
      return res.json();
    };

    const summarizeRepo = (r: any) => ({
      name: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      language: r.language,
      url: r.html_url,
      updated: r.updated_at,
    });

    if (functionName === 'search_repositories') {
      if (!args.query) throw new Error('Search query is required');
      const data = await ghFetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(args.query)}&sort=updated&per_page=5`);
      return { content: (data.items || []).map(summarizeRepo) };
    }

    if (functionName === 'list_user_repos') {
      if (!args.username) throw new Error('Username is required');
      const data = await ghFetch(`https://api.github.com/users/${encodeURIComponent(args.username)}/repos?sort=updated&per_page=10`);
      return { content: (Array.isArray(data) ? data : []).map(summarizeRepo) };
    }

    if (functionName === 'get_repository') {
      if (!args.owner || !args.repo) throw new Error('Owner and repo are required');
      const data = await ghFetch(`https://api.github.com/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}`);
      return { content: summarizeRepo(data) };
    }

    throw new Error('Unknown function');
  }

  if (serverType === 'neo4j') {
    if (functionName !== 'execute_cypher_query') throw new Error('Unknown function');
    
    // Parse token: neo4j://user:pass@host:7687
    let uri = token;
    let user = 'neo4j';
    let pass = 'password';
    try {
        const urlObj = new URL(token);
        user = urlObj.username || user;
        pass = urlObj.password || pass;
        uri = `${urlObj.protocol}//${urlObj.host}`;
    } catch(e) {}

    const driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
    const session = driver.session();
    try {
      const result = await session.run(args.query);
      const records = result.records.map((record: any) => {
        const obj: any = {};
        record.keys.forEach((key: string) => {
            const val = record.get(key);
            obj[key] = val?.properties || val; 
        });
        return obj;
      });
      return { content: records };
    } catch (e: any) {
      // No dummy fallback: never present fake graph data as a real result.
      throw new Error(`Neo4j query failed: ${e.message}`);
    } finally {
      await session.close();
      await driver.close();
    }
  }

  if (serverType === 'brightdata') {
    if (functionName !== 'fetch_web_content') throw new Error('Unknown function');
    
    // Token format: http://brd-customer-x:pass@host:port
    let proxyOpts = undefined;
    try {
      const urlObj = new URL(token);
      proxyOpts = {
        protocol: urlObj.protocol.replace(':', ''),
        host: urlObj.hostname,
        port: parseInt(urlObj.port),
        auth: {
          username: urlObj.username,
          password: urlObj.password
        }
      };
    } catch(e) {}

    try {
      if (!args.url) throw new Error("URL is required");
      
      const res = await axios.get(args.url, {
        proxy: proxyOpts,
        timeout: 30000,
      });
      
      let html = String(res.data);
      // Strip scripts and styles
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
      html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
      // Strip all HTML tags
      let textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      
      return { content: textContent.substring(0, 6000) + '...' }; 
    } catch (e: any) {
      throw new Error(`Bright Data Fetch Failed: ${e.message}`);
    }
  }

  if (serverType === 'algolia') {
    if (functionName !== 'search_logs') throw new Error('Unknown function');
    
    // Token format: APP_ID:API_KEY
    const parts = token.split(':');
    const appId = parts[0];
    const apiKey = parts[1] || '';

    if (!appId || !apiKey) throw new Error('Invalid Algolia Token format. Expected APP_ID:API_KEY');

    const indexName = 'algolia-system-logs';
    
    try {
      // Build standard REST payload
      const params = new URLSearchParams();
      params.append('query', args.query);

      const res = await fetch(`https://${appId}-dsn.algolia.net/1/indexes/${indexName}/query`, {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': appId,
          'X-Algolia-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ params: params.toString() })
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      // No dummy fallback: an empty index honestly returns no hits.
      return { content: data.hits || [] };
    } catch (e: any) {
      throw new Error(`Algolia Search Failed: ${e.message}`);
    }
  }

  throw new Error('Unsupported server type');
};
