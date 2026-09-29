/* eslint-disable @next/next/no-img-element */
import { UserCheck, ClipboardCheck } from 'lucide-react';
import type { Message, MessageAudit } from '../../lib/types';
import { formatDateTime } from '../../lib/chatFormat';
import { renderMediaNode } from './renderMediaNode';

interface Props {
  m: Message;
  i: number;
  agapeMemberId: string | null;
  auditedMessage?: MessageAudit;
  selected: boolean;
  onSelect: (message: Message, index: number) => void;
}

// Uma mensagem da conversa. Respostas do Ágape são clicáveis para auditoria.
export function MessageBubble({ m, i, agapeMemberId, auditedMessage, selected, onSelect }: Props) {
  const isFromContact = m.source === 'Contact';
  const isFromAgape = Boolean(agapeMemberId) && m.sentByOrganizationMember?.id === agapeMemberId;
  const isFromBotFlow = m.source === 'Bot' && !isFromAgape;
  const isAttendant = !isFromContact;
  const rawTime = m.createdAtUTC || m.createdAt || m.dateUTC || m.date || m.eventAtUTC;
  const { dateStr, timeStr } = formatDateTime(rawTime);
  const audited = auditedMessage;
  const isSelected = selected;

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
            onClick={() => isFromAgape && onSelect(m, i)}
            className={`max-w-[80%] rounded-[1.25rem] px-5 py-3 text-sm shadow-sm relative group bg-blue-600 text-white rounded-br-none shadow-blue-900/20 transition-all duration-300 border border-blue-500 ${
              isFromAgape ? 'cursor-pointer hover:brightness-110 hover:shadow-md' : ''
            } ${isSelected ? 'ring-4 ring-blue-300 scale-[1.02]' : ''}`}
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
                onClick={(e) => { e.stopPropagation(); onSelect(m, i); }}
                className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all duration-200 cursor-pointer shadow-sm ${
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
}
