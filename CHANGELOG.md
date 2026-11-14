# Changelog

## v0.6 — 2026-11-11

- Fixed: Algolia tool searched index `system_logs`, but the index Hamza created in the dashboard is named `algolia-system-logs` (named after the uploaded file). The tool and the credential check now query `algolia-system-logs`

## v0.5 — 2026-11-11

- Fixed: Algolia's "Index system_logs does not exist" 404 was misreported as "Groq model not found" — the error mapper matched the phrase "does not exist" before checking the tool-specific error. Tool errors (Algolia/Bright Data/Neo4j) are now checked first, the Groq-model check now requires the message to actually mention the model, and a missing Algolia index gets its own honest message naming the index
- Verified live: Groq itself is fine — direct API test of the deployed site returned a real reply (HTTP 200)

## v0.4 — 2026-11-11

- Fixed: GitHub tool never worked on Vercel — it spawned a local stdio MCP server whose file is not in the serverless bundle. GitHub is now a custom tool using the GitHub REST API directly (search_repositories, list_user_repos, get_repository) with clear 401/403/404 errors
- Fixed: keyword routing missed plurals — "repos" did not match "repo", so "show my recent repos" fell through to General. Single-word keywords now match an optional plural suffix without matching longer words ("db" still never matches "debug")

## v0.3 — 2026-11-11

- Fixed: error messages picked the wrong branch — an Algolia fetch failure was misreported as a local-server problem. Tool-specific errors are now checked before the generic connection error, and the local-server hint only applies to local tools (GitHub/SQLite/Postman)
- Added: clear "key/token missing in Settings" message before running a tool without its credential, instead of a cryptic MCP error
- Added: Markdown rendering in assistant replies (react-markdown) — bold, lists and code no longer show as raw asterisks

## v0.2 — 2026-11-11

- Fixed: Groq retired `llama-3.1-8b-instant` / `llama3-8b-8192` (Enterprise-only since 2026-08-16) — all Groq calls now use `openai/gpt-oss-120b` with `gpt-oss-20b` fallback (`src/lib/groq-model.ts`)
- Fixed: keyword-based auto-routing that works even when Groq is down, with Groq classification as fallback
- Fixed: honest error messages — no raw JSON, no misleading token/GitHub blame; missing Groq key now fails the build gracefully instead of crashing it
- Fixed: Verify & Save now really verifies GitHub and Algolia credentials; status dots show Verified (green) / Saved (amber) / Not connected (red); saved keys can be removed
- Removed: fake demo-data fallbacks in the Neo4j and Algolia tools — empty results are now honest
- Fixed: layout overflow at desktop widths, header reachable, mobile drawer sidebars, browser tab title
- Added: clickable example prompts, chat history persistence, message timestamps, copy button, clear chat, real connection-status pill

## v0.1 — 2026-10-28

- Unified AI chat interface that turns natural language into live developer tool actions
- Next.js App Router + Groq (Llama-3.1) with Anthropic Model Context Protocol (MCP)
- Integrations with Neo4j, Algolia, and Bright Data
- Built for the HackerNoon Proof of Usefulness Hackathon
- Showcase changelog added (README already in place)
