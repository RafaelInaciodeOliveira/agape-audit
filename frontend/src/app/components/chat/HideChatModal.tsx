import { AlertTriangle } from 'lucide-react';
import type { Chat } from '../../lib/types';

export function HideChatModal({ chat, onCancel, onConfirm }: { chat: Chat; onCancel: () => void; onConfirm: () => void }) {
  return (
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
          Tem certeza que deseja ocultar a conversa com <strong className="text-white">&quot;{chat.contactName}&quot;</strong>? Ela deixará de aparecer nos relatórios e nas listas principais.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-bold transition-all duration-200 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all duration-200 cursor-pointer"
          >
            Sim, Ocultar
          </button>
        </div>
      </div>
    </div>
  );
}
