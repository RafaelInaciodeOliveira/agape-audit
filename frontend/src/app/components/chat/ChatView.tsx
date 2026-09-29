/* eslint-disable @next/next/no-img-element */
import { Star, ShieldCheck, Activity, Pencil, EyeOff, Eye } from 'lucide-react';
import type { RefObject } from 'react';
import type { Chat, Message, MessageAudit } from '../../lib/types';
import { getTagBadge } from '../../lib/chatFormat';
import { MessageBubble } from './MessageBubble';

interface Props {
  selectedChat: Chat | null;
  statusTab: string;
  onUnhide: () => void;
  onRequestHide: () => void;
  onOpenChatAudit: () => void;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  loadingMessages: boolean;
  messages: Message[];
  agapeMemberId: string | null;
  messageAudits: Record<string, MessageAudit>;
  selectedMessageId?: string;
  onSelectMessage: (message: Message, index: number) => void;
}

// Coluna central: cabeçalho do chat selecionado e a conversa (ou a tela inicial vazia).
export function ChatView({
  selectedChat, statusTab, onUnhide, onRequestHide, onOpenChatAudit, messagesContainerRef, messagesEndRef,
  loadingMessages, messages, agapeMemberId, messageAudits, selectedMessageId, onSelectMessage,
}: Props) {
  return (
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
                  onClick={onUnhide}
                  title="Restaurar este chat para a lista principal"
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 text-emerald-400 border border-emerald-500/30 transition-all duration-200 cursor-pointer shadow-sm"
                >
                  <Eye className="w-4 h-4" /> Desocultar
                </button>
              ) : (
                <button
                  onClick={onRequestHide}
                  title="Ocultar chat de teste"
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-slate-800/50 hover:bg-red-500/10 active:scale-90 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all duration-200 cursor-pointer shadow-sm"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onOpenChatAudit}
                title="Avaliar o atendimento como um todo (nota geral + observação)"
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all duration-200 cursor-pointer shrink-0 ${
                  selectedChat.audit
                    ? 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white shadow-sm'
                    : 'bg-blue-600 hover:bg-blue-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-600/30 text-white'
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
              <div className="h-full flex flex-col p-2 space-y-8 overflow-hidden">
                <div className="flex justify-start">
                  <div className="w-2/3 h-16 rounded-[1.25rem] rounded-bl-none bg-slate-800/40 animate-pulse" />
                </div>
                <div className="flex justify-end gap-3">
                  <div className="w-1/2 h-20 rounded-[1.25rem] rounded-br-none bg-blue-900/10 border border-blue-500/10 animate-pulse" />
                  <div className="w-8 h-8 rounded-full bg-slate-800/50 animate-pulse shrink-0" />
                </div>
                <div className="flex justify-start">
                  <div className="w-1/2 h-12 rounded-[1.25rem] rounded-bl-none bg-slate-800/40 animate-pulse" />
                </div>
                <div className="flex justify-end gap-3">
                  <div className="w-2/5 h-16 rounded-[1.25rem] rounded-br-none bg-blue-900/10 border border-blue-500/10 animate-pulse" />
                  <div className="w-8 h-8 rounded-full bg-slate-800/50 animate-pulse shrink-0" />
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <img src="/favicon.ico" alt="Zhavia" className="w-12 h-12 object-contain opacity-50 animate-pulse" />
                <h3 className="text-slate-400 font-bold text-base">Nenhuma mensagem salva</h3>
                <p className="text-slate-600 text-sm max-w-sm">
                  Inicie ou atualize a conversa no Umbler para sincronizar.
                </p>
              </div>
            ) : (
              messages.map((m: Message, i: number) => (
                <MessageBubble key={i} m={m} i={i} agapeMemberId={agapeMemberId} auditedMessage={messageAudits[m.id]} selected={selectedMessageId === m.id} onSelect={onSelectMessage} />
              ))
            )}
            {/* Ref para o final da tela */}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-6">
          <div className="relative flex items-center justify-center">
            <div className="relative w-32 h-32 rounded-3xl bg-gradient-to-tr from-blue-600/30 via-indigo-500/20 to-cyan-400/30 border border-blue-500/40 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-blue-500/20 p-6">
              <img src="/favicon.ico" alt="Zhavia" className="w-16 h-16 object-contain animate-pulse drop-shadow-[0_0_15px_rgba(96,165,250,0.8)]" />

              <div className="absolute -top-5.5 left-1/2 -translate-x-1/2 bg-blue-900/80 border border-blue-500/40 text-blue-300 text-[10px] font-mono font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                <Activity className="w-3 h-3 text-blue-400 animate-bounce" /> Sistema Ativo
              </div>
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
  );
}
