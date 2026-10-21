import { Bell, BellOff, BellRing } from 'lucide-react';
import type { NotificationState } from '../../hooks/useChatNotifications';

interface Props {
  state: NotificationState;
  onToggle: () => void;
}

const TITLES: Record<Exclude<NotificationState, 'unsupported'>, string> = {
  on: 'Notificações de novos chats ativadas (clique para desativar)',
  off: 'Ativar notificações de novos chats',
  blocked: 'Notificações bloqueadas no navegador',
};

// Sininho que liga/desliga as notificações do navegador para chats novos na Entrada.
export function NotificationBell({ state, onToggle }: Props) {
  if (state === 'unsupported') return null;

  const Icon = state === 'on' ? BellRing : state === 'blocked' ? BellOff : Bell;
  const tone =
    state === 'on'
      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
      : state === 'blocked'
        ? 'bg-slate-900/90 border-red-500/30 text-red-400/80 hover:border-red-500/50'
        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-blue-300 hover:border-blue-500/40';

  return (
    <button
      onClick={onToggle}
      title={TITLES[state]}
      aria-label={TITLES[state]}
      aria-pressed={state === 'on'}
      className={`p-2.5 rounded-xl border flex items-center justify-center active:scale-90 transition-all duration-200 cursor-pointer shrink-0 ${tone}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
