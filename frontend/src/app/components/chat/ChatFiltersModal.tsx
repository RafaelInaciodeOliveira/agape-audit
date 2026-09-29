import { Star, X, Filter, Check } from 'lucide-react';
import type { ChatFilter } from '../../lib/types';
import { getRatingColor } from '../../lib/chatFormat';

interface Props {
  chatFilters: ChatFilter[];
  onToggle: (value: ChatFilter) => void;
  onClear: () => void;
  onClose: () => void;
}

export function ChatFiltersModal({ chatFilters, onToggle, onClear, onClose }: Props) {
  return (
    <div 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl p-7 max-w-sm w-full shadow-2xl space-y-6 animate-in fade-in zoom-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-400" /> Filtros Avançados
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-90 transition-all duration-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Status do Atendimento</p>
            <label className="flex items-center gap-3 cursor-pointer group p-2.5 -mx-2.5 rounded-xl hover:bg-slate-800/50 transition-all">
              <input type="checkbox" className="hidden" checked={chatFilters.includes('pendente')} onChange={() => onToggle('pendente')} />
              <div className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${chatFilters.includes('pendente') ? 'bg-blue-600 border-blue-600' : 'bg-slate-950 border-slate-600 group-hover:border-slate-500'}`}>
                {chatFilters.includes('pendente') && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors select-none">Pendente (Sem nota)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group p-2.5 -mx-2.5 rounded-xl hover:bg-slate-800/50 transition-all">
              <input type="checkbox" className="hidden" checked={chatFilters.includes('parcial')} onChange={() => onToggle('parcial')} />
              <div className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${chatFilters.includes('parcial') ? 'bg-blue-600 border-blue-600' : 'bg-slate-950 border-slate-600 group-hover:border-slate-500'}`}>
                {chatFilters.includes('parcial') && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors select-none">Parcial (Apenas mensagens)</span>
            </label>
          </div>
          <div className="h-px w-full bg-slate-800/80"></div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nota Geral (Satisfação)</p>
            {[5, 4, 3, 2, 1].map((star) => {
              const isChecked = chatFilters.includes(star);
              const colorObj = getRatingColor(star);
              return (
                <label key={star} className="flex items-center gap-3 cursor-pointer group p-2.5 -mx-2.5 rounded-xl hover:bg-slate-800/50 transition-all">
                  <input type="checkbox" className="hidden" checked={isChecked} onChange={() => onToggle(star)} />
                  <div className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-slate-950 border-slate-600 group-hover:border-slate-500'}`}>
                    {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className={`text-sm font-bold flex items-center gap-1.5 ${colorObj.text} transition-all select-none`}>
                    {star} <Star className={`w-3.5 h-3.5 ${colorObj.fill}`} />
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-800/80">
          <button
            onClick={onClear}
            className="flex-1 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-bold transition-all duration-200 cursor-pointer"
          >
            Limpar
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all duration-200 cursor-pointer"
          >
            Ver Resultados
          </button>
        </div>
      </div>
    </div>
  );
}
