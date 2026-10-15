import { AlertTriangle, ArrowLeftRight, Bot, CheckCircle2, Clock, Info, MessageSquarePlus, RotateCcw, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TimelineEvent } from '../../lib/types';
import { formatDateTime } from '../../lib/chatFormat';
import { describeTimelineEvent, type TimelineEventKind } from '../../lib/timelineEvents';

const ICONS: Record<TimelineEventKind, LucideIcon> = {
  transfer: ArrowLeftRight,
  closed: CheckCircle2,
  created: MessageSquarePlus,
  reopened: RotateCcw,
  bot: Bot,
  botError: AlertTriangle,
  tags: Tag,
  schedule: Clock,
  info: Info,
};

// Evento de sistema da Umbler no meio da conversa: bloco centralizado e discreto, não um balão.
export function TimelineEventRow({ event }: { event: TimelineEvent }) {
  const { kind, text, detail } = describeTimelineEvent(event);
  const Icon = ICONS[kind];
  const { dateStr, timeStr } = formatDateTime(event.eventAtUTC || event.createdAtUTC);
  const isError = kind === 'botError';

  return (
    <div className="flex justify-center">
      <div
        className={`max-w-[85%] flex items-start gap-2 px-3.5 py-1.5 rounded-xl border text-[11px] leading-snug ${
          isError ? 'bg-amber-500/5 border-amber-500/20 text-amber-300/80' : 'bg-slate-800/30 border-slate-700/40 text-slate-400'
        }`}
      >
        <Icon className={`w-3.5 h-3.5 shrink-0 mt-px ${isError ? 'text-amber-400/80' : 'text-slate-500'}`} />
        <div className="text-center">
          <span>{text}</span>
          <span className="ml-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
            {dateStr} {timeStr && `às ${timeStr}`}
          </span>
          {detail && <span className="block text-slate-500 italic">{detail}</span>}
        </div>
      </div>
    </div>
  );
}
