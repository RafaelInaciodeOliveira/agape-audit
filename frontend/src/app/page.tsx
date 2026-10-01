'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import useSWR from 'swr';
import { Toaster, toast } from 'sonner';
import { useAuth } from './hooks/useAuth';
import { API_URL, apiErrorMessage, fetcher } from './lib/api';
import { getCurrentUser } from './lib/auth';
import type { Attendant, Chat, ChatFilter, FailReason, Message, MessageAudit, Topic } from './lib/types';
import { normalizeMessages, renderMessageContent } from './lib/chatFormat';
import { WelcomeModal } from './components/dashboard/WelcomeModal';
import { HideChatModal } from './components/chat/HideChatModal';
import { BulkHideChatsModal } from './components/chat/BulkHideChatsModal';
import { ChatFiltersModal } from './components/chat/ChatFiltersModal';
import { ChatList } from './components/chat/ChatList';
import { ChatView } from './components/chat/ChatView';
import { MessageAuditPanel } from './components/audit/MessageAuditPanel';
import { ChatAuditPanel } from './components/audit/ChatAuditPanel';
import { SettingsModal } from './components/settings/SettingsModal';

// Máximo de conversas por requisição de ocultar em lote (mesmo limite do backend).
const BULK_HIDE_LIMIT = 500;

// Polling do SWR só com a aba visível e online; ao voltar para a aba, revalida na hora.
const BACKGROUND_SAFE_POLLING = { refreshWhenHidden: false, refreshWhenOffline: false, revalidateOnFocus: true } as const;

