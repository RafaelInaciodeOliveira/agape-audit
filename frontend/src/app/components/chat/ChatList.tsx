/* eslint-disable @next/next/no-img-element */
import { BookOpen, Search, BarChart3, Coins, Settings, LogOut, Filter } from 'lucide-react';
import Link from 'next/link';
import type { Attendant, Chat } from '../../lib/types';
import { apiErrorMessage } from '../../lib/api';
import { logout } from '../../lib/auth';
import { AttendantDropdown } from './AttendantDropdown';
import { ChatListError } from './ChatListError';
import { ChatListItem } from './ChatListItem';

interface Props {
  visibleChats: Chat[];
  totalChats: number;
  selectedChatId?: string;
  onSelectChat: (chat: Chat) => void;
  statusTab: string;
  onStatusTabChange: (tab: string) => void;
  attendants: Attendant[];
  activeAttendantId: string;
  onSelectAttendant: (attendantId: string) => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
  onOpenSettings: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  loadingChats: boolean;
  chatsError: unknown;
  hasData: boolean;
  validatingChats: boolean;
  onRetry: () => void;
}

// Coluna da esquerda: navegação, abas, filtros, busca e a lista de chats.
export function ChatList({
  visibleChats, totalChats, selectedChatId, onSelectChat, statusTab, onStatusTabChange, attendants, activeAttendantId,
  onSelectAttendant, activeFilterCount, onOpenFilters, onOpenSettings, searchTerm, onSearchChange, onScroll, loadingChats,
  chatsError, hasData, validatingChats, onRetry,
}: Props) {
  return (
    <div className="w-[22rem] 2xl:w-96 border-r border-slate-800/80 flex flex-col bg-slate-950/60 backdrop-blur-md">

      <div className="p-5 border-b border-slate-800/80 space-y-4 bg-slate-900/40">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-400 flex items-center gap-2">
            <img src="/favicon.ico" alt="Zhavia" className="w-5 h-5 object-contain" />
            Auditoria Ágape
          </h1>
          <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full font-mono font-medium">
            {visibleChats.length} de {totalChats} chats
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/relatorios"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-blue-300 hover:border-blue-500/40 active:scale-95 transition-all duration-200 shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Relatórios
          </Link>
          <Link
            href="/base-conhecimento"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-blue-300 hover:border-blue-500/40 active:scale-95 transition-all duration-200 shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5" /> Base
          </Link>
          <Link
            href="/custos-ia"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-blue-300 hover:border-blue-500/40 active:scale-95 transition-all duration-200 shadow-sm"
          >
            <Coins className="w-3.5 h-3.5" /> Custos
          </Link>
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-blue-300 hover:border-blue-500/40 active:scale-90 transition-all duration-200 cursor-pointer shadow-sm"
            title="Configurações (Temas e Motivos)"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => logout()}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-red-300 hover:border-red-500/40 active:scale-90 transition-all duration-200 cursor-pointer shadow-sm"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="w-4 h-4" />
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
              onClick={() => onStatusTabChange(tab.id)}
              className={`flex-1 py-1.5 text-center rounded-lg active:scale-95 transition-all duration-200 cursor-pointer ${
                statusTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">

          <AttendantDropdown attendants={attendants} activeAttendantId={activeAttendantId} onSelect={onSelectAttendant} />

          <button 
            onClick={onOpenFilters} 
            title="Filtros Avançados (Notas e Status)"
            className={`p-2.5 rounded-xl border flex items-center justify-center active:scale-90 transition-all duration-200 cursor-pointer relative shrink-0 ${
              activeFilterCount > 0 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-blue-300 hover:border-blue-500/40'
            }`}
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-slate-950"></span>
            )}
          </button>
        </div>

        <div className="relative group">
          <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar assunto ou contato..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/60 transition-all"
          />
        </div>
      </div>

      <div 
        onScroll={onScroll} 
        className="flex-1 overflow-y-auto divide-y divide-slate-800/40 custom-scrollbar relative p-2"
      >
        {!!chatsError && (
          <ChatListError
            message={apiErrorMessage(chatsError, 'Não foi possível carregar os chats.')}
            stale={hasData}
            retrying={validatingChats}
            onRetry={onRetry}
          />
        )}
        {chatsError && !hasData ? null : loadingChats && visibleChats.length === 0 ? (
          <div className="p-4 space-y-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex gap-4 items-center p-2">
                <div className="w-10 h-10 rounded-full bg-slate-800/60 animate-pulse shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-3 bg-slate-800/60 rounded w-2/3 animate-pulse" />
                  <div className="h-2 bg-slate-800/60 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleChats.length === 0 ? (
          <div className="p-10 text-center text-slate-500 space-y-1">
            <p className="font-semibold text-base text-slate-400">Nenhum chat encontrado</p>
            <p className="text-xs opacity-70">Ajuste a busca ou filtros para ver mais.</p>
          </div>
        ) : (
          visibleChats.map((chat: Chat) => (
            <ChatListItem key={chat.id} chat={chat} selected={selectedChatId === chat.id} onSelect={onSelectChat} />
          ))
        )}
      </div>
    </div>
  );
}
