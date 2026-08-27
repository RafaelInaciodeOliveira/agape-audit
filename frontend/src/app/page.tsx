/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Link from 'next/link';
import useSWR from 'swr';
import { Toaster, toast } from 'sonner';
import {
  Star, BookOpen, Send, RefreshCw, Clock, Search, 
  Sparkles, Bot, UserCheck, CheckSquare, X, ShieldCheck, 
  Activity, BrainCircuit, Tag, Plus, Trash2, Pencil, 
  ArrowLeft, BarChart3, Settings, ClipboardCheck, Image as ImageIcon, EyeOff, Eye, AlertTriangle, Filter, Check, ListX, ChevronDown
} from 'lucide-react';
import { useAuth } from './hooks/useAuth'; 

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const fetcher = (url: string) => axios.get(url).then(res => res.data);

// --- TIPAGENS ---
interface Subtopic { id: string; name: string; }
interface Topic { id: string; name: string; subtopics?: Subtopic[]; }
interface FailReason { id: string; name: string; }
interface Attendant { id: string; name: string; }
interface Audit { rating: number | null; failReasons?: string[]; auditorFeedback: string; topicId?: string; subtopicId?: string; }
interface Chat { id: string; contactName: string; contactPhoto?: string; carteiraTag: string; allTags?: string[]; updatedAt: string; lastMessage?: unknown; audit?: Audit; cachedMessages?: Message[]; hasMessageAudits?: boolean; }
interface Message { id: string; source: string; text?: string; fallbackText?: string; body?: string; caption?: string; content?: string | Record<string, unknown>; type?: string; messageType?: string; fileType?: string; prefix?: string; createdAtUTC?: string; createdAt?: string; dateUTC?: string; date?: string; eventAtUTC?: string; sentByOrganizationMember?: { id: string }; botInstance?: { botName: string }; }
interface MessageAudit { topicId?: string; subtopicId?: string; failReasons?: string[]; auditorFeedback?: string; clientQuestion?: string; targetModule?: string; }
// ----------------

const DYNAMIC_TAG_COLORS = [
  'bg-red-500/20 text-red-300 border-red-500/50',
  'bg-violet-500/20 text-violet-300 border-violet-500/50',
  'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50',
  'bg-rose-500/20 text-rose-300 border-rose-500/50',
  'bg-lime-500/20 text-lime-300 border-lime-500/50',
];