export default function AuditDashboard() {
  const isAuthorized = useAuth();

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [displayedCount, setDisplayedCount] = useState(30); 
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [selectedAttendantId, setSelectedAttendantId] = useState('');
  const [statusTab, setStatusTab] = useState('abertos');
  
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [chatFilters, setChatFilters] = useState<ChatFilter[]>([]);
  
  const [showWelcome, setShowWelcome] = useState(false);

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chatToHide, setChatToHide] = useState<Chat | null>(null);

  // Seleção múltipla para ocultar várias conversas de uma vez
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [showBulkHideConfirm, setShowBulkHideConfirm] = useState(false);
  const [bulkHiding, setBulkHiding] = useState(false);

  const [rating, setRating] = useState(0);
  const [generalTopicId, setGeneralTopicId] = useState(''); 
  const [generalSubtopicId, setGeneralSubtopicId] = useState(''); 
  const [generalFailReasons, setGeneralFailReasons] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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

  useEffect(() => {
    setTimeout(() => {
      const today = new Date().toLocaleDateString('pt-BR');
      const lastSeen = localStorage.getItem('agape_welcome_seen');
      if (lastSeen !== today) {
        setShowWelcome(true);
      }
    }, 10);
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
    
  const { data: chatsData, error: chatsError, isLoading: loadingChats, isValidating: validatingChats, mutate: mutateChats } = useSWR(
    chatQueryUrl,
    fetcher,
    { refreshInterval: 15000, ...BACKGROUND_SAFE_POLLING }
  );

  const activeChatMessagesUrl = selectedChat ? `${API_URL}/chats/${selectedChat.id}/messages` : null;
  const { data: messagesData, isLoading: loadingMessages } = useSWR(
    activeChatMessagesUrl,
    fetcher,
    {
      refreshInterval: 10000,
      ...BACKGROUND_SAFE_POLLING,
      onError: () => toast.error('Erro ao carregar mensagens do chat.', { id: 'chat-messages-error' }),
    }
  );
  // O SWR mantém a mesma referência de `data` quando nada mudou, então o efeito de
  // auto-scroll não dispara a cada polling sem mensagens novas.
  const messages = useMemo(() => normalizeMessages(messagesData), [messagesData]);

  const toggleFilter = (val: ChatFilter) => {
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
      
      let cStatus: ChatFilter = 'pendente';
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

  const exitMultiSelect = () => {
    setIsMultiSelectMode(false);
    setSelectedChatIds([]);
    setShowBulkHideConfirm(false);
  };

  const toggleMultiSelect = () => {
    if (isMultiSelectMode) exitMultiSelect();
    else setIsMultiSelectMode(true);
  };

  const toggleChatSelection = (chat: Chat) => {
    setSelectedChatIds(prev => (prev.includes(chat.id) ? prev.filter(id => id !== chat.id) : [...prev, chat.id]));
  };

  // Marca todas as conversas exibidas; se todas já estão marcadas, limpa a seleção.
  const toggleSelectAllVisible = () => {
    const visibleIds = visibleChats.map(c => c.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedChatIds.includes(id));
    setSelectedChatIds(allSelected ? [] : Array.from(new Set([...selectedChatIds, ...visibleIds])));
  };

  const requestBulkHide = () => {
    if (selectedChatIds.length === 0) return;
    if (selectedChatIds.length > BULK_HIDE_LIMIT) {
      toast.error(`Selecione no máximo ${BULK_HIDE_LIMIT} conversas por vez.`);
      return;
    }
    setShowBulkHideConfirm(true);
  };

  const handleConfirmBulkHide = async () => {
    const ids = selectedChatIds;
    setBulkHiding(true);
    try {
      await axios.post(`${API_URL}/chats/bulk-hide`, { chatIds: ids });
      toast.success(ids.length === 1 ? '1 conversa ocultada! Movida para a aba Ocultos.' : `${ids.length} conversas ocultadas! Movidas para a aba Ocultos.`);
      if (selectedChat && ids.includes(selectedChat.id)) setSelectedChat(null);
      exitMultiSelect();
      mutateChats();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Erro ao ocultar as conversas.'));
    } finally {
      setBulkHiding(false);
    }
  };

  // Trocar de aba encerra a seleção (a lista exibida passa a ser outra).
  const handleStatusTabChange = (tab: string) => {
    if (tab !== statusTab) exitMultiSelect();
    setStatusTab(tab);
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
      auditorEmail: getCurrentUser(),
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
      auditorEmail: getCurrentUser(),
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

  if (!isAuthorized) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center"></div>;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      <Toaster theme="dark" position="top-right" richColors />

      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {chatToHide && <HideChatModal chat={chatToHide} onCancel={() => setChatToHide(null)} onConfirm={handleConfirmHide} />}

      {showBulkHideConfirm && (
        <BulkHideChatsModal
          count={selectedChatIds.length}
          hiding={bulkHiding}
          onCancel={() => setShowBulkHideConfirm(false)}
          onConfirm={handleConfirmBulkHide}
        />
      )}

      {showFiltersModal && (
        <ChatFiltersModal
          chatFilters={chatFilters}
          onToggle={toggleFilter}
          onClear={() => setChatFilters([])}
          onClose={() => setShowFiltersModal(false)}
        />
      )}

      <ChatList
        visibleChats={visibleChats}
        totalChats={totalChats}
        selectedChatId={selectedChat?.id}
        onSelectChat={handleSelectChat}
        statusTab={statusTab}
        onStatusTabChange={handleStatusTabChange}
        attendants={attendants}
        activeAttendantId={activeAttendantId}
        onSelectAttendant={setSelectedAttendantId}
        activeFilterCount={chatFilters.length}
        onOpenFilters={() => setShowFiltersModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onScroll={handleScroll}
        loadingChats={loadingChats}
        chatsError={chatsError}
        hasData={!!chatsData}
        validatingChats={validatingChats}
        onRetry={() => mutateChats()}
        isMultiSelectMode={isMultiSelectMode}
        onToggleMultiSelect={toggleMultiSelect}
        selectedChatIds={selectedChatIds}
        onToggleChatSelection={toggleChatSelection}
        onToggleSelectAllVisible={toggleSelectAllVisible}
        onRequestBulkHide={requestBulkHide}
      />

      <ChatView
        selectedChat={selectedChat}
        statusTab={statusTab}
        onUnhide={handleUnhideChat}
        onRequestHide={() => setChatToHide(selectedChat)}
        onOpenChatAudit={() => { setSelectedMessage(null); setRightPanelMode('chat'); }}
        messagesContainerRef={messagesContainerRef}
        messagesEndRef={messagesEndRef}
        loadingMessages={loadingMessages}
        messages={messages}
        agapeMemberId={agapeMemberId}
        messageAudits={messageAudits}
        selectedMessageId={selectedMessage?.id}
        onSelectMessage={handleSelectMessage}
      />

      {selectedChat && rightPanelMode === 'message' && selectedMessage && (
        <MessageAuditPanel
          key={`msg-${selectedMessage.id}`}
          selectedMessage={selectedMessage}
          topics={topics}
          failReasons={failReasons}
          availableModules={availableModules}
          onClose={() => { setSelectedMessage(null); setRightPanelMode('none'); }}
          onSubmit={handleSaveMessageAudit}
          msgClientQuestion={msgClientQuestion} setMsgClientQuestion={setMsgClientQuestion}
          msgTopicId={msgTopicId} setMsgTopicId={setMsgTopicId}
          msgSubtopicId={msgSubtopicId} setMsgSubtopicId={setMsgSubtopicId}
          msgFailReasons={msgFailReasons} toggleMsgFailReason={toggleMsgFailReason}
          msgFeedback={msgFeedback} setMsgFeedback={setMsgFeedback}
          msgTrainAi={msgTrainAi} setMsgTrainAi={setMsgTrainAi}
          msgTargetModule={msgTargetModule} setMsgTargetModule={setMsgTargetModule}
          msgQaQuestion={msgQaQuestion} setMsgQaQuestion={setMsgQaQuestion}
          msgQaAnswer={msgQaAnswer} setMsgQaAnswer={setMsgQaAnswer}
        />
      )}

      {selectedChat && rightPanelMode === 'chat' && (
        <ChatAuditPanel
          key={`chat-${selectedChat.id}`}
          topics={topics}
          failReasons={failReasons}
          onClose={() => setRightPanelMode('none')}
          onSubmit={handleSaveAudit}
          rating={rating} setRating={setRating}
          generalTopicId={generalTopicId} setGeneralTopicId={setGeneralTopicId}
          generalSubtopicId={generalSubtopicId} setGeneralSubtopicId={setGeneralSubtopicId}
          generalFailReasons={generalFailReasons} toggleGeneralFailReason={toggleGeneralFailReason}
          feedback={feedback} setFeedback={setFeedback}
        />
      )}

      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        topics={topics}
        failReasons={failReasons}
        mutateTopics={mutateTopics}
        mutateFailReasons={mutateFailReasons}
      />
    </div>
  );
}
