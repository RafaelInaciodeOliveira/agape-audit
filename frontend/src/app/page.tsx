/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import useSWR from 'swr';
import { Toaster, toast } from 'sonner';
import {
  Star, BookOpen, Send, RefreshCw, Clock, Search, 
  Sparkles, Bot, UserCheck, CheckSquare, X, ShieldCheck, 
  Activity, BrainCircuit, Tag, Plus, Trash2, Pencil, 
  ArrowLeft, BarChart3, Settings, ClipboardCheck
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const fetcher = (url: string) => axios.get(url).then(res => res.data);

// --- TIPAGENS ---
interface Subtopic {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
  subtopics?: Subtopic[];
}

interface Attendant {
  id: string;
  name: string;
}

interface Audit {
  rating: number;
  violatedPromptRules: boolean;
  knowledgeBaseFail: boolean;
  auditorFeedback: string;
}

interface Chat {
  id: string;
  contactName: string;
  contactPhoto?: string;
  carteiraTag: string;
  allTags?: string[];
  updatedAt: string;
  lastMessage?: unknown;
  audit?: Audit;
  cachedMessages?: Message[];
  hasMessageAudits?: boolean; // NOVO: Flag para o selo "Parcial"
}

interface Message {
  id: string;
  source: string;
  text?: string;
  fallbackText?: string;
  body?: string;
  caption?: string;
  content?: string | Record<string, unknown>;
  type?: string;
  messageType?: string;
  fileType?: string;
  prefix?: string;
  createdAtUTC?: string;
  createdAt?: string;
  dateUTC?: string;
  date?: string;
  eventAtUTC?: string;
  sentByOrganizationMember?: { id: string };
  botInstance?: { botName: string };
}

interface MessageAudit {
  topicId?: string;
  subtopicId?: string;
  violatedPromptRules?: boolean;
  knowledgeBaseFail?: boolean;
  auditorFeedback?: string;
  clientQuestion?: string;
}
// ----------------

const DYNAMIC_TAG_COLORS = [
  'bg-red-500/20 text-red-300 border-red-500/50',
  'bg-violet-500/20 text-violet-300 border-violet-500/50',
  'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50',
  'bg-rose-500/20 text-rose-300 border-rose-500/50',
  'bg-lime-500/20 text-lime-300 border-lime-500/50',
];

function getTagBadge(tagName: string) {
  const name = (tagName || '').trim().toUpperCase();

  if (name.includes('ANTARES')) return { icon: '🌟', style: 'bg-amber-500/20 text-amber-300 border-amber-500/50' };
  if (name.includes('ARCTURUS')) return { icon: '🌸', style: 'bg-pink-500/20 text-pink-300 border-pink-500/50' };
  if (name.includes('ALPHA')) return { icon: '🔥', style: 'bg-orange-500/20 text-orange-300 border-orange-500/50' };
  if (name.includes('SIGMA')) return { icon: '🟢', style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' };
  if (name.includes('SIRIUS')) return { icon: '🟣', style: 'bg-purple-500/20 text-purple-300 border-purple-500/50' };
  if (name.includes('CLIENTE PROVER') || name.includes('PROSPECT PROVER')) return { icon: '🔵', style: 'bg-blue-600/30 text-blue-300 border-blue-500/50' };
  if (name.includes('CATHOLIC')) return { icon: '🟣', style: 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50' };
  if (name.includes('GRUPO PROVER')) return { icon: '👯', style: 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50' };
  if (name.includes('MULTIIGREJA')) return { icon: '🏘', style: 'bg-teal-600/30 text-teal-300 border-teal-500/50' };
  if (name.includes('ONBOARDING')) return { icon: '🚀', style: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' };
  if (name.includes('PROVER NA PRÁTICA') || name.includes('BKO') || name.includes('COMERCIAL')) return { icon: '🐨', style: 'bg-slate-700/60 text-slate-200 border-slate-600' };

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colorStyle = DYNAMIC_TAG_COLORS[Math.abs(hash) % DYNAMIC_TAG_COLORS.length];

  return { icon: '🏷️', style: colorStyle };
}

function formatDateTime(rawDate?: string | Date): { dateStr: string; timeStr: string } {
  if (!rawDate) return { dateStr: 'Hoje', timeStr: '' };
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return { dateStr: 'Hoje', timeStr: '' };
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return { dateStr: 'Hoje', timeStr };
    return { dateStr: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }), timeStr };
  } catch {
    return { dateStr: 'Hoje', timeStr: '' };
  }
}

function formatRelativeTime(rawDate?: string | Date): string {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `há ${diffD} dia${diffD > 1 ? 's' : ''}`;
  const diffMonths = Math.floor(diffD / 30);
  if (diffMonths < 12) return `há ${diffMonths} ${diffMonths > 1 ? 'meses' : 'mês'}`;
  const diffYears = Math.floor(diffMonths / 12);
  return `há ${diffYears} ano${diffYears > 1 ? 's' : ''}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMessageContent(msg: any): string {
  if (!msg) return 'Sem mensagem';
  if (typeof msg === 'string') {
    if (msg.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.billingType || parsed.billable !== undefined) return '📢 [Evento de Sistema / Template Enviado]';
        return renderMessageContent(parsed);
      } catch { return msg; }
    }
    return msg;
  }
  if (typeof msg === 'object') {
    const type = (msg.type || msg.messageType || '').toString().toLowerCase();
    if (type === 'audio' || msg.fileType === 'audio') return '🎤 Áudio';
    if (type === 'image' || msg.fileType === 'image') return '📷 Imagem';
    if (type === 'document' || type === 'file') return '📄 Documento';
    if (type === 'video') return '🎥 Vídeo';
    if (type === 'sticker') return '🎴 Figurinha';
    if (msg.text && typeof msg.text === 'string') return msg.text;
    if (msg.fallbackText) return msg.fallbackText;
    if (msg.body) return msg.body;
    if (msg.caption) return msg.caption;
    if (msg.content) {
      const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (contentStr.includes('"billingType"') || contentStr.includes('"billable"')) return '📢 [Mensagem de Template Automática]';
      return renderMessageContent(msg.content);
    }
    return 'Mensagem do sistema';
  }
  return 'Mensagem enviada';
}

export default function AuditDashboard() {
  const [displayedCount, setDisplayedCount] = useState(30); 
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [selectedAttendantId, setSelectedAttendantId] = useState('');
  const [statusTab, setStatusTab] = useState('finalizados');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [rating, setRating] = useState(5);
  const [violatedRules, setViolatedRules] = useState(false);
  const [kbFail, setKbFail] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  const [showTopicsManager, setShowTopicsManager] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState('');
  const [addingSubtopicTo, setAddingSubtopicTo] = useState<string | null>(null);
  const [newSubtopicName, setNewSubtopicName] = useState('');
  const [editingSubtopicId, setEditingSubtopicId] = useState<string | null>(null);
  const [editingSubtopicName, setEditingSubtopicName] = useState('');

  const [messageAudits, setMessageAudits] = useState<Record<string, MessageAudit>>({});
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [rightPanelMode, setRightPanelMode] = useState<'none' | 'chat' | 'message'>('none');

  const [msgTopicId, setMsgTopicId] = useState('');
  const [msgSubtopicId, setMsgSubtopicId] = useState('');
  const [msgViolatedRules, setMsgViolatedRules] = useState(false);
  const [msgKbFail, setMsgKbFail] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState('');
  const [msgClientQuestion, setMsgClientQuestion] = useState('');
  const [msgTrainAi, setMsgTrainAi] = useState(false);
  const [msgQaQuestion, setMsgQaQuestion] = useState('');
  const [msgQaAnswer, setMsgQaAnswer] = useState('');

  const { data: config } = useSWR(`${API_URL}/config`, fetcher);
  const agapeMemberId = config?.agapeMemberId || null;
  const attendants: Attendant[] = config?.attendants || [];

  const activeAttendantId = selectedAttendantId || agapeMemberId || '';

  const { data: topics = [], mutate: mutateTopics } = useSWR<Topic[]>(`${API_URL}/topics`, fetcher);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const chatQueryUrl = activeAttendantId 
    ? `${API_URL}/chats?search=${debouncedSearch}&attendantId=${activeAttendantId}&status=${statusTab}` 
    : null;
    
  const { data: chatsData, isLoading: loadingChats, mutate: mutateChats } = useSWR(
    chatQueryUrl, 
    fetcher, 
    { refreshInterval: 15000 }
  );

  const allChats: Chat[] = chatsData?.items || [];
  const totalChats: number = chatsData?.total || 0;
  const visibleChats = allChats.slice(0, displayedCount);

  useEffect(() => { document.title = 'Auditoria Ágape'; }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (displayedCount < allChats.length) {
        setDisplayedCount((prev) => prev + 20);
      }
    }
  };

  const handleSelectChat = async (chat: Chat) => {
    setSelectedChat(chat);
    setSelectedMessage(null);
    setRightPanelMode('none');
    setLoadingMessages(true);

    if (chat.audit) {
      setRating(chat.audit.rating || 5);
      setViolatedRules(Boolean(chat.audit.violatedPromptRules));
      setKbFail(Boolean(chat.audit.knowledgeBaseFail));
      setFeedback(chat.audit.auditorFeedback || '');
    } else {
      setRating(5);
      setViolatedRules(false);
      setKbFail(false);
      setFeedback('');
    }

    try {
      const auditsRes = await axios.get(`${API_URL}/chats/${chat.id}/message-audits`);
      setMessageAudits(auditsRes.data || {});
    } catch (_) {
      setMessageAudits({});
    }

    if (chat.cachedMessages && Array.isArray(chat.cachedMessages) && chat.cachedMessages.length > 0) {
      setMessages(chat.cachedMessages);
      setLoadingMessages(false);
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/chats/${chat.id}/messages`);
      let msgsToRender: Message[] = [];
      if (Array.isArray(res.data)) msgsToRender = res.data;
      else if (res.data && Array.isArray(res.data.items)) msgsToRender = res.data.items;
      else if (res.data && Array.isArray(res.data.messages)) msgsToRender = res.data.messages;
      else if (res.data && Array.isArray(res.data.data)) msgsToRender = res.data.data;
      setMessages(msgsToRender);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar mensagens do chat.');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat) return;
    const promise = axios.post(`${API_URL}/audits`, {
      chatId: selectedChat.id,
      clientName: selectedChat.contactName,
      carteiraTag: selectedChat.carteiraTag,
      rating,
      violatedPromptRules: violatedRules,
      knowledgeBaseFail: kbFail,
      auditorFeedback: feedback,
      auditorEmail: 'auditor@prover.com.br',
    });

    toast.promise(promise, {
      loading: 'Salvando auditoria...',
      success: () => {
        mutateChats(); 
        
        // Atualiza o estado local do selectedChat para refletir a nova nota imediatamente no cabeçalho
        setSelectedChat(prev => prev ? {
          ...prev, 
          audit: { rating, violatedPromptRules: violatedRules, knowledgeBaseFail: kbFail, auditorFeedback: feedback }
        } : null);
        
        return 'Auditoria geral salva com sucesso!';
      },
      error: 'Erro ao salvar a auditoria.',
    });
  };

  const findPrecedingClientQuestion = (index: number) => {
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i]?.source === 'Contact') return renderMessageContent(messages[i]);
    }
    return '';
  };

  const handleSelectMessage = (msg: Message, index: number) => {
    setSelectedMessage(msg);
    setRightPanelMode('message');
    const existing = messageAudits[msg.id];
    if (existing) {
      setMsgTopicId(existing.topicId || '');
      setMsgSubtopicId(existing.subtopicId || '');
      setMsgViolatedRules(Boolean(existing.violatedPromptRules));
      setMsgKbFail(Boolean(existing.knowledgeBaseFail));
      setMsgFeedback(existing.auditorFeedback || '');
      setMsgClientQuestion(existing.clientQuestion || '');
    } else {
      setMsgTopicId('');
      setMsgSubtopicId('');
      setMsgViolatedRules(false);
      setMsgKbFail(false);
      setMsgFeedback('');
      setMsgClientQuestion(findPrecedingClientQuestion(index));
    }
    setMsgTrainAi(false);
    setMsgQaQuestion('');
    setMsgQaAnswer('');
  };

  const handleSaveMessageAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !selectedMessage) return;

    const promise = axios.post(`${API_URL}/message-audits`, {
      chatId: selectedChat.id,
      messageId: selectedMessage.id,
      clientQuestion: msgClientQuestion,
      topicId: msgTopicId || null,
      subtopicId: msgSubtopicId || null,
      violatedPromptRules: msgViolatedRules,
      knowledgeBaseFail: msgKbFail,
      auditorFeedback: msgFeedback,
      trainAi: msgTrainAi,
      qaQuestion: msgQaQuestion,
      qaAnswer: msgQaAnswer,
      auditorEmail: 'auditor@prover.com.br',
    });

    toast.promise(promise, {
      loading: 'Salvando...',
      success: () => {
        axios.get(`${API_URL}/chats/${selectedChat.id}/message-audits`).then(res => {
          setMessageAudits(res.data || {});
        });
        setSelectedMessage(null);
        mutateChats(); // Para atualizar a flag de "Parcial" na barra lateral
        return 'Resposta auditada com sucesso!';
      },
      error: 'Erro ao salvar auditoria da resposta.',
    });
  };

  const handleAddTopic = async () => {
    if (!newTopicName.trim()) return;
    await axios.post(`${API_URL}/topics`, { name: newTopicName.trim() });
    setNewTopicName('');
    mutateTopics();
  };

  const handleRenameTopic = async (id: string) => {
    if (!editingTopicName.trim()) return;
    await axios.put(`${API_URL}/topics/${id}`, { name: editingTopicName.trim() });
    setEditingTopicId(null);
    mutateTopics();
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm('Excluir este tópico e seus subtópicos?')) return;
    await axios.delete(`${API_URL}/topics/${id}`);
    mutateTopics();
  };

  const handleAddSubtopic = async (topicId: string) => {
    if (!newSubtopicName.trim()) return;
    await axios.post(`${API_URL}/topics/${topicId}/subtopics`, { name: newSubtopicName.trim() });
    setNewSubtopicName('');
    setAddingSubtopicTo(null);
    mutateTopics();
  };

  const handleRenameSubtopic = async (id: string) => {
    if (!editingSubtopicName.trim()) return;
    await axios.put(`${API_URL}/subtopics/${id}`, { name: editingSubtopicName.trim() });
    setEditingSubtopicId(null);
    mutateTopics();
  };

  const handleDeleteSubtopic = async (id: string) => {
    if (!confirm('Excluir este subtópico?')) return;
    await axios.delete(`${API_URL}/subtopics/${id}`);
    mutateTopics();
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      <Toaster theme="dark" position="top-right" richColors />

      {/* 1. PAINEL ESQUERDO: Lista de Entrada de Chats */}
      <div className="w-80 lg:w-96 border-r border-slate-800/80 flex flex-col bg-slate-950/60 backdrop-blur-md">
        
        <div className="p-4 border-b border-slate-800/80 space-y-3 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-blue-400 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500 fill-blue-500/20" />
              Auditoria Ágape
            </h1>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-mono font-medium">
              {visibleChats.length} de {totalChats} chats
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/relatorios"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-blue-300 hover:border-blue-500/40 transition-all"
            >
              <BarChart3 className="w-3.5 h-3.5" /> Relatórios
            </Link>
            <button
              onClick={() => setShowTopicsManager(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-blue-300 hover:border-blue-500/40 transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" /> Temas
            </button>
          </div>

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
          
          <div className="flex items-center gap-2 bg-blue-600/10 border border-blue-500/30 rounded-xl px-2.5 py-1.5 focus-within:border-blue-500 transition-all">
            <Bot className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={activeAttendantId}
              onChange={(e) => setSelectedAttendantId(e.target.value)}
              className="w-full bg-transparent text-xs font-medium text-blue-300 outline-none cursor-pointer"
            >
              <option value="TODOS" className="bg-slate-900 text-slate-200">Todos atendentes</option>
              {attendants.map((a: Attendant) => (
                <option key={a.id} value={a.id} className="bg-slate-900 text-slate-200">
                  {a.name}
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
          className="flex-1 overflow-y-auto divide-y divide-slate-800/40 custom-scrollbar relative"
        >
          {loadingChats && visibleChats.length === 0 ? (
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
            visibleChats.map((chat: Chat) => {
              const { dateStr, timeStr } = formatDateTime(chat.updatedAt);
              const relativeTime = formatRelativeTime(chat.updatedAt);
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
                    <span className="flex items-center gap-2 min-w-0">
                      {chat.contactPhoto ? (
                        <img src={chat.contactPhoto} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-[10px] shrink-0">
                          {chat.contactName?.charAt(0)?.toUpperCase() || 'C'}
                        </span>
                      )}
                      <span className="font-semibold text-slate-200 text-xs truncate">
                        {chat.contactName}
                      </span>
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 uppercase shrink-0 ${carteiraBadge.style}`}>
                      {carteiraBadge.icon} {chat.carteiraTag}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 truncate mb-2 leading-relaxed">
                    {renderMessageContent(chat.lastMessage)}
                  </p>

                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="flex items-center gap-1 text-slate-500" title={`${dateStr} ${timeStr ? `às ${timeStr}` : ''}`}>
                      <Clock className="w-3 h-3 text-slate-500" />
                      {relativeTime}
                    </span>

                    {/* NOVO: Lógica visual para Auditado 100% vs Parcial vs Pendente */}
                    {chat.audit ? (
                      <span className="flex items-center text-emerald-400 font-semibold gap-0.5 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded shadow-sm">
                        <Star className="w-2.5 h-2.5 fill-emerald-400" /> {chat.audit.rating}★
                      </span>
                    ) : chat.hasMessageAudits ? (
                      <span className="flex items-center text-amber-400 font-semibold gap-1 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded shadow-sm">
                        <Activity className="w-2.5 h-2.5" /> Parcial
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium px-1.5 py-0.5 border border-slate-800 rounded bg-slate-900/50">
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
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/90 flex justify-between items-center backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                {selectedChat.contactPhoto ? (
                  <img src={selectedChat.contactPhoto} alt="" className="w-10 h-10 rounded-full object-cover border border-blue-500/30 shadow-inner" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shadow-inner">
                    {selectedChat.contactName?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                )}

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

              {/* NOVO: Botão de Editar Avaliação mais discreto quando já estiver avaliado */}
              <button
                onClick={() => { setSelectedMessage(null); setRightPanelMode('chat'); }}
                title="Avaliar o atendimento como um todo (nota geral + observação)"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  selectedChat.audit
                    ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white shadow-sm'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                }`}
              >
                {selectedChat.audit ? (
                  <>
                    <Pencil className="w-3.5 h-3.5" />
                    Editar avaliação ({selectedChat.audit.rating}★)
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4" />
                    Avaliar Atendimento
                  </>
                )}
              </button>
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
                messages.map((m: Message, i: number) => {
                  const isFromContact = m.source === 'Contact';
                  const isFromAgape = Boolean(agapeMemberId) && m.sentByOrganizationMember?.id === agapeMemberId;
                  const isFromBotFlow = m.source === 'Bot' && !isFromAgape;
                  const isAttendant = !isFromContact;
                  const rawTime = m.createdAtUTC || m.createdAt || m.dateUTC || m.date || m.eventAtUTC;
                  const { dateStr, timeStr } = formatDateTime(rawTime);
                  const audited = messageAudits[m.id];
                  const isSelected = selectedMessage?.id === m.id;

                  let label = '';
                  if (isFromAgape) label = '🤖 Ágape (IA)';
                  else if (isFromBotFlow) label = `⚙️ ${m.botInstance?.botName || 'Fluxo automático'}`;
                  else if (isAttendant) label = `🧑‍💼 ${(m.prefix || 'Atendente').replace(/\*/g, '').replace(/:$/, '')}`;

                  const avatar = isFromAgape || isFromBotFlow ? (
                    <img src="/agape.png" alt="Ágape" className="w-7 h-7 rounded-full object-cover border border-blue-300/50 shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                  );

                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2 ${isFromContact ? 'justify-start' : 'justify-end'}`}
                    >
                      {isFromContact && (
                        <div
                          className="max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm relative group bg-slate-800 text-slate-300 rounded-tl-none"
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{renderMessageContent(m)}</p>
                          <span className="block text-right text-[9px] opacity-60 font-mono mt-1">
                            {dateStr} {timeStr && `às ${timeStr}`}
                          </span>
                        </div>
                      )}
                      {isAttendant && (
                        <>
                          <div
                            onClick={() => isFromAgape && handleSelectMessage(m, i)}
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm relative group bg-blue-500 text-white rounded-tr-none shadow-md shadow-blue-500/20 transition-all ${
                              isFromAgape ? 'cursor-pointer hover:brightness-110' : ''
                            } ${isSelected ? 'ring-2 ring-blue-300 scale-[1.01]' : ''}`}
                          >
                            <div className="flex justify-between items-center gap-4 mb-1.5 border-b border-white/10 pb-1">
                              <span className="text-[10px] font-bold flex items-center gap-1 text-blue-50">
                                {label}
                              </span>

                              <span className="text-[9px] opacity-75 font-mono text-blue-100">
                                {dateStr} {timeStr && `às ${timeStr}`}
                              </span>
                            </div>

                            <p className="whitespace-pre-wrap leading-relaxed">
                              {renderMessageContent(m)}
                            </p>

                            {isFromAgape && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleSelectMessage(m, i); }}
                                className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  audited
                                    ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                                    : 'bg-white/15 text-white border border-white/30 hover:bg-white/25'
                                }`}
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                {audited ? 'Auditado · editar' : 'Auditar esta resposta'}
                              </button>
                            )}
                          </div>
                          {avatar}
                        </>
                      )}
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
      {selectedChat && rightPanelMode === 'message' && selectedMessage && (
        <div className="w-80 lg:w-96 bg-slate-950 p-5 flex flex-col overflow-y-auto border-l border-slate-800/80 relative custom-scrollbar shadow-2xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-200">
              <ClipboardCheck className="w-4 h-4 text-blue-400" /> Auditoria da Resposta
            </h3>
            <button
              onClick={() => { setSelectedMessage(null); setRightPanelMode('none'); }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveMessageAudit} className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5 text-[11px] text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-300">Resposta do Ágape:</span> {renderMessageContent(selectedMessage).slice(0, 180)}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Pergunta do cliente (contexto)</label>
              <input
                type="text"
                value={msgClientQuestion}
                onChange={(e) => setMsgClientQuestion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Tópico</label>
                <select
                  value={msgTopicId}
                  onChange={(e) => { setMsgTopicId(e.target.value); setMsgSubtopicId(''); }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="">Selecione...</option>
                  {topics.map((t: Topic) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Subtópico</label>
                <select
                  value={msgSubtopicId}
                  onChange={(e) => setMsgSubtopicId(e.target.value)}
                  disabled={!msgTopicId}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-40"
                >
                  <option value="">-</option>
                  {(topics.find((t: Topic) => t.id === msgTopicId)?.subtopics || []).map((s: Subtopic) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60 hover:border-slate-700 transition-all">
                <input
                  type="checkbox"
                  checked={msgViolatedRules}
                  onChange={(e) => setMsgViolatedRules(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 mt-0.5"
                />
                <span className="leading-tight">Violou diretrizes? (ex: usou listas/menus, se reapresentou)</span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60 hover:border-slate-700 transition-all">
                <input
                  type="checkbox"
                  checked={msgKbFail}
                  onChange={(e) => setMsgKbFail(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 mt-0.5"
                />
                <span className="leading-tight">Resposta Incorreta / Falta na Base</span>
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Observações do Auditor</label>
              <textarea
                value={msgFeedback}
                onChange={(e) => setMsgFeedback(e.target.value)}
                rows={3}
                placeholder="Ex: A resposta ignorou o horário mencionado pelo cliente..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-blue-500/80 transition-all placeholder-slate-600 custom-scrollbar"
              />
            </div>

            <div className="pt-3 border-t border-slate-800/80">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-400 mb-2.5">
                <input
                  type="checkbox"
                  checked={msgTrainAi}
                  onChange={(e) => setMsgTrainAi(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600"
                />
                <RefreshCw className="w-3.5 h-3.5" /> Enviar Q&A para Treinar o Ágape
              </label>

              {msgTrainAi && (
                <div className="space-y-2.5 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 transition-all">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Pergunta do Cliente</label>
                    <input
                      type="text"
                      value={msgQaQuestion}
                      onChange={(e) => setMsgQaQuestion(e.target.value)}
                      placeholder="Ex: Como faço para emitir carteirinha?"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Resposta Ideal Esperada</label>
                    <textarea
                      value={msgQaAnswer}
                      onChange={(e) => setMsgQaAnswer(e.target.value)}
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
              <Send className="w-3.5 h-3.5" /> Salvar Auditoria da Resposta
            </button>
          </form>
        </div>
      )}

      {selectedChat && rightPanelMode === 'chat' && (
        <div className="w-80 lg:w-96 bg-slate-950 p-5 flex flex-col overflow-y-auto border-l border-slate-800/80 relative custom-scrollbar shadow-2xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-200">
              <BookOpen className="w-4 h-4 text-blue-400" /> Auditoria do Atendimento
            </h3>

            <button
              onClick={() => setRightPanelMode('none')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
            Nota geral do atendimento. Pra auditar respostas específicas do Ágape em detalhe (tópico, falha na base, treino), clique na bolha da resposta na conversa.
          </p>

          <form onSubmit={handleSaveAudit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                Classificação Geral do Atendimento
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
                <span className="leading-tight">Violou diretrizes em algum momento do atendimento?</span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60 hover:border-slate-700 transition-all">
                <input
                  type="checkbox"
                  checked={kbFail}
                  onChange={(e) => setKbFail(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 mt-0.5"
                />
                <span className="leading-tight">Teve resposta incorreta / falta na base em algum momento?</span>
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Observações Gerais do Auditor
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Resumo do atendimento como um todo..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-blue-500/80 transition-all placeholder-slate-600 custom-scrollbar"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Salvar Auditoria Geral
            </button>
          </form>
        </div>
      )}

      {showTopicsManager && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-200">
                <Tag className="w-4 h-4 text-blue-400" /> Tópicos e Subtópicos
              </h3>
              <button
                onClick={() => setShowTopicsManager(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {topics.map((t: Topic) => (
                <div key={t.id} className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    {editingTopicId === t.id ? (
                      <input
                        autoFocus
                        value={editingTopicName}
                        onChange={(e) => setEditingTopicName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameTopic(t.id)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-slate-200">{t.name}</span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {editingTopicId === t.id ? (
                        <button onClick={() => handleRenameTopic(t.id)} className="p-1 text-emerald-400 hover:bg-slate-800 rounded cursor-pointer">
                          <CheckSquare className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => { setEditingTopicId(t.id); setEditingTopicName(t.name); }} className="p-1 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded cursor-pointer">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => setAddingSubtopicTo(addingSubtopicTo === t.id ? null : t.id)} className="p-1 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded cursor-pointer">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteTopic(t.id)} className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {(t.subtopics || []).length > 0 && (
                    <div className="mt-2 pl-3 border-l border-slate-800 space-y-1">
                      {t.subtopics?.map((s: Subtopic) => (
                        <div key={s.id} className="flex items-center justify-between gap-2">
                          {editingSubtopicId === s.id ? (
                            <input
                              autoFocus
                              value={editingSubtopicName}
                              onChange={(e) => setEditingSubtopicName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubtopic(s.id)}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded p-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-400">{s.name}</span>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            {editingSubtopicId === s.id ? (
                              <button onClick={() => handleRenameSubtopic(s.id)} className="p-0.5 text-emerald-400 hover:bg-slate-800 rounded cursor-pointer">
                                <CheckSquare className="w-3 h-3" />
                              </button>
                            ) : (
                              <button onClick={() => { setEditingSubtopicId(s.id); setEditingSubtopicName(s.name); }} className="p-0.5 text-slate-500 hover:text-blue-300 hover:bg-slate-800 rounded cursor-pointer">
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            <button onClick={() => handleDeleteSubtopic(s.id)} className="p-0.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded cursor-pointer">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingSubtopicTo === t.id && (
                    <div className="mt-2 pl-3 flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={newSubtopicName}
                        onChange={(e) => setNewSubtopicName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubtopic(t.id)}
                        placeholder="Nome do subtópico"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded p-1 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                      />
                      <button onClick={() => handleAddSubtopic(t.id)} className="p-1 text-blue-400 hover:bg-slate-800 rounded cursor-pointer">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center gap-2 bg-slate-900/50">
              <input
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                placeholder="Novo tópico..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddTopic}
                className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}