function getRatingColor(rating: number | null) {
  if (rating === 1) return { text: 'text-red-500', fill: 'fill-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' };
  if (rating === 2) return { text: 'text-orange-500', fill: 'fill-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
  if (rating === 3) return { text: 'text-amber-400', fill: 'fill-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  if (rating === 4) return { text: 'text-lime-400', fill: 'fill-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/30' };
  if (rating === 5) return { text: 'text-emerald-400', fill: 'fill-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  return { text: 'text-slate-400', fill: 'fill-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' };
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMediaUrl(msg: any): string | null {
  if (!msg) return null;
  if (typeof msg.content === 'string' && msg.content.startsWith('http')) return msg.content;
  if (typeof msg.url === 'string') return msg.url;
  if (typeof msg.mediaUrl === 'string') return msg.mediaUrl;
  if (msg.content && typeof msg.content === 'object' && msg.content.url) return msg.content.url;
  
  try {
    const str = JSON.stringify(msg);
    const match = str.match(/(https:\/\/[^"]+\.amazonaws\.com[^"]+)/);
    if (match) return match[0];
  } catch {
    // Ignora erros de JSON
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMediaNode(msg: any) {
  const type = (msg?.type || msg?.messageType || msg?.fileType || '').toString().toLowerCase();
  const mediaUrl = extractMediaUrl(msg);
  const textContent = renderMessageContent(msg);

  if (type === 'image' || type === 'sticker' || (mediaUrl && textContent === '📷 Imagem')) {
    return (
      <div className="space-y-2">
        {mediaUrl ? (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
            <img 
              src={mediaUrl} 
              alt="Mídia do Chat" 
              className="max-w-xs max-h-64 rounded-xl border border-slate-700/50 object-cover cursor-pointer hover:opacity-80 transition-all shadow-sm" 
            />
          </a>
        ) : (
          <span className="flex items-center gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50 text-xs">
            <ImageIcon className="w-4 h-4 text-slate-400"/> Imagem indisponível
          </span>
        )}
        {textContent && textContent !== '📷 Imagem' && <p className="whitespace-pre-wrap">{textContent}</p>}
      </div>
    );
  }

  if (type === 'audio' || (mediaUrl && textContent === '🎤 Áudio')) {
    return (
      <div className="space-y-2 min-w-[250px] max-w-sm">
        {mediaUrl ? (
          <div className="flex flex-col gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-700/50 shadow-inner">
            <audio controls src={mediaUrl} className="w-full h-10 outline-none" />
            <a 
              href={mediaUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              download 
              className="text-[10px] text-slate-400 hover:text-blue-300 transition-colors underline text-center block" 
            >
              Baixar arquivo original
            </a>
          </div>
        ) : (
          <span className="flex items-center gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50 text-xs">
            🎤 Áudio indisponível
          </span>
        )}
      </div>
    );
  }

  return <div className="whitespace-pre-wrap leading-relaxed">{textContent}</div>;
}

export default function AuditDashboard() {
  const isAuthorized = useAuth();

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [displayedCount, setDisplayedCount] = useState(30); 
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [selectedAttendantId, setSelectedAttendantId] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [statusTab, setStatusTab] = useState('abertos');
  
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [chatFilters, setChatFilters] = useState<Array<number | 'pendente' | 'parcial'>>([]);
  
  // ESTADOS DO DASHBOARD DE BOAS VINDAS (NOVO)
  const [showWelcome, setShowWelcome] = useState(false);
  const { data: dashboardData } = useSWR(showWelcome ? `${API_URL}/dashboard` : null, fetcher);

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chatToHide, setChatToHide] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ESTADOS DA AVALIAÇÃO GERAL
  const [rating, setRating] = useState(0);
  const [generalTopicId, setGeneralTopicId] = useState(''); 
  const [generalSubtopicId, setGeneralSubtopicId] = useState(''); 
  const [generalFailReasons, setGeneralFailReasons] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'topics' | 'reasons'>('topics');
  
  const [newTopicName, setNewTopicName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState('');
  const [addingSubtopicTo, setAddingSubtopicTo] = useState<string | null>(null);
  const [newSubtopicName, setNewSubtopicName] = useState('');
  const [editingSubtopicId, setEditingSubtopicId] = useState<string | null>(null);
  const [editingSubtopicName, setEditingSubtopicName] = useState('');

  const [newReasonName, setNewReasonName] = useState('');
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [editingReasonName, setEditingReasonName] = useState('');

  const [messageAudits, setMessageAudits] = useState<Record<string, MessageAudit>>({});
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [rightPanelMode, setRightPanelMode] = useState<'none' | 'chat' | 'message'>('none');

  const [msgTopicId, setMsgTopicId] = useState('');
  const [msgSubtopicId, setMsgSubtopicId] = useState('');
  const [msgFailReasons, setMsgFailReasons] = useState<string[]>([]);
  const [msgFeedback, setMsgFeedback] = useState('');
  const [msgClientQuestion, setMsgClientQuestion] = useState('');
  const [msgTrainAi, setMsgTrainAi] = useState(false);
  const [msgTargetModule, setMsgTargetModule] = useState('');
  const [msgQaQuestion, setMsgQaQuestion] = useState('');
  const [msgQaAnswer, setMsgQaAnswer] = useState('');

  const { data: config } = useSWR(`${API_URL}/config`, fetcher);
  const agapeMemberId = config?.agapeMemberId || null;
  const attendants: Attendant[] = config?.attendants || [];

  const activeAttendantId = selectedAttendantId || agapeMemberId || '';

  const { data: topics = [], mutate: mutateTopics } = useSWR<Topic[]>(`${API_URL}/topics`, fetcher);
  const { data: availableModules = [] } = useSWR<string[]>(`${API_URL}/knowledge/modules`, fetcher);
  const { data: failReasons = [], mutate: mutateFailReasons } = useSWR<FailReason[]>(`${API_URL}/fail-reasons`, fetcher);

  // EFEITO DO DASHBOARD: Verifica se é o primeiro acesso do dia
  useEffect(() => {
    setTimeout(() => {
      const today = new Date().toLocaleDateString('pt-BR');
      const lastSeen = localStorage.getItem('agape_welcome_seen');
      if (lastSeen !== today) {
        setShowWelcome(true);
      }
    }, 10); // Atraso imperceptível de 10ms para evitar o render em cascata
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const activeChatMessagesUrl = selectedChat ? `${API_URL}/chats/${selectedChat.id}/messages` : null;
  useSWR(
    activeChatMessagesUrl,
    fetcher,
    { 
      refreshInterval: 10000,
      onSuccess: (data) => {
        let msgsToRender: Message[] = [];
        if (Array.isArray(data)) msgsToRender = data;
        else if (data?.items) msgsToRender = data.items;
        else if (data?.messages) msgsToRender = data.messages;
        else if (data?.data) msgsToRender = data.data;

        setMessages((prev) => {
          if (prev.length > 0 && prev.length === msgsToRender.length) {
            const prevLast = prev[prev.length - 1];
            const newLast = msgsToRender[msgsToRender.length - 1];
            if (prevLast?.id === newLast?.id) return prev;
          }
          return msgsToRender;
        });
      }
    }
  );

  const toggleFilter = (val: number | 'pendente' | 'parcial') => {
    setChatFilters(prev => 
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const toggleMsgFailReason = (id: string) => {
    setMsgFailReasons(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const toggleGeneralFailReason = (id: string) => {
    setGeneralFailReasons(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const rawChats: Chat[] = chatsData?.items || [];
  
  const filteredChats = rawChats.filter(chat => {
    if (chatFilters.length > 0) {
      const hasRating = chat.audit && chat.audit.rating && chat.audit.rating > 0;
      const isPartial = (chat.audit && !hasRating) || chat.hasMessageAudits;
      
      let cStatus: number | 'pendente' | 'parcial' = 'pendente';
      if (hasRating) cStatus = chat.audit!.rating as number;
      else if (isPartial) cStatus = 'parcial';

      if (!chatFilters.includes(cStatus)) {
        return false;
      }
    }
    return true;
  });

  const totalChats: number = filteredChats.length;
  const visibleChats = filteredChats.slice(0, displayedCount);

  useEffect(() => { document.title = 'Auditoria Ágape'; }, []);

  useEffect(() => {
    if (!selectedChat || loadingMessages || messages.length === 0) return;

    const timer = setTimeout(() => {
      const hasGeneralAudit = selectedChat.audit?.rating && selectedChat.audit.rating > 0;
      const hasMsgAudits = selectedChat.hasMessageAudits || Object.keys(messageAudits).length > 0;

      if (hasGeneralAudit || hasMsgAudits) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = 0;
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [messages, selectedChat, loadingMessages, messageAudits]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (displayedCount < filteredChats.length) {
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
      setRating(chat.audit.rating || 0);
      setGeneralTopicId(chat.audit.topicId || '');
      setGeneralSubtopicId(chat.audit.subtopicId || '');
      setGeneralFailReasons(chat.audit.failReasons || []);
      setFeedback(chat.audit.auditorFeedback || '');
    } else {
      setRating(0);
      setGeneralTopicId('');
      setGeneralSubtopicId('');
      setGeneralFailReasons([]);
      setFeedback('');
    }

    try {
      const auditsRes = await axios.get(`${API_URL}/chats/${chat.id}/message-audits`);
      setMessageAudits(auditsRes.data || {});
    } catch {
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

  const handleConfirmHide = async () => {
    if (!chatToHide) return;
    try {
      await axios.post(`${API_URL}/chats/${chatToHide.id}/hide`);
      toast.success('Chat ocultado! Movido para a aba Ocultos.');
      if (selectedChat?.id === chatToHide.id) setSelectedChat(null);
      setChatToHide(null);
      mutateChats();
    } catch {
      toast.error('Erro ao ocultar o chat.');
    }
  };

  const handleUnhideChat = async () => {
    if (!selectedChat) return;
    try {
      await axios.post(`${API_URL}/chats/${selectedChat.id}/unhide`);
      toast.success('Chat restaurado com sucesso!');
      setSelectedChat(null);
      mutateChats();
    } catch {
      toast.error('Erro ao restaurar o chat.');
    }
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat) return;

    const finalRating = rating > 0 ? rating : null;

    const promise = axios.post(`${API_URL}/audits`, {
      chatId: selectedChat.id,
      clientName: selectedChat.contactName,
      carteiraTag: selectedChat.carteiraTag,
      rating: finalRating,
      topicId: generalTopicId || null,
      subtopicId: generalSubtopicId || null,
      failReasons: generalFailReasons,
      auditorFeedback: feedback,
      auditorEmail: 'auditor@prover.com.br',
    });

    toast.promise(promise, {
      loading: 'Salvando auditoria...',
      success: () => {
        mutateChats(); 
        setSelectedChat(prev => prev ? {
          ...prev, 
          audit: { ...prev.audit, rating: finalRating, topicId: generalTopicId || undefined, subtopicId: generalSubtopicId || undefined, failReasons: generalFailReasons, auditorFeedback: feedback, violatedPromptRules: false, knowledgeBaseFail: false }
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
      setMsgFailReasons(existing.failReasons || []);
      setMsgFeedback(existing.auditorFeedback || '');
      setMsgClientQuestion(existing.clientQuestion || '');
      setMsgTargetModule(existing.targetModule || '');
    } else {
      setMsgTopicId('');
      setMsgSubtopicId('');
      setMsgFailReasons([]);
      setMsgFeedback('');
      setMsgClientQuestion(findPrecedingClientQuestion(index));
      setMsgTargetModule('');
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
      failReasons: msgFailReasons,
      auditorFeedback: msgFeedback,
      trainAi: msgTrainAi,
      targetModule: msgTargetModule || 'Módulo Geral',
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
        mutateChats(); 
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

  const handleAddReason = async () => {
    if (!newReasonName.trim()) return;
    await axios.post(`${API_URL}/fail-reasons`, { name: newReasonName.trim() });
    setNewReasonName('');
    mutateFailReasons();
  };
  const handleRenameReason = async (id: string) => {
    if (!editingReasonName.trim()) return;
    await axios.put(`${API_URL}/fail-reasons/${id}`, { name: editingReasonName.trim() });
    setEditingReasonId(null);
    mutateFailReasons();
  };
  const handleDeleteReason = async (id: string) => {
    if (!confirm('Excluir este motivo de erro permanentemente?')) return;
    await axios.delete(`${API_URL}/fail-reasons/${id}`);
    mutateFailReasons();
  };

  if (!isAuthorized) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center"></div>;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      <Toaster theme="dark" position="top-right" richColors />

      {/* --- DASHBOARD DE BOAS-VINDAS (NOVO) --- */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-4xl w-full shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-5 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-blue-400" />
            </div>
            
            <h2 className="text-2xl md:text-3xl font-black text-slate-100 mb-2">Resumo da Operação Diária</h2>
            <p className="text-slate-400 mb-8 text-center max-w-lg text-sm">
              Bom dia! Antes de iniciar as auditorias, confira como está a saúde do sistema e do Ágape hoje.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-8">
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center hover:border-slate-700 transition-colors">
                <Clock className="w-6 h-6 text-amber-400 mb-3" />
                <span className="text-3xl font-black text-slate-100">
                  {dashboardData ? dashboardData.pendingChats : <RefreshCw className="w-5 h-5 animate-spin text-slate-600 my-2" />}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Chats Pendentes</span>
              </div>
              
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center hover:border-slate-700 transition-colors">
                <Sparkles className="w-6 h-6 text-emerald-400 mb-3" />
                <span className="text-3xl font-black text-slate-100">
                  {dashboardData ? dashboardData.newStrapiRules : <RefreshCw className="w-5 h-5 animate-spin text-slate-600 my-2" />}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Novas Regras (24h)</span>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center hover:border-slate-700 transition-colors">
                <CheckSquare className="w-6 h-6 text-blue-400 mb-3" />
                <span className="text-3xl font-black text-slate-100">
                  {dashboardData ? dashboardData.auditsThisWeek : <RefreshCw className="w-5 h-5 animate-spin text-slate-600 my-2" />}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Auditorias (Semana)</span>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center hover:border-slate-700 transition-colors">
                <Star className="w-6 h-6 text-amber-400 mb-3" />
                <span className="text-3xl font-black text-slate-100">
                  {dashboardData ? dashboardData.weeklyAvgRating : <RefreshCw className="w-5 h-5 animate-spin text-slate-600 my-2" />}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Nota Média (Semana)</span>
              </div>
            </div>

            <button 
              onClick={() => {
                const today = new Date().toLocaleDateString('pt-BR');
                localStorage.setItem('agape_welcome_seen', today);
                setShowWelcome(false);
              }} 
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-10 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
            >
              <Activity className="w-4 h-4" /> Iniciar Auditorias
            </button>
          </div>
        </div>
      )}

      {chatToHide && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Ocultar Chat de Teste</h3>
                <p className="text-xs text-slate-400">Ele será movido para a aba Ocultos</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800 font-medium">
              Tem certeza que deseja ocultar a conversa com <strong className="text-white">&quot;{chatToHide.contactName}&quot;</strong>? Ela deixará de aparecer nos relatórios e nas listas principais.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setChatToHide(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmHide}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
              >
                Sim, Ocultar
              </button>
            </div>
          </div>
        </div>
      )}

      {showFiltersModal && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowFiltersModal(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-3xl p-7 max-w-sm w-full shadow-2xl space-y-6 animate-in fade-in zoom-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Filter className="w-5 h-5 text-blue-400" /> Filtros Avançados
              </h3>
              <button onClick={() => setShowFiltersModal(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Status do Atendimento</p>
                <label className="flex items-center gap-3 cursor-pointer group p-2.5 -mx-2.5 rounded-xl hover:bg-slate-800/50 transition-all">
                  <input type="checkbox" className="hidden" checked={chatFilters.includes('pendente')} onChange={() => toggleFilter('pendente')} />
                  <div className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${chatFilters.includes('pendente') ? 'bg-blue-600 border-blue-600' : 'bg-slate-950 border-slate-600 group-hover:border-slate-500'}`}>
                    {chatFilters.includes('pendente') && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors select-none">Pendente (Sem nota)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group p-2.5 -mx-2.5 rounded-xl hover:bg-slate-800/50 transition-all">
                  <input type="checkbox" className="hidden" checked={chatFilters.includes('parcial')} onChange={() => toggleFilter('parcial')} />
                  <div className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${chatFilters.includes('parcial') ? 'bg-blue-600 border-blue-600' : 'bg-slate-950 border-slate-600 group-hover:border-slate-500'}`}>
                    {chatFilters.includes('parcial') && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors select-none">Parcial (Apenas mensagens)</span>
                </label>
              </div>
              <div className="h-px w-full bg-slate-800/80"></div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nota Geral (Satisfação)</p>
                {[5, 4, 3, 2, 1].map((star) => {
                  const isChecked = chatFilters.includes(star);
                  const colorObj = getRatingColor(star);
                  return (
                    <label key={star} className="flex items-center gap-3 cursor-pointer group p-2.5 -mx-2.5 rounded-xl hover:bg-slate-800/50 transition-all">
                      <input type="checkbox" className="hidden" checked={isChecked} onChange={() => toggleFilter(star)} />
                      <div className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-slate-950 border-slate-600 group-hover:border-slate-500'}`}>
                        {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      <span className={`text-sm font-bold flex items-center gap-1.5 ${colorObj.text} transition-all select-none`}>
                        {star} <Star className={`w-3.5 h-3.5 ${colorObj.fill}`} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-800/80">
              <button
                onClick={() => setChatFilters([])}
                className="flex-1 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Limpar
              </button>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                Ver Resultados
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-[22rem] 2xl:w-96 border-r border-slate-800/80 flex flex-col bg-slate-950/60 backdrop-blur-md">
        
        <div className="p-5 border-b border-slate-800/80 space-y-4 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-blue-400 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500 fill-blue-500/20" />
              Auditoria Ágape
            </h1>
            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full font-mono font-medium">
              {visibleChats.length} de {totalChats} chats
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/relatorios"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-blue-300 hover:border-blue-500/40 transition-all shadow-sm"
            >
              <BarChart3 className="w-3.5 h-3.5" /> Relatórios
            </Link>
            <Link
              href="/base-conhecimento"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-blue-300 hover:border-blue-500/40 transition-all shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5" /> Base
            </Link>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-blue-300 hover:border-blue-500/40 transition-all cursor-pointer shadow-sm"
              title="Configurações (Temas e Motivos)"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div className="flex bg-slate-900/90 p-1.5 rounded-xl border border-slate-800/80 text-xs font-semibold justify-between">
            {[
              { id: 'abertos', label: 'Entrada' },
              { id: 'finalizados', label: 'Finalizados' },
              { id: 'ocultos', label: 'Ocultos' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id)}
                className={`flex-1 py-1.5 text-center rounded-lg transition-all cursor-pointer ${
                  statusTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            
            <div className="flex-1 relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-xl px-3 py-2.5 transition-all focus:outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Bot className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm font-semibold text-blue-300 truncate">
                    {activeAttendantId === 'TODOS' || activeAttendantId === ''
                      ? 'Todos os atendentes' 
                      : attendants.find(a => a.id === activeAttendantId)?.name || 'Todos os atendentes'}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-blue-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => { setSelectedAttendantId('TODOS'); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                      activeAttendantId === 'TODOS' || activeAttendantId === '' ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                    }`}
                  >
                    Todos os atendentes
                    {(activeAttendantId === 'TODOS' || activeAttendantId === '') && <Check className="w-4 h-4 text-blue-400" />}
                  </button>
                  
                  <div className="h-px bg-slate-800/80 my-1 mx-2"></div>
                  
                  {attendants.map((a: Attendant) => {
                    const isSelected = activeAttendantId === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedAttendantId(a.id); setIsDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                           {a.name.includes('Ágape') ? <Bot className="w-3.5 h-3.5 opacity-70 shrink-0" /> : <UserCheck className="w-3.5 h-3.5 opacity-70 shrink-0" />}
                           <span className="truncate">{a.name}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setShowFiltersModal(true)} 
              title="Filtros Avançados (Notas e Status)"
              className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer relative shrink-0 ${
                chatFilters.length > 0 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                  : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-blue-300 hover:border-blue-500/40'
              }`}
            >
              <Filter className="w-4 h-4" />
              {chatFilters.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-slate-950"></span>
              )}
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar assunto ou contato..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/60 transition-all"
            />
          </div>
        </div>

        <div 
          onScroll={handleScroll} 
          className="flex-1 overflow-y-auto divide-y divide-slate-800/40 custom-scrollbar relative"
        >
          {loadingChats && visibleChats.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3">
              <Clock className="w-6 h-6 animate-spin text-blue-500" /> 
              Sincronizando chats do Umbler...
            </div>
          ) : visibleChats.length === 0 ? (
            <div className="p-10 text-center text-slate-500 space-y-1">
              <p className="font-semibold text-base text-slate-400">Nenhum chat encontrado</p>
              <p className="text-xs opacity-70">Ajuste a busca ou filtros para ver mais.</p>
            </div>
          ) : (
            visibleChats.map((chat: Chat) => {
              const { dateStr, timeStr } = formatDateTime(chat.updatedAt);
              const relativeTime = formatRelativeTime(chat.updatedAt);
              const carteiraBadge = getTagBadge(chat.carteiraTag);

              const hasRating = chat.audit && chat.audit.rating && chat.audit.rating > 0;
              const isPartial = (chat.audit && !hasRating) || chat.hasMessageAudits;

              return (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`p-4 cursor-pointer hover:bg-slate-900/60 transition-all relative ${
                    selectedChat?.id === chat.id 
                      ? 'bg-slate-900/90 border-l-[5px] border-blue-500' 
                      : 'border-l-[5px] border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2 gap-3">
                    <span className="flex items-center gap-3 min-w-0">
                      {chat.contactPhoto ? (
                        <img src={chat.contactPhoto} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700" />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                          {chat.contactName?.charAt(0)?.toUpperCase() || 'C'}
                        </span>
                      )}
                      <span className="font-bold text-slate-200 text-sm truncate">
                        {chat.contactName}
                      </span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 uppercase shrink-0 shadow-sm ${carteiraBadge.style}`}>
                      {carteiraBadge.icon} {chat.carteiraTag}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 truncate mb-3 leading-relaxed font-medium">
                    {renderMessageContent(chat.lastMessage)}
                  </p>

                  <div className="flex justify-between items-center text-[10px] font-mono font-medium">
                    <span className="flex items-center gap-1.5 text-slate-500" title={`${dateStr} ${timeStr ? `às ${timeStr}` : ''}`}>
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {relativeTime}
                    </span>

                    {hasRating ? (
                      (() => {
                        const colors = getRatingColor(chat.audit!.rating);
                        return (
                          <span className={`flex items-center font-bold gap-1 px-2 py-0.5 rounded shadow-sm border ${colors.bg} ${colors.border} ${colors.text}`}>
                            <Star className={`w-3 h-3 ${colors.fill}`} /> {chat.audit!.rating}
                          </span>
                        );
                      })()
                    ) : isPartial ? (
                      <span className="flex items-center text-amber-400 font-bold gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded shadow-sm">
                        <Activity className="w-3 h-3" /> Parcial
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold px-2 py-0.5 border border-slate-700 rounded bg-slate-900/50">
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

      <div className="flex-1 flex flex-col bg-slate-900/40 relative">
        {selectedChat ? (
          <>
            <div className="p-5 border-b border-slate-800/80 bg-slate-950/90 flex justify-between items-center backdrop-blur-md z-10 shadow-sm">
              <div className="flex items-center gap-4">
                {selectedChat.contactPhoto ? (
                  <img src={selectedChat.contactPhoto} alt="" className="w-12 h-12 rounded-full object-cover border border-slate-700 shadow-inner" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xl shadow-inner">
                    {selectedChat.contactName?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                )}

                <div>
                  <h2 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                    {selectedChat.contactName}
                  </h2>
                  
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {(selectedChat.allTags || []).map((tag: string, index: number) => {
                      const badge = getTagBadge(tag);
                      return (
                        <span 
                          key={index}
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shadow-sm ${badge.style}`}
                        >
                          <span>{badge.icon}</span>
                          <span>{tag}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {statusTab === 'ocultos' ? (
                  <button
                    onClick={handleUnhideChat}
                    title="Restaurar este chat para a lista principal"
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-sm"
                  >
                    <Eye className="w-4 h-4" /> Desocultar
                  </button>
                ) : (
                  <button
                    onClick={() => setChatToHide(selectedChat)}
                    title="Ocultar chat de teste"
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-slate-800/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all cursor-pointer shadow-sm"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => { setSelectedMessage(null); setRightPanelMode('chat'); }}
                  title="Avaliar o atendimento como um todo (nota geral + observação)"
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer shrink-0 ${
                    selectedChat.audit
                      ? 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white shadow-sm'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                  }`}
                >
                  {selectedChat.audit?.rating && selectedChat.audit.rating > 0 ? (
                    <>
                      <Pencil className="w-3.5 h-3.5" />
                      Editar avaliação ({selectedChat.audit.rating})
                    </>
                  ) : selectedChat.audit ? (
                    <>
                      <Pencil className="w-3.5 h-3.5" />
                      Editar avaliação (Sem nota)
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4" />
                      Avaliar Atendimento
                    </>
                  )}
                </button>
              </div>
            </div>

            <div 
              ref={messagesContainerRef}
              className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-5 bg-slate-900/30 custom-scrollbar"
            >
              {loadingMessages ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-3">
                  <Clock className="w-8 h-8 animate-spin text-blue-500" />
                  Carregando mensagens da conversa...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <BrainCircuit className="w-12 h-12 text-slate-700 animate-pulse" />
                  <h3 className="text-slate-400 font-bold text-base">Nenhuma mensagem salva</h3>
                  <p className="text-slate-600 text-sm max-w-sm">
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
                    <img src="/agape.png" alt="Ágape" className="w-8 h-8 rounded-full object-cover border border-blue-300/50 shrink-0 shadow-sm" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0 shadow-sm">
                      <UserCheck className="w-4 h-4" />
                    </div>
                  );

                  return (
                    <div
                      key={i}
                      className={`flex items-end gap-3 ${isFromContact ? 'justify-start' : 'justify-end'}`}
                    >
                      {isFromContact && (
                        <div
                          className="max-w-[80%] rounded-[1.25rem] px-5 py-3 text-sm shadow-sm relative group bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/50"
                        >
                          {renderMediaNode(m)}
                          <span className="block text-right text-[10px] opacity-60 font-mono mt-2">
                            {dateStr} {timeStr && `às ${timeStr}`}
                          </span>
                        </div>
                      )}
                      {isAttendant && (
                        <>
                          <div
                            onClick={() => isFromAgape && handleSelectMessage(m, i)}
                            className={`max-w-[80%] rounded-[1.25rem] px-5 py-3 text-sm shadow-sm relative group bg-blue-600 text-white rounded-br-none shadow-blue-900/20 transition-all border border-blue-500 ${
                              isFromAgape ? 'cursor-pointer hover:brightness-110' : ''
                            } ${isSelected ? 'ring-4 ring-blue-300 scale-[1.01]' : ''}`}
                          >
                            <div className="flex justify-between items-center gap-5 mb-2 border-b border-white/20 pb-1.5">
                              <span className="text-xs font-bold flex items-center gap-1.5 text-blue-50 tracking-wide">
                                {label}
                              </span>

                              <span className="text-[10px] opacity-80 font-mono font-medium text-blue-100">
                                {dateStr} {timeStr && `às ${timeStr}`}
                              </span>
                            </div>

                            {renderMediaNode(m)}

                            {isFromAgape && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleSelectMessage(m, i); }}
                                className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                                  audited
                                    ? 'bg-emerald-500 text-white hover:bg-emerald-400 border border-emerald-400'
                                    : 'bg-white/15 text-white border border-white/30 hover:bg-white/25'
                                }`}
                              >
                                <ClipboardCheck className="w-4 h-4" />
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
              {/* Ref para o final da tela */}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-6">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-48 h-48 rounded-full border border-blue-500/20 animate-ping opacity-75"></div>
              <div className="absolute w-40 h-40 rounded-full border border-blue-400/30 animate-spin" style={{ animationDuration: '8s' }}></div>
              
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-tr from-blue-600/30 via-indigo-500/20 to-cyan-400/30 border border-blue-500/40 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
                <BrainCircuit className="w-14 h-14 text-blue-400 animate-pulse" />
              </div>

              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-900/80 border border-blue-500/40 text-blue-300 text-[10px] font-mono font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                <Activity className="w-3 h-3 text-blue-400 animate-bounce" /> Sistema Ativo
              </div>
            </div>

            <div className="space-y-2 max-w-sm">
              <h2 className="text-slate-50 font-bold text-xl flex items-center justify-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
                Central de Auditoria Inteligente
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Selecione uma conversa ao lado para analisar o desempenho do robô Ágape e treinar a base de conhecimento de forma interativa.
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedChat && rightPanelMode === 'message' && selectedMessage && (
        <div className="w-[22rem] 2xl:w-96 bg-slate-950 p-6 flex flex-col overflow-y-auto border-l border-slate-800/80 relative custom-scrollbar shadow-2xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
            <h3 className="text-base font-bold flex items-center gap-2 text-slate-100">
              <ClipboardCheck className="w-5 h-5 text-blue-400" /> Auditoria da Resposta
            </h3>
            <button
              onClick={() => { setSelectedMessage(null); setRightPanelMode('none'); }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveMessageAudit} className="space-y-5">
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 text-sm text-slate-300 leading-relaxed shadow-inner">
              <span className="font-bold text-slate-100 block mb-1.5">Resposta do Ágape:</span> 
              <span className="italic opacity-90">&quot;{renderMessageContent(selectedMessage).slice(0, 200)}...&quot;</span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Pergunta do cliente (Contexto)</label>
              <input
                type="text"
                value={msgClientQuestion}
                onChange={(e) => setMsgClientQuestion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Tópico</label>
                <select
                  value={msgTopicId}
                  onChange={(e) => { setMsgTopicId(e.target.value); setMsgSubtopicId(''); }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 outline-none focus:border-blue-500 cursor-pointer transition-all"
                >
                  <option value="">Selecione...</option>
                  {topics.map((t: Topic) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Subtópico</label>
                <select
                  value={msgSubtopicId}
                  onChange={(e) => setMsgSubtopicId(e.target.value)}
                  disabled={!msgTopicId}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-40 transition-all"
                >
                  <option value="">-</option>
                  {(topics.find((t: Topic) => t.id === msgTopicId)?.subtopics || []).map((s: Subtopic) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1 pt-4 border-t border-slate-800/80">
              <label className="block text-sm font-semibold text-slate-300 mb-2">Motivos de Falha / Observações</label>
              
              {failReasons.length === 0 && (
                <span className="text-xs text-slate-500 block mb-2">Nenhum motivo configurado. Use a engrenagem no topo esquerdo para criar.</span>
              )}
              
              {failReasons.map((reason) => {
                const isChecked = msgFailReasons.includes(reason.id);
                return (
                  <label key={reason.id} className="flex items-start gap-3 cursor-pointer group p-3 -mx-3 rounded-xl hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-700/50">
                    <input type="checkbox" className="hidden" checked={isChecked} onChange={() => toggleMsgFailReason(reason.id)} />
                    <div className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-slate-900 border-slate-600 group-hover:border-slate-500'}`}>
                      {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm leading-snug transition-colors select-none ${isChecked ? 'text-slate-100 font-medium' : 'text-slate-400 group-hover:text-slate-300'}`}>
                      {reason.name}
                    </span>
                  </label>
                );
              })}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Observações do Auditor (Opcional)</label>
              <textarea
                value={msgFeedback}
                onChange={(e) => setMsgFeedback(e.target.value)}
                rows={3}
                placeholder="Detalhe o que o Ágape fez de errado nesta resposta..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500 custom-scrollbar"
              />
            </div>

            <div className="pt-4 border-t border-slate-800/80">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors mb-3">
                <input
                  type="checkbox"
                  checked={msgTrainAi}
                  onChange={(e) => setMsgTrainAi(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-blue-600 cursor-pointer"
                />
                <RefreshCw className="w-4 h-4" /> Enviar Q&A para Treinar o Ágape
              </label>

              {msgTrainAi && (
                <div className="space-y-4 bg-slate-900/80 p-4 rounded-xl border border-slate-700/80 transition-all shadow-inner">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Módulo / TXT de Destino</label>
                    <select
                      value={msgTargetModule}
                      onChange={(e) => setMsgTargetModule(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">Selecione o arquivo .txt...</option>
                      {availableModules.map((mod, idx) => (
                        <option key={idx} value={mod}>{mod}</option>
                      ))}
                      {availableModules.length === 0 && (
                        <>
                          <option value="Módulo 1: Cadastros">Módulo 1: Cadastros</option>
                          <option value="Módulo 4: Financeiro">Módulo 4: Financeiro</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Pergunta de Treino</label>
                    <input
                      type="text"
                      value={msgQaQuestion}
                      onChange={(e) => setMsgQaQuestion(e.target.value)}
                      placeholder="Ex: Como faço para emitir carteirinha?"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Resposta Ideal Esperada</label>
                    <textarea
                      value={msgQaAnswer}
                      onChange={(e) => setMsgQaAnswer(e.target.value)}
                      rows={3}
                      placeholder="Ex: Acesse Cadastros > Carteirinhas e clique em Emitir..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 outline-none focus:border-blue-500 custom-scrollbar"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer mt-2"
            >
              <Send className="w-4 h-4" /> Salvar Auditoria da Resposta
            </button>
          </form>
        </div>
      )}

      {selectedChat && rightPanelMode === 'chat' && (
        <div className="w-[22rem] 2xl:w-96 bg-slate-950 p-6 flex flex-col overflow-y-auto border-l border-slate-800/80 relative custom-scrollbar shadow-2xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
            <h3 className="text-base font-bold flex items-center gap-2 text-slate-100">
              <BookOpen className="w-5 h-5 text-blue-400" /> Auditoria do Atendimento
            </h3>

            <button
              onClick={() => setRightPanelMode('none')}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-6 leading-relaxed bg-slate-900/50 p-3.5 rounded-xl border border-slate-800 font-medium">
            Nota geral do atendimento. Pra auditar respostas específicas do Ágape em detalhe (tópico, falha na base, treino), clique na bolha da resposta na conversa.
          </p>

          <form onSubmit={handleSaveAudit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-3 text-center">
                Classificação Geral do Atendimento
              </label>
              
              <div className="flex gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-700/80 justify-around shadow-inner">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = star <= rating;
                  const colors = getRatingColor(rating);
                  
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(rating === star ? 0 : star)}
                      className="p-1.5 focus:outline-none hover:scale-110 transition-all cursor-pointer"
                    >
                      <Star className={`w-8 h-8 ${isActive ? `${colors.fill} ${colors.text}` : 'text-slate-700 hover:text-slate-500'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1.5">Tópico</label>
                <select
                  value={generalTopicId}
                  onChange={(e) => { setGeneralTopicId(e.target.value); setGeneralSubtopicId(''); }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 outline-none focus:border-blue-500 cursor-pointer transition-all"
                >
                  <option value="">Selecione...</option>
                  {topics.map((t: Topic) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1.5">Subtópico</label>
                <select
                  value={generalSubtopicId}
                  onChange={(e) => setGeneralSubtopicId(e.target.value)}
                  disabled={!generalTopicId}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-40 transition-all"
                >
                  <option value="">-</option>
                  {(topics.find((t: Topic) => t.id === generalTopicId)?.subtopics || []).map((s: Subtopic) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1 pt-4 border-t border-slate-800/80">
              <label className="block text-sm font-bold text-slate-300 mb-2">Motivos de Falha na Conversa</label>
              
              {failReasons.length === 0 && (
                <span className="text-xs text-slate-500 block mb-2">Nenhum motivo configurado. Use a engrenagem no topo esquerdo para criar.</span>
              )}

              {failReasons.map((reason) => {
                const isChecked = generalFailReasons.includes(reason.id);
                return (
                  <label key={reason.id} className="flex items-start gap-3 cursor-pointer group p-3 -mx-3 rounded-xl hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-700/50">
                    <input type="checkbox" className="hidden" checked={isChecked} onChange={() => toggleGeneralFailReason(reason.id)} />
                    <div className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-slate-900 border-slate-600 group-hover:border-slate-500'}`}>
                      {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm leading-snug transition-colors select-none ${isChecked ? 'text-slate-100 font-medium' : 'text-slate-400 group-hover:text-slate-300'}`}>
                      {reason.name}
                    </span>
                  </label>
                );
              })}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Observações Gerais do Auditor
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                placeholder="Resumo do atendimento como um todo..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500 custom-scrollbar font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer mt-4"
            >
              <Send className="w-4 h-4" /> Salvar Auditoria Geral
            </button>
          </form>
        </div>
      )}

      {/* --- MODAL DE CONFIGURAÇÕES: TEMAS E MOTIVOS --- */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-950 border border-slate-700 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-base font-black flex items-center gap-2 text-slate-100">
                <Settings className="w-5 h-5 text-blue-400" /> Configurações Gerais
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex bg-slate-900 border-b border-slate-800 p-2">
              <button 
                onClick={() => setSettingsTab('topics')} 
                className={`flex-1 py-2 text-xs font-bold text-center rounded-xl transition-all cursor-pointer ${settingsTab === 'topics' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Tag className="w-4 h-4 inline-block mr-1.5" /> Temas e Subtópicos
              </button>
              <button 
                onClick={() => setSettingsTab('reasons')} 
                className={`flex-1 py-2 text-xs font-bold text-center rounded-xl transition-all cursor-pointer ${settingsTab === 'reasons' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <ListX className="w-4 h-4 inline-block mr-1.5" /> Motivos de Erro
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {settingsTab === 'topics' && (
                <>
                  {topics.map((t: Topic) => (
                    <div key={t.id} className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        {editingTopicId === t.id ? (
                          <input autoFocus value={editingTopicName} onChange={(e) => setEditingTopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameTopic(t.id)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-bold text-slate-100 outline-none focus:border-blue-500" />
                        ) : (
                          <span className="text-sm font-bold text-slate-200">{t.name}</span>
                        )}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => setAddingSubtopicTo(addingSubtopicTo === t.id ? null : t.id)} className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg cursor-pointer"><Plus className="w-4 h-4" /></button>
                          {editingTopicId === t.id ? (
                            <button onClick={() => handleRenameTopic(t.id)} className="p-1.5 text-emerald-400 hover:bg-slate-800 rounded-lg cursor-pointer"><CheckSquare className="w-4 h-4" /></button>
                          ) : (
                            <button onClick={() => { setEditingTopicId(t.id); setEditingTopicName(t.name); }} className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg cursor-pointer"><Pencil className="w-4 h-4" /></button>
                          )}
                          <button onClick={() => handleDeleteTopic(t.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>

                      {(t.subtopics || []).length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-slate-800 space-y-2">
                          {t.subtopics?.map((s: Subtopic) => (
                            <div key={s.id} className="flex items-center justify-between gap-3">
                              {editingSubtopicId === s.id ? (
                                <input autoFocus value={editingSubtopicName} onChange={(e) => setEditingSubtopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameSubtopic(s.id)} className="flex-1 bg-slate-950 border border-slate-700 rounded-md p-1.5 text-xs font-bold text-slate-200 outline-none focus:border-blue-500" />
                              ) : (
                                <span className="text-xs font-bold text-slate-400">{s.name}</span>
                              )}
                              <div className="flex items-center gap-1 shrink-0">
                                {editingSubtopicId === s.id ? (
                                  <button onClick={() => handleRenameSubtopic(s.id)} className="p-1 text-emerald-400 hover:bg-slate-800 rounded-md cursor-pointer"><CheckSquare className="w-3.5 h-3.5" /></button>
                                ) : (
                                  <button onClick={() => { setEditingSubtopicId(s.id); setEditingSubtopicName(s.name); }} className="p-1 text-slate-500 hover:text-blue-300 hover:bg-slate-800 rounded-md cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                                )}
                                <button onClick={() => handleDeleteSubtopic(s.id)} className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-md cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {addingSubtopicTo === t.id && (
                        <div className="mt-3 pl-4 flex items-center gap-2">
                          <input autoFocus value={newSubtopicName} onChange={(e) => setNewSubtopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSubtopic(t.id)} placeholder="Nome do subtópico" className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500" />
                          <button onClick={() => handleAddSubtopic(t.id)} className="p-1.5 text-blue-400 hover:bg-slate-800 rounded-lg cursor-pointer"><Plus className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {settingsTab === 'reasons' && (
                <>
                  <p className="text-xs text-slate-400 mb-2">Crie as opções de erro que os auditores poderão marcar durante a avaliação de uma resposta ou do chat inteiro.</p>
                  {failReasons.map((r: FailReason) => (
                    <div key={r.id} className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-3">
                      {editingReasonId === r.id ? (
                        <input autoFocus value={editingReasonName} onChange={(e) => setEditingReasonName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameReason(r.id)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-bold text-slate-100 outline-none focus:border-blue-500" />
                      ) : (
                        <span className="text-sm font-bold text-slate-200">{r.name}</span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        {editingReasonId === r.id ? (
                          <button onClick={() => handleRenameReason(r.id)} className="p-1.5 text-emerald-400 hover:bg-slate-800 rounded-lg cursor-pointer"><CheckSquare className="w-4 h-4" /></button>
                        ) : (
                          <button onClick={() => { setEditingReasonId(r.id); setEditingReasonName(r.name); }} className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg cursor-pointer"><Pencil className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => handleDeleteReason(r.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="p-5 border-t border-slate-800 flex items-center gap-3 bg-slate-900/50">
              {settingsTab === 'topics' ? (
                <>
                  <input value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()} placeholder="Adicionar novo tópico principal..." className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-200 outline-none focus:border-blue-500" />
                  <button onClick={handleAddTopic} className="p-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white cursor-pointer transition-all shadow-sm shadow-blue-600/20"><Plus className="w-5 h-5" /></button>
                </>
              ) : (
                <>
                  <input value={newReasonName} onChange={(e) => setNewReasonName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddReason()} placeholder="Novo motivo de erro..." className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-200 outline-none focus:border-blue-500" />
                  <button onClick={handleAddReason} className="p-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white cursor-pointer transition-all shadow-sm shadow-blue-600/20"><Plus className="w-5 h-5" /></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}