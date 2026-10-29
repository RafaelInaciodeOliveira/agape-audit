import { Inbox, MessagesSquare, ClipboardCheck, Percent, AlertTriangle, Activity, CalendarRange } from 'lucide-react';
import { StatCard } from '../common/StatCard';
import { formatDayBR } from '../../lib/format';

export interface VolumeData {
  /** Todas as conversas recebidas na Umbler no período (qualquer opção do menu). */
  totalReceived: number;
  /** Conversas "Tirar Dúvidas" (atendidas pelo Ágape) criadas no período. */
  generated: number;
  /** Dessas, quantas têm nota geral ou ao menos uma resposta auditada. */
  audited: number;
  byDay: Array<{ day: string; generated: number; audited: number }>;
  /** O período passou do teto de segurança: só as `limit` conversas mais recentes foram analisadas. */
  limitReached: boolean;
  limit: number;
}

interface Props {
  data: VolumeData | null;
  loading: boolean;
  error: string | null;
}

// Card comparativo "Conversas Geradas" vs. "Conversas Auditadas" do relatório.
export function VolumeComparison({ data, loading, error }: Props) {
  const generated = data?.generated ?? 0;
  const audited = data?.audited ?? 0;
  const coverage = generated > 0 ? Math.round((audited / generated) * 100) : null;
  const maxDay = Math.max(1, ...(data?.byDay ?? []).map((d) => d.generated));

  return (
    <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col gap-5 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <MessagesSquare className="w-5 h-5 text-cyan-400" /> Volume da Operação
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Conversas &quot;Tirar Dúvidas&quot; geradas no período (direto da Umbler) vs. quantas já foram auditadas.
          </p>
        </div>
        {data && (
          <span className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 shrink-0">
            {data.totalReceived} {data.totalReceived === 1 ? 'conversa recebida' : 'conversas recebidas'} no total
          </span>
        )}
      </div>

      {loading ? (
        <VolumeSkeleton />
      ) : error ? (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : (
        <>
          {data?.limitReached && <LimitReachedBanner limit={data.limit} />}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={Inbox} label="Total de Conversas Geradas" value={generated} accent="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" />
            <StatCard icon={ClipboardCheck} label="Conversas Auditadas" value={audited} accent="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" />
            <StatCard
              icon={Percent}
              label="Cobertura da Auditoria"
              value={coverage === null ? '—' : `${coverage}%`}
              subValue={generated > 0 ? `${generated - audited} pendentes` : undefined}
              accent="bg-blue-500/10 text-blue-400 border border-blue-500/20"
            />
          </div>

          <div className="space-y-2.5">
            <ComparisonBar label="Geradas" value={generated} max={Math.max(1, generated)} colorClass="bg-cyan-500" />
            <ComparisonBar label="Auditadas" value={audited} max={Math.max(1, generated)} colorClass="bg-emerald-500" />
          </div>

          {data && data.byDay.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-400">Por dia de criação da conversa</span>
                <div className="flex gap-4 text-[11px] font-semibold text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-cyan-500/40 border border-cyan-500/60" /> Geradas</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Auditadas</span>
                </div>
              </div>
              <div className="h-36 flex items-end gap-1.5 overflow-x-auto custom-scrollbar pb-5 pt-2">
                {data.byDay.map((d) => (
                  <div
                    key={d.day}
                    title={`${formatDayBR(d.day)}: ${d.generated} geradas · ${d.audited} auditadas`}
                    className="relative shrink-0 w-7 h-full flex items-end"
                  >
                    <div
                      className="w-full bg-cyan-500/25 border border-cyan-500/50 rounded-t flex items-end overflow-hidden"
                      style={{ height: `${(d.generated / maxDay) * 100}%` }}
                    >
                      <div className="w-full bg-emerald-500" style={{ height: `${d.generated > 0 ? (d.audited / d.generated) * 100 : 0}%` }} />
                    </div>
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-500 font-mono whitespace-nowrap">
                      {formatDayBR(d.day)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}

function ComparisonBar({ label, value, max, colorClass }: { label: string; value: number; max: number; colorClass: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-semibold text-slate-300">{label}</span>
      <div className="flex-1 h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 shadow-inner">
        <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="w-12 text-right text-xs font-mono text-slate-400">{value}</span>
    </div>
  );
}

// Aviso quando o período tem mais conversas do que o teto analisado de uma vez.
function LimitReachedBanner({ limit }: { limit: number }) {
  return (
    <div role="status" className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3.5">
      <CalendarRange className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-amber-200">Período com volume muito grande de conversas</p>
        <p className="text-xs text-amber-200/75 leading-relaxed">
          Exibindo as {limit.toLocaleString('pt-BR')} conversas mais recentes do período, então os números abaixo podem ficar menores que o real.
          Para maior precisão, selecione um intervalo de datas menor.
        </p>
      </div>
    </div>
  );
}

// Placeholder enquanto a Umbler é paginada (períodos longos podem levar alguns segundos).
function VolumeSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Activity className="w-4 h-4 animate-spin text-cyan-400" />
        Buscando as conversas do período na Umbler. Períodos longos podem levar alguns segundos...
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[5.5rem] rounded-xl bg-slate-900/60 border border-slate-800/60" />
        ))}
      </div>
      <div className="space-y-2.5 animate-pulse">
        <div className="h-3.5 w-full rounded-full bg-slate-800/60" />
        <div className="h-3.5 w-2/3 rounded-full bg-slate-800/60" />
      </div>
    </div>
  );
}
