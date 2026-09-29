import { RefreshCw, AlertTriangle } from 'lucide-react';

export function ChatListError({ message, stale, retrying, onRetry }: { message: string; stale: boolean; retrying: boolean; onRetry: () => void }) {
  const retryButton = (
    <button
      onClick={onRetry}
      disabled={retrying}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold cursor-pointer disabled:opacity-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} /> {retrying ? 'Tentando...' : 'Tentar novamente'}
    </button>
  );
  // Com dados antigos na tela: aviso compacto no topo, sem esconder a lista.
  if (stale) {
    return (
      <div role="alert" className="m-2 flex items-center justify-between gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-[11px]">
        <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Falha ao atualizar. Exibindo a última lista carregada.</span>
        {retryButton}
      </div>
    );
  }
  return (
    <div role="alert" className="p-10 text-center space-y-3">
      <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
      <p className="font-semibold text-base text-slate-300">Não foi possível carregar os chats</p>
      <p className="text-xs text-slate-500 max-w-xs mx-auto">{message}</p>
      {retryButton}
    </div>
  );
}
