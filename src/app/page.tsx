'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  Cloud,
  Globe,
  Send,
  Server,
  Bot,
  Activity,
  Sparkles,
  Command,
  ChevronRight,
  Settings,
  X,
  Info,
  Network,
  Search,
  Radio,
  Copy,
  Check,
  Trash2,
  Menu,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const serversConfig = [
  { id: 'github', name: 'GitHub MCP', icon: Cloud, color: 'from-blue-500 to-indigo-600', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx' },
  { id: 'sqlite', name: 'Local SQLite', icon: Database, color: 'from-emerald-400 to-teal-500', placeholder: 'sqlite:///absolute/path/to/db.sqlite' },
  { id: 'postman', name: 'Postman API', icon: Globe, color: 'from-orange-400 to-red-500', placeholder: 'PMAK-xxxxxxxxxxxxxxxxxxxx' },
  { id: 'neo4j', name: 'Neo4j Graph', icon: Network, color: 'from-blue-600 to-cyan-500', placeholder: 'neo4j://user:pass@host:7687' },
  { id: 'brightdata', name: 'Bright Data', icon: Radio, color: 'from-yellow-400 to-orange-500', placeholder: 'http://brd-customer-x:pass@host:port' },
  { id: 'algolia', name: 'Algolia Search', icon: Search, color: 'from-cyan-400 to-blue-500', placeholder: 'APP_ID:API_KEY' },
];

// Display names for the "Routed Tool" chip (server ids are lowercase internally)
const ROUTING_LABELS: Record<string, string> = {
  github: 'GitHub',
  sqlite: 'SQLite',
  postman: 'Postman',
  neo4j: 'Neo4j',
  brightdata: 'Bright Data',
  algolia: 'Algolia',
  general: 'General',
};

const EXAMPLE_PROMPTS = [
  'Search error logs for 500 errors',
  'Show my recent GitHub repos',
  'Scrape https://example.com',
  'Find users connected to errors in the graph',
];

type ChatMessage = { role: 'user' | 'assistant'; content: string; routing?: string; time?: number };

export default function MCPGateway() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Settings State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({
    github: '',
    sqlite: '',
    postman: ''
  });
  // Which servers were actually verified against their service (GitHub, Algolia).
  // Other servers can only be format-checked in the browser, so they stay "saved".
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [tempToken, setTempToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [modalError, setModalError] = useState('');

  // Right Sidebar Override State
  const [activeOverrideTool, setActiveOverrideTool] = useState<string | null>(null);

  // Mobile drawer state (sidebars are hidden below the lg breakpoint)
  const [mobilePanel, setMobilePanel] = useState<'tools' | 'sponsor' | null>(null);

  // Copy-to-clipboard feedback
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Load from local storage (tokens, verified flags, chat history)
  const hydrated = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mcp_tokens');
      if (saved) setTokens(JSON.parse(saved));
      const savedVerified = localStorage.getItem('mcp_verified');
      if (savedVerified) setVerified(JSON.parse(savedVerified));
      const savedMessages = localStorage.getItem('mcp_messages');
      if (savedMessages) setMessages(JSON.parse(savedMessages));
    } catch (e) {}
    hydrated.current = true;
  }, []);

  // Persist chat history (last 50 messages)
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem('mcp_messages', JSON.stringify(messages.slice(-50)));
    } catch (e) {}
  }, [messages]);

  const openModal = (id: string) => {
    setActiveModal(id);
    setTempToken(tokens[id] || '');
    setModalError('');
  };

  const persistTokens = (newTokens: Record<string, string>, newVerified: Record<string, boolean>) => {
    setTokens(newTokens);
    setVerified(newVerified);
    localStorage.setItem('mcp_tokens', JSON.stringify(newTokens));
    localStorage.setItem('mcp_verified', JSON.stringify(newVerified));
  };

  const clearSavedKey = () => {
    if (!activeModal) return;
    const newTokens = { ...tokens, [activeModal]: '' };
    const newVerified = { ...verified, [activeModal]: false };
    persistTokens(newTokens, newVerified);
    setActiveModal(null);
  };

  // Real Algolia credential check: a search request with a bad key returns
  // 403. A 200 (index exists) or 404 (index missing) both prove the key
  // authenticated — the demo index may simply not exist yet.
  const verifyAlgolia = async (appId: string, apiKey: string) => {
    let res: Response;
    try {
      res = await fetch(`https://${appId}-dsn.algolia.net/1/indexes/algolia-system-logs/query`, {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': appId,
          'X-Algolia-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ params: 'query=' }),
      });
    } catch {
      throw new Error('Could not reach Algolia. Check your connection and Application ID.');
    }
    if (res.status === 403) throw new Error('Invalid Algolia Application ID or API Key.');
  };

  const validateAndSaveToken = async () => {
    if (!activeModal) return;
    setIsValidating(true);
    setModalError('');

    try {
      const trimmed = tempToken.trim();
      // Empty input = remove the saved key (consistent for every server).
      if (trimmed === '' || (activeModal === 'algolia' && tempToken.split(':').every(p => p.trim() === ''))) {
        clearSavedKey();
        return;
      }

      let isVerified = false;
      if (activeModal === 'github') {
        // Real check against GitHub
        const res = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${trimmed}` }
        });
        if (!res.ok) throw new Error('Invalid GitHub Token or bad credentials.');
        isVerified = true;
      } else if (activeModal === 'neo4j') {
        if (!trimmed.startsWith('neo4j://') && !trimmed.startsWith('neo4j+s://')) {
          throw new Error('Neo4j URI must start with neo4j:// or neo4j+s://');
        }
      } else if (activeModal === 'brightdata') {
        if (!trimmed.includes('brd-customer-')) {
          throw new Error('Invalid Bright Data proxy token format.');
        }
      } else if (activeModal === 'algolia') {
        const parts = tempToken.split(':');
        const appId = (parts[0] || '').trim();
        const apiKey = parts.slice(1).join(':').trim();
        if (appId === '' || apiKey === '') {
          throw new Error('Please fill both Application ID and API Key.');
        }
        // Real check against Algolia (see verifyAlgolia)
        await verifyAlgolia(appId, apiKey);
        isVerified = true;
      }

      const newTokens = { ...tokens, [activeModal]: tempToken };
      const newVerified = { ...verified, [activeModal]: isVerified };
      persistTokens(newTokens, newVerified);
      setActiveModal(null);
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const submitPrompt = async (text: string) => {
    const clean = text.trim();
    if (!clean || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: clean, time: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage.content,
          tokens: tokens,
          overrideServer: activeOverrideTool
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("API Error:", text);
        throw new Error(`Server returned ${res.status}. Please try again.`);
      }

      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.result || data.error,
        routing: data.classification,
        time: Date.now()
      }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Failed to connect to gateway.\n\nError: ${err.message}`, time: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitPrompt(prompt);
  };

  const copyMessage = async (idx: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(current => (current === idx ? null : current)), 1500);
    } catch (e) {}
  };

  const clearChat = () => {
    setMessages([]);
    try { localStorage.removeItem('mcp_messages'); } catch (e) {}
  };

  const activeServerData = serversConfig.find(s => s.id === activeModal);

  // Status pill: honest about what is actually connected/verified
  const connectedCount = serversConfig.filter(s => !!tokens[s.id]).length;
  const verifiedCount = serversConfig.filter(s => !!verified[s.id]).length;

  // Status dot: green = verified against the service, amber = saved but not
  // verified (format-checked only), red = nothing saved.
  const dotState = (id: string) => (verified[id] ? 'verified' : tokens[id] ? 'saved' : 'none');
  const dotClasses: Record<string, string> = {
    verified: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
    saved: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
    none: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
  };
  const dotLabel: Record<string, string> = {
    verified: 'Verified',
    saved: 'Saved — not verified',
    none: 'Not connected',
  };

  return (
    <div className="fixed inset-0 bg-[#FAFAFA] text-slate-900 font-sans selection:bg-indigo-100 flex overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-indigo-200/40 to-purple-200/40 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[50%] rounded-full bg-gradient-to-tl from-blue-200/40 to-emerald-200/40 blur-[120px] pointer-events-none" />

      {/* Mobile drawer backdrop */}
      {mobilePanel && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobilePanel(null)}
        />
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {activeModal && activeServerData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setActiveModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-slate-900/20 border border-slate-100"
            >
              <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${activeServerData.color} shadow-inner`}>
                  <activeServerData.icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{activeServerData.name} Settings</h2>
              </div>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Enter your connection token/key for {activeServerData.name}. It is stored as plain text in this browser&apos;s local storage — use a key you can revoke.
              </p>

              <div className="space-y-4">
                {activeServerData.id === 'algolia' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Application ID</label>
                      <input
                        type="text"
                        value={tempToken.split(':')[0] || ''}
                        onChange={(e) => setTempToken(`${e.target.value}:${tempToken.split(':').slice(1).join(':') || ''}`)}
                        placeholder="e.g. LAT78X..."
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">API Key (Search or Admin)</label>
                      <input
                        type="password"
                        value={tempToken.split(':').slice(1).join(':') || ''}
                        onChange={(e) => setTempToken(`${tempToken.split(':')[0] || ''}:${e.target.value}`)}
                        placeholder="e.g. 5d8c..."
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium"
                      />
                    </div>
                    {modalError && <p className="text-red-500 text-xs mt-2 font-semibold">{modalError}</p>}
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Connection Token</label>
                    <input
                      type="password"
                      value={tempToken}
                      onChange={(e) => setTempToken(e.target.value)}
                      placeholder={activeServerData.placeholder}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium"
                    />
                    {activeServerData.id === 'sqlite' && (
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        Sent to your local SQLite MCP server (localhost:8002) — the browser itself cannot open local files.
                      </p>
                    )}
                    {modalError && <p className="text-red-500 text-xs mt-2 font-semibold">{modalError}</p>}
                  </div>
                )}
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setActiveModal(null)} className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 font-semibold hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={validateAndSaveToken}
                  disabled={isValidating}
                  className="flex-1 bg-slate-900 text-white rounded-xl py-3 font-semibold hover:bg-slate-800 transition-colors shadow-md disabled:opacity-50"
                >
                  {isValidating ? 'Validating...' : 'Verify & Save'}
                </button>
              </div>
              {!!tokens[activeModal] && (
                <button
                  onClick={clearSavedKey}
                  className="mt-3 w-full text-center text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                >
                  Remove saved key
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`w-80 shrink-0 bg-white/60 backdrop-blur-2xl border-r border-white/40 flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-40 h-full max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:shadow-2xl ${mobilePanel === 'tools' ? 'max-lg:flex' : 'max-lg:hidden'} lg:flex`}
      >
        <div className="p-6 shrink-0">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-2.5 rounded-2xl shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/5">
              <Command className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 tracking-tight">Visual MCP</h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">Gateway Router</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Server className="w-3.5 h-3.5" />
              MCP Tools
            </h2>
          </div>
        </div>

        <div className="px-4 flex-1 overflow-y-auto min-h-0 space-y-2.5 custom-scrollbar">
          {serversConfig.filter(s => ['github', 'sqlite', 'postman'].includes(s.id)).map((s, i) => {
            const state = dotState(s.id);

            return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              key={s.id}
              onClick={() => openModal(s.id)}
              className="group relative flex items-center justify-between p-3.5 rounded-2xl border border-white bg-white/50 hover:bg-white shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${s.color} shadow-inner opacity-${state === 'none' ? '50' : '100'}`}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900 transition-colors">{s.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Status Indicator */}
                <div className="relative group/tooltip flex items-center justify-center">
                  <span className="relative flex h-2.5 w-2.5">
                    {state === 'verified' && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotClasses[state]}`}></span>
                  </span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover/tooltip:block whitespace-nowrap bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-50">
                    {dotLabel[state]}
                  </div>
                </div>

                {/* Settings Icon */}
                <button
                  onClick={(e) => { e.stopPropagation(); openModal(s.id); }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                  title={`${s.name} Settings`}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )})}
        </div>

        <div className="p-6 mt-auto shrink-0">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100/50 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-900">PRO TIP</span>
            </div>
            <p className="text-xs text-indigo-700/80 font-medium leading-relaxed">
              Click a tool card to connect it and fetch real MCP data!
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-20 h-full min-w-0">

        {/* Top Navbar */}
        <div className="absolute top-0 inset-x-0 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 z-30 flex items-center px-4 sm:px-8 justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobilePanel('tools')}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600 shrink-0"
              title="Tools"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Bot className="w-6 h-6 text-indigo-600 shrink-0" />
            <h2 className="font-bold text-slate-800 text-lg tracking-tight truncate">HackerNoon <span className="text-indigo-600">Gateway</span></h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setMobilePanel(mobilePanel === 'sponsor' ? null : 'sponsor')}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600"
              title="Sponsor tools"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm ${
              verifiedCount > 0
                ? 'text-emerald-600 bg-emerald-50 border-emerald-200/50'
                : connectedCount > 0
                  ? 'text-amber-600 bg-amber-50 border-amber-200/50'
                  : 'text-slate-500 bg-slate-50 border-slate-200/50'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                verifiedCount > 0 ? 'bg-emerald-500' : connectedCount > 0 ? 'bg-amber-500' : 'bg-slate-400'
              }`}></div>
              {verifiedCount > 0
                ? `${verifiedCount} tool${verifiedCount > 1 ? 's' : ''} verified`
                : connectedCount > 0
                  ? `${connectedCount} tool${connectedCount > 1 ? 's' : ''} saved`
                  : 'No tools connected'}
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto pb-24 pt-24 custom-scrollbar scroll-smooth flex flex-col">
          <div className="max-w-4xl mx-auto px-4 sm:px-8 w-full flex flex-col gap-2">
            <AnimatePresence>
              {messages.length === 0 ? (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center space-y-8"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-400/20 blur-2xl rounded-full" />
                    <div className="relative bg-white p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/50">
                      <Bot className="w-16 h-16 text-transparent bg-clip-text bg-gradient-to-br from-blue-600 to-indigo-600 stroke-[url(#blue-gradient)]" />
                      <svg width="0" height="0">
                        <linearGradient id="blue-gradient" x1="100%" y1="100%" x2="0%" y2="0%">
                          <stop stopColor="#2563eb" offset="0%" />
                          <stop stopColor="#4f46e5" offset="100%" />
                        </linearGradient>
                      </svg>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-slate-800 to-slate-500 tracking-tight">
                      Ready to route your requests.
                    </h2>
                    <p className="text-lg text-slate-500 max-w-lg mx-auto leading-relaxed font-medium">
                      Enter a prompt below. The router will invoke the exact tool needed and synthesize the answer.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Try one of these:</p>
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
                      {EXAMPLE_PROMPTS.map((example) => (
                        <button
                          key={example}
                          onClick={() => submitPrompt(example)}
                          className="text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm hover:border-indigo-300 hover:text-indigo-600 hover:shadow transition-all"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                messages.map((msg, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mr-4 shadow-md shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div className={`max-w-2xl rounded-3xl p-6 ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10 rounded-tr-sm'
                        : 'bg-white text-slate-800 shadow-xl shadow-slate-200/40 border border-slate-100 rounded-tl-sm'
                    }`}>
                      {msg.routing && msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100/60">
                          <div className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-emerald-100/50">
                            <Activity className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Routed Tool</span>
                          </div>
                          <ChevronRight className="w-3 h-3 text-slate-300" />
                          <span className="text-sm font-semibold text-slate-700 capitalize flex items-center gap-1.5">
                            {msg.routing === 'github' && <Cloud className="w-4 h-4 text-blue-500" />}
                            {msg.routing === 'sqlite' && <Database className="w-4 h-4 text-emerald-500" />}
                            {msg.routing === 'postman' && <Globe className="w-4 h-4 text-orange-500" />}
                            {msg.routing === 'general' && <Sparkles className="w-4 h-4 text-purple-500" />}
                            {msg.routing === 'neo4j' && <Network className="w-4 h-4 text-cyan-500" />}
                            {msg.routing === 'brightdata' && <Radio className="w-4 h-4 text-yellow-500" />}
                            {msg.routing === 'algolia' && <Search className="w-4 h-4 text-blue-400" />}
                            {ROUTING_LABELS[msg.routing] || msg.routing}
                          </span>
                        </div>
                      )}
                      <div className="prose prose-slate prose-sm max-w-none leading-relaxed whitespace-pre-wrap font-medium">
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100/60">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => copyMessage(i, msg.content)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                            title="Copy response"
                          >
                            {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedIdx === i ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
              {isLoading && (
                <motion.div
                  key="loading-state"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start items-start"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center mr-4 shrink-0 mt-1 animate-pulse" />
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-slate-200/40 border border-slate-100 flex items-center gap-2">
                    <div className="flex gap-1.5 items-center">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 rounded-full bg-blue-500" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 rounded-full bg-indigo-500" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 rounded-full bg-purple-500" />
                    </div>
                    <span className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 ml-2">Synthesizing Context...</span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </AnimatePresence>
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 z-30">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative flex items-center bg-white border border-slate-300 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
              <AnimatePresence>
                {activeOverrideTool && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: 'auto' }}
                    exit={{ opacity: 0, scale: 0.9, width: 0 }}
                    className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-xl ml-2 text-xs font-bold whitespace-nowrap overflow-hidden"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    {serversConfig.find(s => s.id === activeOverrideTool)?.name}
                    <button type="button" onClick={() => setActiveOverrideTool(null)} className="ml-1 hover:bg-slate-700 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeOverrideTool ? "Query this tool directly..." : "Query your MCP tools..."}
                className="flex-1 min-w-0 bg-transparent text-slate-900 px-4 py-3 focus:outline-none placeholder:text-slate-400 font-medium text-base"
              />
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="m-1 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-sm shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Right Sidebar Override */}
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`w-72 shrink-0 bg-slate-900 border-l border-slate-800 flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.2)] z-40 text-white h-full max-lg:fixed max-lg:inset-y-0 max-lg:right-0 ${mobilePanel === 'sponsor' ? 'max-lg:flex' : 'max-lg:hidden'} lg:flex`}
      >
        <div className="p-6 pb-2 shrink-0">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-lg ring-1 ring-white/10">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-tight">Sponsor Tools</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">Explicit Override</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Select a tool to lock the AI context. When selected, the AI will exclusively use this tool and bypass auto-routing.
          </p>
        </div>

        <div className="px-4 flex-1 overflow-y-auto min-h-0 space-y-2.5 custom-scrollbar">
          {['algolia', 'brightdata', 'neo4j'].map((toolId) => {
            const s = serversConfig.find(sc => sc.id === toolId);
            if (!s) return null;
            const isSelected = activeOverrideTool === s.id;
            const state = dotState(s.id);

            return (
              <div
                key={s.id}
                className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 ${
                  isSelected
                    ? 'bg-slate-800 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                    : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveOverrideTool(isSelected ? null : s.id)}
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                >
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${s.color} shadow-inner opacity-${state === 'none' ? '50' : '100'}`}>
                    <s.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold transition-colors truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>{s.name}</p>
                  </div>
                </button>

                <div className="flex items-center gap-3 pl-2 shrink-0">
                  <div className="relative group/tooltip flex items-center justify-center">
                    <span className="relative flex h-2.5 w-2.5">
                      {state === 'verified' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotClasses[state]}`}></span>
                    </span>
                    <div className="absolute bottom-full mb-2 hidden group-hover/tooltip:block whitespace-nowrap bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-50">
                      {dotLabel[state]}
                    </div>
                  </div>

                  <button
                    onClick={() => openModal(s.id)}
                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title={`${s.name} Settings`}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
