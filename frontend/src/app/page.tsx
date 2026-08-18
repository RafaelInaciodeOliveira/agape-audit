'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Star, MessageSquare, BookOpen, Send, Filter, 
  RefreshCw, Clock, Search, Sparkles, Bot, UserCheck, 
  CheckSquare, Square, X, ShieldCheck, Activity, BrainCircuit
} from 'lucide-react';

const API_URL = 'http://localhost:3001/api';
const CARTEIRAS = ['TODAS', 'ANTARES', 'ARCTURUS', 'ALPHA', 'SIGMA', 'SIRIUS'];

function getTagBadge(tagName: string) {
  const name = (tagName || '').trim().toUpperCase();

  if (name.includes('ANTARES')) {
    return { icon: '🌟', style: 'bg-amber-500/20 text-amber-300 border-amber-500/50' };
  }
  if (name.includes('ARCTURUS')) {
    return { icon: '🌸', style: 'bg-pink-500/20 text-pink-300 border-pink-500/50' };
  }
  if (name.includes('ALPHA')) {
    return { icon: '🔥', style: 'bg-orange-500/20 text-orange-300 border-orange-500/50' };
  }
  if (name.includes('SIGMA')) {
    return { icon: '🟢', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' };
  }
  if (name.includes('SIRIUS')) {
    return { icon: '🟣', style: 'bg-purple-500/20 text-purple-300 border-purple-500/50' };
  }

  if (name.includes('CLIENTE PROVER') || name.includes('PROSPECT PROVER')) {
    return { icon: '🔵', style: 'bg-blue-600/30 text-blue-300 border-blue-500/50' };
  }
  if (name.includes('CATHOLIC')) {
    return { icon: '🟣', style: 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50' };
  }
  if (name.includes('GRUPO PROVER')) {
    return { icon: '👯', style: 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50' };
  }
  if (name.includes('MULTIIGREJA')) {
    return { icon: '🏘', style: 'bg-teal-600/30 text-teal-300 border-teal-500/50' };
  }
  if (name.includes('ONBOARDING')) {
    return { icon: '🚀', style: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' };
  }
  if (name.includes('PROVER NA PRÁTICA') || name.includes('BKO') || name.includes('COMERCIAL')) {
    return { icon: '🐨', style: 'bg-slate-700/60 text-slate-200 border-slate-600' };
  }

  return { icon: '🏷️', style: 'bg-slate-800 text-slate-300 border-slate-700' };
}

// O SEU FORMATADOR ORIGINAL (NÃO TOQUEI NELE)
function formatDateTime(rawDate?: any): { dateStr: string; timeStr: string } {
  if (!rawDate) return { dateStr: 'Hoje', timeStr: '' };

  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return { dateStr: 'Hoje', timeStr: '' };

    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const now = new Date();
    
    if (d.toDateString() === now.toDateString()) {
      return { dateStr: 'Hoje', timeStr };
    }

    const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return { dateStr, timeStr };
  } catch {
    return { dateStr: 'Hoje', timeStr: '' };
  }
}

function renderMessageContent(msg: any): string {
  if (!msg) return 'Sem mensagem';
  
  if (typeof msg === 'string') {
    if (msg.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(msg);
        // Bloqueia a renderização de recibos de cobrança do WhatsApp
        if (parsed.billingType || parsed.billable !== undefined) {
           return '📢 [Evento de Sistema / Template Enviado]';
        }
        return renderMessageContent(parsed);
      } catch {
        return msg;
      }
    }
    return msg;
  }

  if (typeof msg === 'object') {
    const type = (msg.type || msg.messageType || '').toString().toLowerCase();

    // Mapeamento de Mídias
    if (type === 'audio' || msg.fileType === 'audio') return '🎤 Áudio';
    if (type === 'image' || msg.fileType === 'image') return '📷 Imagem';
    if (type === 'document' || type === 'file') return '📄 Documento';
    if (type === 'video') return '🎥 Vídeo';
    if (type === 'sticker') return '🎴 Figurinha';

    // 1º TENTATIVA: Procura o texto real que a Umbler pode ter escondido
    if (msg.text && typeof msg.text === 'string') return msg.text;
    if (msg.fallbackText) return msg.fallbackText;
    if (msg.body) return msg.body;
    if (msg.caption) return msg.caption;

    // 2º TENTATIVA: O "content" (que às vezes é o vilão JSON)
    if (msg.content) {
      const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (contentStr.includes('"billingType"') || contentStr.includes('"billable"')) {
        return '📢 [Mensagem de Template Automática]';
      }
      return renderMessageContent(msg.content);
    }

    return 'Mensagem do sistema';
  }

  return 'Mensagem enviada';
}

export default function AuditDashboard() {
  const [allChats, setAllChats] = useState<any[]>([]);
  const [displayedCount, setDisplayedCount] = useState(30); 
  const [totalChats, setTotalChats] = useState(0);
  const [selectedCarteira, setSelectedCarteira] = useState('TODAS');
  const [searchTerm, setSearchTerm] = useState('');
  
  // FIX: Padrão ativado para Apenas Ágape
  const [onlyAgape, setOnlyAgape] = useState(true); 
  // FIX: Status Padrão na Entrada
  const [statusTab, setStatusTab] = useState('entrada');

  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Form de Auditoria
  const [rating, setRating] = useState(5);
  const [violatedRules, setViolatedRules] = useState(false);
  const [kbFail, setKbFail] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  // Form de Treinamento
  const [trainAi, setTrainAi] = useState(false);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');

  const fetchChats = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/chats`, {
        params: {
          carteira: selectedCarteira,
          search: searchTerm,
          onlyAgape: onlyAgape ? 'true' : 'false',
          status: statusTab
        }
      });
      setAllChats(res.data.items || []);
      setTotalChats(res.data.total || 0);
    } catch (err) {
      console.error('Erro ao buscar chats:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats(false);
    const interval = setInterval(() => {
      fetchChats(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedCarteira, searchTerm, onlyAgape, statusTab]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (displayedCount < allChats.length) {
        setDisplayedCount((prev) => prev + 20);
      }
    }
  };

  const handleSelectChat = async (chat: any) => {
    console.log("🔍 1. Chat clicado (Resumo):", chat);
    setSelectedChat(chat);
    setLoadingMessages(true);
    
    if (chat.audit) {
      setRating(chat.audit.rating || 5);
      setViolatedRules(Boolean(chat.audit.violatedPromptRules));
      setKbFail(Boolean(chat.audit.knowledgeBaseFail));
      setFeedback(chat.audit.auditorFeedback || '');
      setTrainAi(false);
    } else {
      setRating(5);
      setViolatedRules(false);
      setKbFail(false);
      setFeedback('');
      setTrainAi(false);
    }

    console.log("📦 2. Mensagens que o Backend conseguiu guardar em cache:", chat.cachedMessages);

    if (chat.cachedMessages && Array.isArray(chat.cachedMessages) && chat.cachedMessages.length > 0) {
      console.log("✅ 3. Usando mensagens do cache!");
      setMessages(chat.cachedMessages);
      setLoadingMessages(false);
      return;
    }

    console.log("⚠️ Cache vazio ou inválido. Buscando direto da API local...");
    try {
      const res = await axios.get(`${API_URL}/chats/${chat.id}/messages`);
      console.log("📡 4. Resposta CRUA da API:", res.data);

      let msgsToRender: any[] = [];
      
      if (Array.isArray(res.data)) {
        msgsToRender = res.data;
      } else if (res.data && Array.isArray(res.data.items)) {
        msgsToRender = res.data.items;
      } else if (res.data && Array.isArray(res.data.messages)) {
        msgsToRender = res.data.messages;
      } else if (res.data && Array.isArray(res.data.data)) {
        msgsToRender = res.data.data;
      } else {
        console.warn("🚨 ALERTA: Não achamos nenhum array dentro da resposta!", res.data);
      }

      console.log("🎯 5. Resultado final que vai para a tela:", msgsToRender);
      setMessages(msgsToRender);
    } catch (err) {
      console.error('❌ Erro na requisição:', err);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat) return;

    try {
      await axios.post(`${API_URL}/audits`, {
        chatId: selectedChat.id,
        clientName: selectedChat.contactName,
        carteiraTag: selectedChat.carteiraTag,
        rating,
        violatedPromptRules: violatedRules,
        knowledgeBaseFail: kbFail,
        auditorFeedback: feedback,
        trainAi,
        qaQuestion,
        qaAnswer,
        auditorEmail: 'auditor@prover.com.br',
      });

      alert('✅ Auditoria salva com sucesso!');
      fetchChats(true);
    } catch (err) {
      alert('❌ Erro ao salvar auditoria');
    }
  };

  const visibleChats = allChats.slice(0, displayedCount);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      
      {/* 1. PAINEL ESQUERDO: Lista de Entrada de Chats */}
      <div className="w-80 lg:w-96 border-r border-slate-800/80 flex flex-col bg-slate-950/60 backdrop-blur-md">
        
        <div className="p-4 border-b border-slate-800/80 space-y-3 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-blue-400 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500 fill-blue-500/20" /> 
              Ágape Audit
            </h1>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-mono font-medium">
              {visibleChats.length} de {totalChats} chats
            </span>
          </div>

          {/* Abas (Apenas Entrada, Esperando e Finalizados) */}
          <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 text-[11px] font-medium justify-between">
            {[
              { id: 'entrada', label: 'Entrada' },
              { id: 'esperando', label: 'Esperando' },
              { id: 'finalizados', label: 'Finalizados' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id)}
                className={`flex-1 py-1 text-center rounded-lg transition-all cursor-pointer ${
                  statusTab === tab.id 
                    ? 'bg-blue-600 text-white font-semibold shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setOnlyAgape(!onlyAgape)}
            className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              onlyAgape 
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' 
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              Apenas Atendimentos do Ágape
            </span>
            {onlyAgape ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 focus-within:border-blue-500 transition-all">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedCarteira}
              onChange={(e) => setSelectedCarteira(e.target.value)}
              className="w-full bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer"
            >
              {CARTEIRAS.map((c) => (
                <option key={c} value={c} className="bg-slate-900 text-slate-200">
                  Carteira: {c}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar assunto ou contato..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/60 transition-all"
            />
          </div>
        </div>

        <div 
          onScroll={handleScroll} 
          className="flex-1 overflow-y-auto divide-y divide-slate-800/40 custom-scrollbar"
        >
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <Clock className="w-5 h-5 animate-spin text-blue-500" /> 
              Sincronizando chats do Umbler...
            </div>
          ) : visibleChats.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs space-y-1">
              <p className="font-semibold text-slate-400">Nenhum chat encontrado</p>
              <p className="text-[11px] opacity-70">
                Ajuste a busca ou filtro de carteira.
              </p>
            </div>
          ) : (
            visibleChats.map((chat) => {
              const { dateStr, timeStr } = formatDateTime(chat.updatedAt);
              const carteiraBadge = getTagBadge(chat.carteiraTag);

              return (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`p-3.5 cursor-pointer hover:bg-slate-900/60 transition-all relative ${
                    selectedChat?.id === chat.id 
                      ? 'bg-slate-900/90 border-l-4 border-blue-500' 
                      : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5 gap-2">
                    <span className="font-semibold text-slate-200 text-xs truncate max-w-[160px]">
                      {chat.contactName}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 uppercase shrink-0 ${carteiraBadge.style}`}>
                      {carteiraBadge.icon} {chat.carteiraTag}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 truncate mb-2 leading-relaxed">
                    {renderMessageContent(chat.lastMessage)}
                  </p>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {/* O SEU RENDERIZADOR PERFEITO: */}
                      {dateStr} {timeStr ? `às ${timeStr}` : ''}
                    </span>

                    {chat.audit ? (
                      <span className="flex items-center text-emerald-400 font-semibold gap-0.5 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        <Star className="w-2.5 h-2.5 fill-emerald-400" /> {chat.audit.rating}★
                      </span>
                    ) : (
                      <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium">
                        Pendente
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. PAINEL CENTRAL */}
      <div className="flex-1 flex flex-col bg-slate-900/40 relative">
        {selectedChat ? (
          <>
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/90 flex justify-between items-center backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shadow-inner">
                  {selectedChat.contactName?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                
                <div>
                  <h2 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    {selectedChat.contactName}
                  </h2>
                  
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {(selectedChat.allTags || []).map((tag: string, index: number) => {
                      const badge = getTagBadge(tag);
                      return (
                        <span 
                          key={index}
                          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shadow-sm ${badge.style}`}
                        >
                          <span>{badge.icon}</span>
                          <span>{tag}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-900/30 custom-scrollbar">
              {loadingMessages ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                  <Clock className="w-5 h-5 animate-spin text-blue-500" />
                  Carregando mensagens da conversa...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <BrainCircuit className="w-10 h-10 text-slate-700 animate-pulse" />
                  <h3 className="text-slate-400 font-bold text-sm">Nenhuma mensagem salva</h3>
                  <p className="text-slate-600 text-xs max-w-xs">
                    Inicie ou atualize a conversa no Umbler para sincronizar.
                  </p>
                </div>
              ) : (
                messages.map((m: any, i: number) => {
                  const isBot = m.fromType === 'Bot' || m.fromName === 'Ágape' || m.botInstanceId || m.aiAgentId || m.sentByOrganizationMember === false;
                  const rawTime = m.createdAtUTC || m.createdAt || m.dateUTC || m.date || m.eventAtUTC;
                  const { dateStr, timeStr } = formatDateTime(rawTime);

                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm relative group ${
                          isBot
                            ? 'bg-slate-800/90 text-slate-100 rounded-tl-none border border-slate-700/80'
                            : 'bg-blue-600 text-white rounded-tr-none'
                        }`}
                      >
                        <div className="flex justify-between items-center gap-4 mb-1.5 border-b border-white/10 pb-1">
                          <span className={`text-[10px] font-bold flex items-center gap-1 ${isBot ? 'text-blue-400' : 'text-blue-100'}`}>
                            {isBot ? <Bot className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                            {isBot ? '🤖 Ágape (IA)' : '👤 Cliente'}
                          </span>
                          
                          <span className="text-[9px] opacity-75 font-mono text-slate-300">
                            {dateStr} {timeStr && `às ${timeStr}`}
                          </span>
                        </div>

                        <p className="whitespace-pre-wrap leading-relaxed">
  {renderMessageContent(m)}
</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-36 h-36 rounded-full border border-blue-500/20 animate-ping opacity-75"></div>
              <div className="absolute w-28 h-28 rounded-full border border-blue-400/30 animate-spin" style={{ animationDuration: '8s' }}></div>
              
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600/30 via-indigo-500/20 to-cyan-400/30 border border-blue-500/40 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
                <BrainCircuit className="w-12 h-12 text-blue-400 animate-pulse" />
              </div>

              <div className="absolute -top-2 -right-2 bg-blue-900/80 border border-blue-500/40 text-blue-300 text-[9px] font-mono px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                <Activity className="w-2.5 h-2.5 text-blue-400 animate-bounce" /> Sistema Ativo
              </div>
            </div>

            <div className="space-y-1.5 max-w-sm">
              <h2 className="text-slate-100 font-bold text-base flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                Central de Auditoria Inteligente
              </h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                Selecione uma conversa ao lado para analisar o desempenho do robô Ágape e treinar a base de conhecimento.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. PAINEL DIREITO: Form de Auditoria */}
      {selectedChat && (
        <div className="w-80 lg:w-96 bg-slate-950 p-5 flex flex-col overflow-y-auto border-l border-slate-800/80 relative custom-scrollbar">
          
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-200">
              <BookOpen className="w-4 h-4 text-blue-400" /> Auditoria do Atendimento
            </h3>

            <button
              onClick={() => setSelectedChat(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
              title="Fechar painel de auditoria"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveAudit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                Classificação da Resposta da IA
              </label>
              <div className="flex gap-1.5 bg-slate-900/80 p-2 rounded-xl border border-slate-800/80 justify-around">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 focus:outline-none hover:scale-125 transition-all cursor-pointer"
                  >
                    <Star className={`w-5 h-5 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Conformidade com o Prompt
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60 hover:border-slate-700 transition-all">
                <input
                  type="checkbox"
                  checked={violatedRules}
                  onChange={(e) => setViolatedRules(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 mt-0.5"
                />
                <span className="leading-tight">Violou diretrizes? (ex: usou listas/menus, se reapresentou)</span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60 hover:border-slate-700 transition-all">
                <input
                  type="checkbox"
                  checked={kbFail}
                  onChange={(e) => setKbFail(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 mt-0.5"
                />
                <span className="leading-tight">Resposta Incorreta / Falta na Base</span>
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Observações do Auditor
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Ex: A IA se reapresentou no meio da conversa..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-blue-500/80 transition-all placeholder-slate-600 custom-scrollbar"
              />
            </div>

            <div className="pt-3 border-t border-slate-800/80">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-400 mb-2.5">
                <input
                  type="checkbox"
                  checked={trainAi}
                  onChange={(e) => setTrainAi(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600"
                />
                <RefreshCw className="w-3.5 h-3.5" /> Enviar Q&A para Treinar o Ágape
              </label>

              {trainAi && (
                <div className="space-y-2.5 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Pergunta do Cliente</label>
                    <input
                      type="text"
                      value={qaQuestion}
                      onChange={(e) => setQaQuestion(e.target.value)}
                      placeholder="Ex: Como faço para emitir carteirinha?"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Resposta Ideal Esperada</label>
                    <textarea
                      value={qaAnswer}
                      onChange={(e) => setQaAnswer(e.target.value)}
                      rows={2}
                      placeholder="Ex: Acesse Cadastros > Carteirinhas..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-blue-500 custom-scrollbar"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Salvar Auditoria
            </button>
          </form>
        </div>
      )}
    </div>
  );
}