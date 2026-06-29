# 🌐 Visual MCP Gateway Router

An advanced, fully functional Agentic AI Gateway built with **Next.js (App Router)** and **Tailwind CSS**. It translates natural language prompts (English & Roman Urdu) into production-grade developer tool actions in real-time. 

Powered by **Groq Cloud (Llama-3.1-8b-instant)** for autonomous smart routing, it natively integrates **Algolia**, **Bright Data**, and **Neo4j** into a unified ecosystem—eliminating context-switching for developers and project managers.

---

## 🚀 Key Architectural Features

### 🧠 1. Groq Llama 3 Dynamic Router
- **Intent Analysis:** Processes user input to dynamically map the correct execution tool (Algolia, Bright Data, or Neo4j) without pre-defined hardcoded rules.
- **Data Synthesis:** Orchestrates raw JSON outputs from multi-source APIs and synthesizes them into actionable, human-readable responses.

### 🛡️ 2. Zero-Trust Local Configuration
- **Secure Modals:** Users input their unique API credentials (API Keys, App IDs, and connection strings) directly via a modern Glassmorphism configuration UI.
- **Client-Side Storage:** Keys are saved securely in the browser's local storage, ensuring zero exposure to third-party databases.

### 🔌 3. Production-Ready Tool Ecosystem
- **Neo4j Graph Database Explorer:** Dynamically builds and runs complex Cypher queries over connected graphs straight from natural language prompts.
- **Bright Data Web Unlocker:** Built-in web extraction agent capable of executing heavy scraping jobs with a managed 30-second timeout window.
- **Algolia Instant Searcher:** Powers instant millisecond-level error log indexing and documentation retrieval.

---

## 🛠️ Tech Stack & Protocols

| Layer | Technology |
| :--- | :--- |
| **Frontend UI** | Next.js (App Router), React, Tailwind CSS, Framer Motion |
| **Orchestration**| Groq SDK (`llama-3.1-8b-instant`) |
| **Data & Graph** | Neo4j Graph Driver |
| **Web Scraping** | Bright Data Web Unlocker API |
| **Search Engine**| Algolia Search API |

---

## 📋 Local Setup Guide

1. Clone the repository:
   ```bash
   git clone https://github.com
   cd visual-mcp-gateway
   ```

2. Install the necessary dependencies:
   ```bash
   npm install
   ```

3. Configure your environmental fallback configurations in `.env.local`:
   ```env
   GROQ_API_KEY=your_groq_api_key
   ```

4. Launch the local development pipeline:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) inside your browser, access the settings dashboard icon, enter your API secrets, and begin talking directly to your developer infrastructure.
