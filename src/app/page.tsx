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
  Network,
  Search,
  Radio,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  KeyRound,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const serversConfig = [
  { id: 'github', name: 'GitHub MCP', icon: Cloud, color: 'from-blue-500 to-indigo-600', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx', category: 'mcp' },
  { id: 'sqlite', name: 'Local SQLite', icon: Database, color: 'from-emerald-400 to-teal-500', placeholder: 'sqlite://path/to/db.sqlite', category: 'mcp' },
  { id: 'postman', name: 'Postman API', icon: Globe, color: 'from-orange-400 to-red-500', placeholder: 'PMAK-xxxxxxxxxxxxxxxxxxxx', category: 'mcp' },
  { id: 'neo4j', name: 'Neo4j Graph', icon: Network, color: 'from-blue-600 to-cyan-500', placeholder: 'neo4j://user:pass@host:7687', category: 'sponsor' },
  { id: 'brightdata', name: 'Bright Data', icon: Radio, color: 'from-yellow-400 to-orange-500', placeholder: 'http://brd-customer-x:pass@host:port', category: 'sponsor' },
  { id: 'algolia', name: 'Algolia Search', icon: Search, color: 'from-cyan-400 to-blue-500', placeholder: 'APP_ID:API_KEY', category: 'sponsor' },
];

const samplePrompts = [
  { label: 'GitHub Repos', prompt: 'Show my recent GitHub repositories', icon: Cloud, tool: 'github' },
  { label: 'Algolia Logs', prompt: 'Search error 500 in Algolia system logs', icon: Search, tool: 'algolia' },
  { label: 'Neo4j Graph', prompt: 'MATCH (n) RETURN n LIMIT 5 from Neo4j', icon: Network, tool: 'neo4j' },
  { label: 'Bright Data Scrape', prompt: 'Scrape headlines from https://news.ycombinator.com using Bright Data', icon: Radio, tool: 'brightdata' },
];

export default function MCPGateway() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string, routing?: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Layout sidebar states
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  // References for scrolling
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Settings State for all 6 tools
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({
    github: '',
    sqlite: '',
    postman: '',
    neo4j: '',
    brightdata: '',
    algolia: ''
  });
  const [tempToken, setTempToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [modalError, setModalError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Right Sidebar Override State
  const [activeOverrideTool, setActiveOverrideTool] = useState<string | null>(null);

  // Auto-collapse sidebars on smaller screens on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1200) {
        setRightSidebarOpen(false);
      }
      if (window.innerWidth < 768) {
        setLeftSidebarOpen(false);
      }
    }
  }, []);

  // Load saved tokens from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mcp_tokens');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTokens(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse tokens from localStorage', e);
      }
    }
  }, []);

  const openModal = (id: string) => {
    setActiveModal(id);
    setTempToken(tokens[id] || '');
    setModalError('');
    setSaveSuccess(false);
  };

  const validateAndSaveToken = async () => {
    if (!activeModal) return;
    setIsValidating(true);
    setModalError('');
    setSaveSuccess(false);

    try {
      if (tempToken.trim() !== '') {
        if (activeModal === 'github') {
          const res = await fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${tempToken.trim()}` }
          });
          if (!res.ok) throw new Error('Invalid GitHub Token or insufficient permissions.');
        } else if (activeModal === 'neo4j') {
          if (!tempToken.startsWith('neo4j://') && !tempToken.startsWith('neo4j+s://') && !tempToken.startsWith('bolt://') && !tempToken.startsWith('bolt+s://')) {
            throw new Error('Neo4j URI must start with neo4j://, neo4j+s://, bolt://, or bolt+s://');
          }
        } else if (activeModal === 'brightdata') {
          if (!tempToken.includes('brd-customer-')) {
            throw new Error('Invalid Bright Data proxy token format. Expected: http://brd-customer-xxx:pass@host:port');
          }
        } else if (activeModal === 'algolia') {
          const parts = tempToken.split(':');
          if (parts.length !== 2 || parts[0].trim() === '' || parts[1].trim() === '') {
            throw new Error('Please fill both Application ID and API Key (Format: APP_ID:API_KEY).');
          }
        }
      }

      const newTokens = { ...tokens, [activeModal]: tempToken.trim() };
      setTokens(newTokens);
      localStorage.setItem('mcp_tokens', JSON.stringify(newTokens));
      setSaveSuccess(true);
      setTimeout(() => {
        setActiveModal(null);
        setSaveSuccess(false);
      }, 700);
    } catch (err: any) {
      setModalError(err.message || 'Validation error');
    } finally {
      setIsValidating(false);
    }
  };

  const clearToken = () => {
    if (!activeModal) return;
    const newTokens = { ...tokens, [activeModal]: '' };
    setTokens(newTokens);
    setTempToken('');
    localStorage.setItem('mcp_tokens', JSON.stringify(newTokens));
    setActiveModal(null);
  };

  // Safe inner container scroll
  const scrollToBottom = (instant = false) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: instant ? 'auto' : 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const clearMessages = () => {
    if (messages.length > 0) {
      setMessages([]);
    }
  };

  const handleSendPrompt = async (textToSend?: string) => {
    const messageContent = (textToSend !== undefined ? textToSend : prompt).trim();
    if (!messageContent || isLoading) return;

    const userMessage = { role: 'user' as const, content: messageContent };
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
        throw new Error(`Server returned ${res.status}: ${text.substring(0, 80)}...`);
      }

      const data = await res.json();

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.result || data.error || 'No output received.',
        routing: data.classification 
      }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `🚨 **Gateway Connection Error**\n\n${err.message || 'An unexpected error occurred while communicating with the MCP gateway.'}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendPrompt();
  };

  const activeServerData = serversConfig.find(s => s.id === activeModal);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FAFAFA] text-slate-900 font-sans relative">
      {/* Decorative Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[35vw] h-[35vw] rounded-full bg-gradient-to-br from-indigo-200/40 to-purple-200/30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[30vw] h-[40vw] rounded-full bg-gradient-to-tl from-blue-200/40 to-emerald-200/30 blur-[130px] pointer-events-none" />

      {/* Settings Modal */}
      <AnimatePresence>
        {activeModal && activeServerData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setActiveModal(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 z-10"
            >
              <button 
                onClick={() => setActiveModal(null)} 
                className="absolute top-6 right-6 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${activeServerData.color} shadow-sm text-white`}>
                  <activeServerData.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{activeServerData.name}</h2>
                  <p className="text-xs text-slate-500 font-medium">Connection Credentials</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Tokens are saved directly in your browser&apos;s local storage and used securely to communicate with this tool.
              </p>
              
              <div className="space-y-4">
                {activeServerData.id === 'algolia' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Application ID</label>
                      <input 
                        type="text" 
                        value={tempToken.split(':')[0] || ''}
                        onChange={(e) => {
                          const currentSecret = tempToken.split(':').slice(1).join(':') || '';
                          setTempToken(`${e.target.value.trim()}:${currentSecret}`);
                        }}
                        placeholder="e.g. LAT78X..."
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">API Key (Search or Admin)</label>
                      <input 
                        type="password" 
                        value={tempToken.split(':').slice(1).join(':') || ''}
                        onChange={(e) => {
                          const currentAppId = tempToken.split(':')[0] || '';
                          setTempToken(`${currentAppId}:${e.target.value.trim()}`);
                        }}
                        placeholder="e.g. 5d8c..."
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Connection Token / URI</label>
                    <input 
                      type="password" 
                      value={tempToken}
                      onChange={(e) => setTempToken(e.target.value)}
                      placeholder={activeServerData.placeholder}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium"
                    />
                  </div>
                )}

                {modalError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold leading-snug">
                    {modalError}
                  </div>
                )}

                {saveSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Credentials verified and saved successfully!
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center gap-2">
                {tokens[activeServerData.id] && (
                  <button 
                    onClick={clearToken}
                    title="Disconnect / Remove token"
                    className="px-3 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button 
                  onClick={() => setActiveModal(null)} 
                  className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 text-sm font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={validateAndSaveToken} 
                  disabled={isValidating}
                  className="flex-1 bg-slate-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isValidating ? 'Validating...' : 'Verify & Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LEFT SIDEBAR - MCP Tools */}
      <AnimatePresence initial={false}>
        {leftSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="h-full bg-white/75 backdrop-blur-2xl border-r border-slate-200/60 flex flex-col shadow-sm shrink-0 overflow-hidden z-20"
          >
            <div className="w-80 flex flex-col h-full">
              {/* Header */}
              <div className="p-6 shrink-0 border-b border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-2 rounded-xl text-white shadow-md shadow-slate-900/10">
                      <Command className="w-4 h-4" />
                    </div>
                    <div>
                      <h1 className="font-bold text-base text-slate-900 tracking-tight leading-tight">Visual MCP</h1>
                      <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Gateway Router</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setLeftSidebarOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Collapse Left Sidebar"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tools List */}
              <div className="p-4 flex-1 overflow-y-auto min-h-0 space-y-2.5 custom-scrollbar">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                    Core MCP Tools
                  </h2>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                    {serversConfig.filter(s => s.category === 'mcp' && !!tokens[s.id]).length}/3 Active
                  </span>
                </div>

                {serversConfig.filter(s => s.category === 'mcp').map((s) => {
                  const isConnected = !!tokens[s.id];
                  
                  return (
                    <div 
                      key={s.id} 
                      className="group relative flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/60 bg-white/70 hover:bg-white shadow-sm hover:shadow transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-gradient-to-br ${s.color} text-white shadow-sm ${isConnected ? 'opacity-100' : 'opacity-40'}`}>
                          <s.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">{s.name}</p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {isConnected ? 'Configured' : 'Not configured'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Status Indicator */}
                        <div className="relative group/tooltip flex items-center justify-center p-1">
                          <span className="relative flex h-2.5 w-2.5">
                            {isConnected && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></span>
                          </span>
                          <div className="absolute bottom-full mb-2 hidden group-hover/tooltip:block whitespace-nowrap bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-50">
                            {isConnected ? 'Active & Ready' : 'Token Required'}
                          </div>
                        </div>

                        {/* Settings Icon */}
                        <button 
                          onClick={() => openModal(s.id)} 
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors" 
                          title={`${s.name} Configuration`}
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Pro Tip Card */}
              <div className="p-4 mt-auto shrink-0 border-t border-slate-100">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-3.5 border border-indigo-100/60 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1 text-indigo-900 font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Llama 3 Multi-Routing</span>
                  </div>
                  <p className="text-[11px] text-indigo-800/80 font-medium leading-relaxed">
                    Queries in English or Roman Urdu automatically map to the right tool.
                  </p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* CENTER WORKSPACE - Full Flex Column Flow */}
      <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden relative z-10">
        
        {/* FIXED TOP NAVBAR - In Flow, Never Hides */}
        <header className="h-16 shrink-0 bg-white/85 backdrop-blur-xl border-b border-slate-200/70 z-20 flex items-center px-4 md:px-6 justify-between transition-all">
          <div className="flex items-center gap-3">
            {!leftSidebarOpen && (
              <button 
                onClick={() => setLeftSidebarOpen(true)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                title="Open Core Tools"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm md:text-base tracking-tight flex items-center gap-2 leading-none">
                  Visual MCP <span className="text-indigo-600">Gateway</span>
                </h2>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-1">Autonomous Agent Router</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* System Online Badge */}
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200/60 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">System Online</span>
            </div>

            {/* Clear Chat Button */}
            {messages.length > 0 && (
              <button 
                onClick={clearMessages}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Toggle Right Sidebar Button */}
            {!rightSidebarOpen && (
              <button 
                onClick={() => setRightSidebarOpen(true)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                title="Open Sponsor Tools"
              >
                <PanelRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {/* SCROLLABLE MESSAGES CONTAINER - Only This Element Scrolls */}
        <main 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6 md:px-8 custom-scrollbar min-h-0 relative"
        >
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6 my-auto pt-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full" />
                  <div className="relative bg-white p-5 rounded-3xl shadow-lg border border-slate-100 text-indigo-600">
                    <Bot className="w-12 h-12" />
                  </div>
                </div>

                <div className="space-y-2 max-w-lg">
                  <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                    Ready to route your requests.
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">
                    Type in English or Roman Urdu. Llama 3 dynamically maps your intent to GitHub, SQLite, Postman, Algolia, Bright Data, or Neo4j.
                  </p>
                </div>

                {/* Quick Start Prompt Chips */}
                <div className="w-full max-w-2xl pt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Try a sample query</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                    {samplePrompts.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendPrompt(item.prompt)}
                        className="group flex items-start gap-3 p-3.5 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/70 hover:border-indigo-400 shadow-sm hover:shadow transition-all text-slate-700"
                      >
                        <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-indigo-50 text-slate-600 group-hover:text-indigo-600 transition-colors shrink-0">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{item.label}</p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.prompt}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all self-center" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center mr-3 text-white shadow-sm shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  
                  <div className={`group relative max-w-[85%] sm:max-w-2xl rounded-3xl p-5 sm:p-6 transition-all ${
                    msg.role === 'user' 
                      ? 'bg-slate-900 text-white shadow-md rounded-tr-sm' 
                      : 'bg-white text-slate-800 shadow-md border border-slate-100 rounded-tl-sm'
                  }`}>
                    {/* Assistant Routed Tool Badge */}
                    {msg.routing && msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                        <div className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-emerald-100/60 font-bold text-[10px] uppercase tracking-wider">
                          <Activity className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Routed Tool</span>
                        </div>
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                        <span className="text-xs font-semibold text-slate-700 capitalize flex items-center gap-1.5">
                          {msg.routing === 'github' && <Cloud className="w-3.5 h-3.5 text-blue-500" />}
                          {msg.routing === 'sqlite' && <Database className="w-3.5 h-3.5 text-emerald-500" />}
                          {msg.routing === 'postman' && <Globe className="w-3.5 h-3.5 text-orange-500" />}
                          {msg.routing === 'general' && <Sparkles className="w-3.5 h-3.5 text-purple-500" />}
                          {msg.routing === 'neo4j' && <Network className="w-3.5 h-3.5 text-cyan-500" />}
                          {msg.routing === 'brightdata' && <Radio className="w-3.5 h-3.5 text-yellow-500" />}
                          {msg.routing === 'algolia' && <Search className="w-3.5 h-3.5 text-blue-400" />}
                          {msg.routing}
                        </span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium break-words">
                      {msg.content}
                    </div>

                    {/* Copy Button for Assistant */}
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => copyToClipboard(msg.content, idx)}
                        className="absolute bottom-3 right-3 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Copy text"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start items-center gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                <div className="bg-white rounded-2xl px-5 py-3.5 shadow-sm border border-slate-100 flex items-center gap-2.5">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 ml-1">Synthesizing tool context...</span>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* FIXED FOOTER INPUT BAR - In Flow, Never Overlaps */}
        <footer className="shrink-0 p-3 md:p-4 bg-white/85 backdrop-blur-xl border-t border-slate-200/70 z-20">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative flex items-center bg-white border border-slate-300 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all p-1">
              {/* Active Override Tool Chip */}
              <AnimatePresence>
                {activeOverrideTool && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: 'auto' }}
                    exit={{ opacity: 0, scale: 0.9, width: 0 }}
                    className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-xl ml-1 text-xs font-bold whitespace-nowrap overflow-hidden"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Locked: {serversConfig.find(s => s.id === activeOverrideTool)?.name}</span>
                    <button 
                      type="button" 
                      onClick={() => setActiveOverrideTool(null)} 
                      className="ml-1 hover:bg-slate-700 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeOverrideTool ? `Query ${serversConfig.find(s => s.id === activeOverrideTool)?.name} directly...` : "Query MCP tools in English or Roman Urdu..."}
                className="flex-1 bg-transparent text-slate-900 px-3.5 py-2.5 focus:outline-none placeholder:text-slate-400 font-medium text-sm sm:text-base"
              />

              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-sm shrink-0"
                title="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </footer>
      </div>

      {/* RIGHT SIDEBAR - Sponsor Tools & Override */}
      <AnimatePresence initial={false}>
        {rightSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 290, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-xl z-20 text-white shrink-0 overflow-hidden"
          >
            <div className="w-72 flex flex-col h-full">
              {/* Header */}
              <div className="p-6 shrink-0 border-b border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl text-white shadow-md">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h1 className="font-bold text-base text-white tracking-tight leading-tight">Sponsor Tools</h1>
                      <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Explicit Override</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setRightSidebarOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    title="Collapse Right Sidebar"
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click a tool to bypass auto-routing and lock all prompts to that service.
                </p>
              </div>

              {/* Sponsor Tools List */}
              <div className="p-4 flex-1 overflow-y-auto min-h-0 space-y-2.5 custom-scrollbar">
                {serversConfig.filter(s => s.category === 'sponsor').map((s) => {
                  const isSelected = activeOverrideTool === s.id;
                  const isConnected = !!tokens[s.id];
                  
                  return (
                    <div
                      key={s.id}
                      className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 ${
                        isSelected 
                          ? 'bg-indigo-950/60 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.25)]' 
                          : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/90 hover:border-slate-600'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveOverrideTool(isSelected ? null : s.id)}
                        className="flex items-center gap-3 flex-1 text-left min-w-0"
                      >
                        <div className={`p-2 rounded-xl bg-gradient-to-br ${s.color} text-white shadow-sm shrink-0 ${isConnected ? 'opacity-100' : 'opacity-40'}`}>
                          <s.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                            {s.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {isSelected ? '✓ Tool locked' : (isConnected ? 'Configured' : 'Needs Token')}
                          </p>
                        </div>
                      </button>
                      
                      <div className="flex items-center gap-2 pl-2 shrink-0">
                        <div className="relative group/tooltip flex items-center justify-center p-1">
                          <span className="relative flex h-2.5 w-2.5">
                            {isConnected && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></span>
                          </span>
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

              {/* Status summary */}
              <div className="p-4 mt-auto shrink-0 border-t border-slate-800">
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Selected tool:</span>
                  <span className="font-bold text-slate-200">
                    {activeOverrideTool ? serversConfig.find(s => s.id === activeOverrideTool)?.name : 'Auto Dynamic'}
                  </span>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
