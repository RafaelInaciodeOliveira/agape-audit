import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  count: number;
  hiding: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirmação para ocultar várias conversas de uma vez (mesmo padrão do HideChatModal).
export function BulkHideChatsModal({ count, hiding, onCancel, onConfirm }: Props) {
  const label = count === 1 ? '1 conversa' : `${count} conversas`;
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center gap-3 text-amber-400">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-100">Ocultar Conversas</h3>
            <p className="text-xs text-slate-400">Elas serão movidas para a aba Ocultos</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800 font-medium">
          Tem certeza que deseja ocultar <strong className="text-white">{label}</strong>? Elas deixarão de aparecer nos relatórios e nas listas principais.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={hiding}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-bold transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={hiding}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all duration-200 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {hiding ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Ocultando...</> : `Sim, Ocultar ${label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
