/* eslint-disable @next/next/no-img-element */
import { Star, Clock, Activity } from 'lucide-react';
import type { Chat } from '../../lib/types';
import { formatDateTime, formatRelativeTime, getRatingColor, getTagBadge, renderMessageContent } from '../../lib/chatFormat';

export function ChatListItem({ chat, selected, onSelect }: { chat: Chat; selected: boolean; onSelect: (chat: Chat) => void }) {
  const { dateStr, timeStr } = formatDateTime(chat.updatedAt);
  const relativeTime = formatRelativeTime(chat.updatedAt);
  const carteiraBadge = getTagBadge(chat.carteiraTag);

  const hasRating = chat.audit && chat.audit.rating && chat.audit.rating > 0;
  const isPartial = (chat.audit && !hasRating) || chat.hasMessageAudits;

  return (
    <div
      onClick={() => onSelect(chat)}
      className={`group p-4 mb-1 rounded-xl cursor-pointer hover:bg-slate-900/80 hover:shadow-lg hover:shadow-black/20 hover:scale-[1.015] active:scale-[0.99] transition-all duration-300 ease-out relative overflow-hidden ${
        selected 
          ? 'bg-slate-900/90 border border-blue-500/50 shadow-md ring-1 ring-blue-500/20' 
          : 'border border-transparent'
      }`}
    >
      {/* Brilho invisível que aparece no hover (Toque Apple) */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="flex justify-between items-center mb-2 gap-3 relative z-10">
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

      <p className="text-xs text-slate-400 truncate mb-3 leading-relaxed font-medium relative z-10">
        {renderMessageContent(chat.lastMessage)}
      </p>

      <div className="flex justify-between items-center text-[10px] font-mono font-medium relative z-10">
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
}
