import { Check } from 'lucide-react';
import type { FailReason } from '../../lib/types';

// Motivos de falha marcáveis (com aviso quando não há nenhum cadastrado).
export function FailReasonChecklist({ failReasons, selected, onToggle }: { failReasons: FailReason[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <>
      {failReasons.length === 0 && (
        <span className="text-xs text-slate-500 block mb-2">Nenhum motivo configurado. Use a engrenagem no topo esquerdo para criar.</span>
      )}

      {failReasons.map((reason) => {
        const isChecked = selected.includes(reason.id);
        return (
          <label key={reason.id} className="flex items-start gap-3 cursor-pointer group p-3 -mx-3 rounded-xl hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-700/50">
            <input type="checkbox" className="hidden" checked={isChecked} onChange={() => onToggle(reason.id)} />
            <div className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-slate-900 border-slate-600 group-hover:border-slate-500'}`}>
              {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <span className={`text-sm leading-snug transition-colors select-none ${isChecked ? 'text-slate-100 font-medium' : 'text-slate-400 group-hover:text-slate-300'}`}>
              {reason.name}
            </span>
          </label>
        );
      })}
    </>
  );
}
