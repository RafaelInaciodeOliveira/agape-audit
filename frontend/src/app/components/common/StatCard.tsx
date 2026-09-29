import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent: string;
  subValue?: string;
  subValueTitle?: string;
  hint?: string;
  /** Corta textos longos com reticências (usado no painel de custos, onde os valores podem ser extensos). */
  truncate?: boolean;
}

// Card de métrica dos painéis de Relatórios e Custos de IA.
export function StatCard({ icon: Icon, label, value, accent, subValue, subValueTitle, hint, truncate = false }: StatCardProps) {
  return (
    <div className={`bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 flex items-center gap-4 transition-all hover:scale-[1.02] hover:bg-slate-900/80 shadow-lg shadow-black/20${truncate ? ' min-w-0' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className={truncate ? 'min-w-0' : undefined}>
        <div className={`text-2xl font-black text-slate-100 tracking-tight leading-tight${truncate ? ' truncate' : ''}`} title={truncate ? String(value) : undefined}>{value}</div>
        {subValue && <div className="text-sm font-semibold text-slate-400 font-mono tabular-nums truncate" title={subValueTitle}>{subValue}</div>}
        <div className="text-xs font-medium text-slate-500 mt-1">{label}</div>
        {hint && <div className="text-[11px] text-slate-400 mt-0.5 truncate" title={hint}>{hint}</div>}
      </div>
    </div>
  );
}
