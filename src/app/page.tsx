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
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const serversConfig = [
  { id: 'github', name: 'GitHub MCP', icon: Cloud, color: 'from-blue-500 to-indigo-600', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx' },
  { id: 'sqlite', name: 'Local SQLite', icon: Database, color: 'from-emerald-400 to-teal-500', placeholder: 'sqlite://path/to/db.sqlite' },
  { id: 'postman', name: 'Postman API', icon: Globe, color: 'from-orange-400 to-red-500', placeholder: 'PMAK-xxxxxxxxxxxxxxxxxxxx' },
  { id: 'neo4j', name: 'Neo4j Graph', icon: Network, color: 'from-blue-600 to-cyan-500', placeholder: 'neo4j://user:pass@host:7687' },
  { id: 'brightdata', name: 'Bright Data', icon: Radio, color: 'from-yellow-400 to-orange-500', placeholder: 'http://brd-customer-x:pass@host:port' },
  { id: 'algolia', name: 'Algolia Search', icon: Search, color: 'from-cyan-400 to-blue-500', placeholder: 'APP_ID:API_KEY' },
];

export default function MCPGateway() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string, routing?: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Settings State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({
    github: '',
    sqlite: '',
    postman: ''
  });
  const [tempToken, setTempToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [modalError, setModalError] = useState('');
  
  // Right Sidebar Override State
  const [activeOverrideTool, setActiveOverrideTool] = useState<string | null>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('mcp_tokens');
    if (saved) {
      try {
        setTokens(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const openModal = (id: string) => {
    setActiveModal(id);
    setTempToken(tokens[id] || '');
    setModalError('');
  };

  const validateAndSaveToken = async () => {
    if (!activeModal) return;
    setIsValidating(true);
    setModalError('');

    try {
      if (tempToken.trim() !== '') {
        if (activeModal === 'github') {
          // Validate GitHub Token
          const res = await fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${tempToken}` }
          });
          if (!res.ok) throw new Error('Invalid GitHub Token or bad credentials.');
        } else if (activeModal === 'neo4j') {
          if (!tempToken.startsWith('neo4j://') && !tempToken.startsWith('neo4j+s://')) {
            throw new Error('Neo4j URI must start with neo4j:// or neo4j+s://');
          }
        } else if (activeModal === 'brightdata') {
          if (!tempToken.includes('brd-customer-')) {
            throw new Error('Invalid Bright Data proxy token format.');
          }
        } else if (activeModal === 'algolia') {
          const parts = tempToken.split(':');
          if (parts.length !== 2 || parts[0].trim() === '' || parts[1].trim() === '') {
            throw new Error('Please fill both Application ID and API Key.');
          }
        }
      }

      // If valid or empty (clearing token)
      const newTokens = { ...tokens, [activeModal]: tempToken };
      setTokens(newTokens);
      localStorage.setItem('mcp_tokens', JSON.stringify(newTokens));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const userMessage = { role: 'user' as const, content: prompt };
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
        throw new Error(`Server returned ${res.status}: ${text.substring(0, 50)}...`);
      }

      const data = await res.json();

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.result || data.error,
        routing: data.classification 
      }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Failed to connect to gateway.\n\nError: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const activeServerData = serversConfig.find(s => s.id === activeModal);

  return (
    <div className="fixed inset-0 bg-[#FAFAFA] text-slate-900 font-sans selection:bg-indigo-100 flex overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-indigo-200/40 to-purple-200/40 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[50%] rounded-full bg-gradient-to-tl from-blue-200/40 to-emerald-200/40 blur-[120px] pointer-events-none" />

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
                Enter your connection token/key for {activeServerData.name}. It will be stored securely in your browser's local storage.
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div 
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-80 bg-white/60 backdrop-blur-2xl border-r border-white/40 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 h-full"
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
            const isConnected = !!tokens[s.id];
            
            return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              key={s.id} 
              className="group relative flex items-center justify-between p-3.5 rounded-2xl border border-white bg-white/50 hover:bg-white shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${s.color} shadow-inner opacity-${isConnected ? '100' : '50'}`}>
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
                    {isConnected && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}></span>
                  </span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover/tooltip:block whitespace-nowrap bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-50">
                    {isConnected ? 'Connected' : 'Not Connected'}
                  </div>
                </div>

                {/* Settings Icon */}
                <button 
                  onClick={() => openModal(s.id)} 
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
              Connect your tools via the gear icons to fetch real MCP data!
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-20 h-full">
        
        {/* Top Navbar */}
        <div className="absolute top-0 inset-x-0 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 z-30 flex items-center px-8 justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-indigo-600" />
            <h2 className="font-bold text-slate-800 text-lg tracking-tight">HackerNoon <span className="text-indigo-600">Gateway</span></h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200/50 shadow-sm">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            System Online
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto pb-24 pt-24 custom-scrollbar scroll-smooth flex flex-col">
          <div className="max-w-4xl mx-auto px-8 w-full flex flex-col gap-2">
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
                      Enter a prompt below. Our Llama 3 router will invoke the exact tool needed, and Gemini will synthesize the perfect answer.
                    </p>
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
                            {msg.routing}
                          </span>
                        </div>
                      )}
                      <div className="prose prose-slate prose-sm max-w-none leading-relaxed whitespace-pre-wrap font-medium">
                        {msg.content}
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
                className="flex-1 bg-transparent text-slate-900 px-4 py-3 focus:outline-none placeholder:text-slate-400 font-medium text-base"
              />
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="m-1 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-sm"
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
        className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.2)] z-10 text-white h-full"
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
            const isConnected = !!tokens[s.id];
            
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
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${s.color} shadow-inner opacity-${isConnected ? '100' : '50'}`}>
                    <s.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold transition-colors ${isSelected ? 'text-white' : 'text-slate-300'}`}>{s.name}</p>
                  </div>
                </button>
                
                <div className="flex items-center gap-3 pl-2">
                  <div className="relative group/tooltip flex items-center justify-center">
                    <span className="relative flex h-2.5 w-2.5">
                      {isConnected && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}></span>
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
      </motion.div>
    </div>
  );
}
