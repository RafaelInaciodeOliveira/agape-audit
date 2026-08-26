'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { 
  ArrowLeft, BarChart3, Star, Calendar,
  GraduationCap, ListChecks, FileSpreadsheet, LucideIcon,
  TrendingUp, Activity, CheckCircle2, MessageSquareWarning,
  PieChart, Target, AlertTriangle
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// --- Interfaces Atualizadas ---
interface ThemeRow { topicName: string; subtopicName?: string; total: number; kbFailCount: number; }
interface DailyRow { day: string; total: number; kbFailCount?: number; [key: string]: string | number | undefined; }
interface CarteiraRow { carteira: string; total: number; kbFailCount: number; violatedCount: number; }
interface QualityData { 
  totalAudited: number; 
  kbFailCount: number; 
  violatedCount: number;
  avgRating: string | number | null; 
  byDay: DailyRow[]; 
  byCarteira: CarteiraRow[];
  reasonsDistribution?: { id: string, name: string, count: number }[];
}
interface ValueData { 
  qaGenerated: number; 
  messagesAuditedByDay: DailyRow[]; 
  ratingDistribution: { rating: number; count: number }[];
}
interface StatCardProps { icon: LucideIcon; label: string; value: string | number; accent: string; }

// --- Formatadores de Data BR ---
function formatDayBR(isoStr: string) {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return isoStr;
}

function formatFullDateBR(isoStr: string) {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoStr;
}

// --- Componentes ---
function StatCard({ icon: Icon, label, value, accent }: StatCardProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 flex items-center gap-4 transition-all hover:scale-[1.02] hover:bg-slate-900/80 shadow-lg shadow-black/20">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-2xl font-black text-slate-100 tracking-tight leading-tight">{value}</div>
        <div className="text-xs font-medium text-slate-500 mt-1">{label}</div>
      </div>
    </div>
  );
}

// Gráfico de Temas (Volume)
function ThemesBarChart({ rows }: { rows: ThemeRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="space-y-4 mt-2 w-full pb-16">
      {rows.length === 0 && (
        <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl w-full">
          <p className="text-sm text-slate-500">Nenhum dado auditado no período.</p>
        </div>
      )}
      {rows.map((r, i) => {
        const label = r.subtopicName ? `${r.topicName || 'Sem tópico'} · ${r.subtopicName}` : (r.topicName || 'Sem tópico');
        const pct = (r.total / max) * 100;
        const kbFailPct = r.total > 0 ? (r.kbFailCount / r.total) * 100 : 0;
        
        const isBottomHalf = i >= rows.length / 2;
        const tooltipPositionClass = isBottomHalf ? "bottom-full mb-2.5" : "top-full mt-2.5";
        
        return (
          <div key={i} className="group relative w-full z-10 hover:z-50">
            <div className="flex justify-between items-baseline gap-3 text-xs mb-1.5">
              <span className="text-slate-300 font-semibold truncate min-w-0">{label}</span>
              <span className="text-slate-400 font-mono shrink-0 whitespace-nowrap">
                {r.total} {r.total === 1 ? 'auditoria' : 'auditorias'}
              </span>
            </div>
            <div className="h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80 shadow-inner w-full flex">
              <div className="h-full bg-blue-600 relative transition-all duration-500 flex" style={{ width: `${pct}%` }}>
                {kbFailPct > 0 && (
                  <div className="h-full bg-red-500 transition-all duration-500 border-l border-slate-900/20" style={{ width: `${kbFailPct}%` }} />
                )}
              </div>
            </div>
            
            <div className={`absolute left-1/2 -translate-x-1/2 ${tooltipPositionClass} w-max max-w-[18rem] bg-slate-800 border border-slate-700 text-white text-xs p-3 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex flex-col gap-1 z-50`}>
              <span className="font-bold text-slate-100 border-b border-slate-600 pb-1 mb-1 truncate">{label}</span>
              <span className="text-blue-300">• Total auditado: <span className="font-mono font-bold text-white">{r.total}</span></span>
              <span className="text-emerald-400">• Corretas: <span className="font-mono font-bold text-white">{r.total - r.kbFailCount}</span></span>
              {r.kbFailCount > 0 && <span className="text-red-400">• Falhas na Base: <span className="font-mono font-bold">{r.kbFailCount}</span></span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Gráfico de Barras Vertical
function DailyBarChart({ rows, failKey, colorClass = "bg-blue-600" }: { rows: DailyRow[]; failKey?: string, colorClass?: string }) {
  const actualMax = Math.max(1, ...rows.map((r) => r.total));
  const gridMax = Math.max(5, Math.ceil((actualMax * 1.4) / 5) * 5); 
  const gridLines = [gridMax, gridMax * 0.75, gridMax * 0.5, gridMax * 0.25, 0];

  return (
    <div className="relative h-[22rem] w-full flex items-end gap-6 pt-12 pb-8 pl-12 pr-16 overflow-x-auto custom-scrollbar">
      <div className="absolute inset-0 pt-12 pb-8 flex flex-col justify-between pointer-events-none min-w-full">
        {gridLines.map((lineVal, i) => (
          <div key={i} className="relative w-full border-t border-slate-800/60 h-0 flex items-center">
             <span className="absolute -left-10 text-[11px] text-slate-500 font-mono w-8 text-right pr-2">{Math.round(lineVal)}</span>
          </div>
        ))}
      </div>
      {rows.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center"><p className="text-sm text-slate-500">Sem dados.</p></div>
      )}
      {rows.map((r, i) => {
        const heightPct = (r.total / gridMax) * 100;
        const failCount = failKey ? Number(r[failKey] || 0) : 0;
        const failPct = r.total > 0 ? (failCount / r.total) * 100 : 0;
        
        return (
          <div key={i} className="relative flex flex-col items-center gap-2 shrink-0 w-12 group h-full justify-end z-10 hover:z-50">
            <div className="w-full bg-slate-900 rounded-t border border-slate-700/50 relative flex flex-col justify-end transition-all group-hover:brightness-125 group-hover:border-slate-400" style={{ height: `${heightPct}%` }}>
              <div className={`${colorClass} w-full relative rounded-t`} style={{ height: '100%' }}>
                {failPct > 0 && <div className="absolute bottom-0 left-0 w-full bg-red-500" style={{ height: `${failPct}%` }} />}
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max bg-slate-800 border border-slate-700 text-white text-xs p-3 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex flex-col gap-1 items-center whitespace-nowrap z-50">
                <span className="font-bold border-b border-slate-600 pb-1 mb-1 w-full text-center text-slate-200">
                  {formatFullDateBR(r.day)}
                </span>
                <span className="text-slate-300">Total Auditado: <span className="font-mono font-bold text-white">{r.total}</span></span>
                {failKey && (
                  <>
                    <span className="text-emerald-400">Corretas: <span className="font-mono font-bold text-white">{r.total - failCount}</span></span>
                    {failCount > 0 && <span className="text-red-400">Falhas Incorretas: <span className="font-mono font-bold">{failCount}</span></span>}
                  </>
                )}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap absolute -bottom-5">
              {formatDayBR(r.day)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const getFirstDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};
const getToday = () => {
  return new Date().toISOString().split('T')[0];
};

export default function ReportsPage() {
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [value, setValue] = useState<ValueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState(getFirstDayOfMonth()); 
  const [endDate, setEndDate] = useState(getToday());

  useEffect(() => {
    document.title = 'Relatórios de BI · Auditoria Ágape';
    const load = async () => {
      if (!startDate || !endDate) return;

      setLoading(true);
      try {
        setError(null);
        const urlParams = `?startDate=${startDate}&endDate=${endDate}`;
        
        const [themesRes, qualityRes, valueRes] = await Promise.all([
          axios.get(`${API_URL}/reports/themes${urlParams}`),
          axios.get(`${API_URL}/reports/quality${urlParams}`),
          axios.get(`${API_URL}/reports/value${urlParams}`),
        ]);
        setThemes(themesRes.data || []);
        setQuality(qualityRes.data);
        setValue(valueRes.data);
      } catch (err) {
        console.error('Erro ao buscar relatórios:', err);
        setError('Não foi possível carregar os dados do painel.');
      } finally {
        setLoading(false);
      }
    };
    
    const delayDebounceFn = setTimeout(() => {
      load();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [startDate, endDate]);

  const calculateConformity = () => {
    if (!quality || quality.totalAudited === 0) return '—';
    const correctAnswers = quality.totalAudited - quality.kbFailCount;
    return `${Math.round((correctAnswers / quality.totalAudited) * 100)}%`;
  };

  const bottlenecks = [...themes]
    .map(t => ({ ...t, errorRate: t.total > 0 ? t.kbFailCount / t.total : 0 }))
    .filter(t => t.errorRate > 0)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 4);

  const starColors = ['text-emerald-400', 'text-lime-400', 'text-amber-400', 'text-orange-500', 'text-red-500'];
  const starBgs = ['bg-emerald-400', 'bg-lime-400', 'bg-amber-400', 'bg-orange-500', 'bg-red-500'];
  const allStars = [5, 4, 3, 2, 1];
  const maxStarsCount = value?.ratingDistribution ? Math.max(1, ...value.ratingDistribution.map(r => r.count)) : 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased p-6 md:p-10 w-full mx-auto">
      
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition-all shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5 tracking-tight">
              <BarChart3 className="w-7 h-7 text-blue-500" /> Relatórios Ágape
            </h1>
            <p className="text-sm text-slate-500 mt-1">Análise profunda do comportamento e performance do Ágape.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer font-semibold [color-scheme:dark]" />
            </div>
            <span className="text-slate-600 text-xs font-bold uppercase">até</span>
            <div className="flex items-center gap-2">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer font-semibold [color-scheme:dark]" />
            </div>
          </div>
          <a href={`${API_URL}/reports/export?startDate=${startDate}&endDate=${endDate}`} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/10 border border-emerald-500/30 text-sm font-bold text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
            <FileSpreadsheet className="w-4 h-4" /> Exportar (CSV)
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="space-y-6 w-full animate-pulse mt-4 flex flex-col items-center justify-center py-20 text-slate-500">
            <Activity className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            Processando métricas de BI...
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm mb-6 flex items-center gap-2 font-medium">
            <MessageSquareWarning className="w-5 h-5" /> {error}
          </div>
        ) : (
          <div className="flex flex-col gap-6 w-full">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              <StatCard icon={ListChecks} label="Mensagens Revisadas" value={quality?.totalAudited ?? 0} accent="bg-blue-500/10 text-blue-400 border border-blue-500/20" />
              <StatCard icon={CheckCircle2} label="Taxa de Conformidade (IA)" value={calculateConformity()} accent="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" />
              <StatCard icon={Star} label="Satisfação (Nota Média)" value={quality?.avgRating ? Number(quality.avgRating).toFixed(1) : '—'} accent="bg-amber-500/10 text-amber-400 border border-amber-500/20" />
              <StatCard icon={GraduationCap} label="Treinamentos Realizados" value={value?.qaGenerated ?? 0} accent="bg-violet-500/10 text-violet-400 border border-violet-500/20" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
              <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-400" /> Distribuição por Temas
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Volume de respostas agrupadas pelos tópicos de atendimento.</p>
                  </div>
                  <div className="flex gap-4 text-xs font-semibold text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 shrink-0">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600 shadow-inner"></span> Corretas</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 shadow-inner"></span> Falha</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-64">
                  <ThemesBarChart rows={themes} />
                </div>
              </div>

              <div className="lg:col-span-1 bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" /> Gargalos Críticos
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Tópicos com as maiores % de erro.</p>
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  {bottlenecks.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Nenhum erro registrado.</div>
                  ) : (
                    bottlenecks.map((b, i) => (
                      <div key={i} className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 flex justify-between items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-200 truncate">{b.subtopicName ? `${b.topicName} > ${b.subtopicName}` : b.topicName}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {b.kbFailCount} {b.kbFailCount === 1 ? 'falha' : 'falhas'} em {b.total} {b.total === 1 ? 'resposta' : 'respostas'}
                          </div>
                        </div>
                        <div className="shrink-0 bg-red-500/10 border border-red-500/20 text-red-400 font-black text-sm px-2.5 py-1 rounded-lg">
                          {Math.round(b.errorRate * 100)}%
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col w-full">
                <div className="mb-2">
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-400" /> Desempenho Diário
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Comparativo de acertos vs falhas na base cometidas pela IA.</p>
                </div>
                <div className="flex-1 w-full">
                  <DailyBarChart rows={quality?.byDay || []} failKey="kbFailCount" colorClass="bg-blue-600" />
                </div>
                <div className="flex justify-center gap-5 text-xs font-semibold text-slate-400 mt-2">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600"></span> Resposta Correta</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500"></span> Falha na Base</span>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col w-full">
                <div className="mb-2">
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-emerald-400" /> Ritmo de Auditoria
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Histórico de produtividade das revisões diárias.</p>
                </div>
                <div className="flex-1 w-full">
                  <DailyBarChart rows={value?.messagesAuditedByDay || []} colorClass="bg-emerald-600" />
                </div>
                <div className="flex justify-center gap-5 text-xs font-semibold text-slate-400 mt-2">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-600"></span> Total Revisado</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
              
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-400" /> Distribuição de Notas
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Volume de chats por avaliação de satisfação geral.</p>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-3">
                  {allStars.map((s, i) => {
                    const match = value?.ratingDistribution?.find(d => d.rating === s);
                    const count = match ? match.count : 0;
                    const wPct = (count / maxStarsCount) * 100;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`flex items-center gap-1 font-bold text-xs w-10 shrink-0 ${starColors[i]}`}>
                          {s} <Star className={`w-3.5 h-3.5 fill-current`} />
                        </div>
                        <div className="flex-1 h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 shadow-inner">
                          <div className={`h-full ${starBgs[i]} transition-all duration-500`} style={{ width: `${wPct}%` }} />
                        </div>
                        <div className="w-6 text-right text-xs font-mono text-slate-400">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-purple-400" /> Ranking de Falhas
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Os motivos de erro mais frequentes cometidos pela IA.</p>
                </div>
                <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2 max-h-52">
                  {(!quality?.reasonsDistribution || quality.reasonsDistribution.length === 0) ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-emerald-500 font-bold bg-emerald-500/10 py-6 rounded-xl border border-emerald-500/20">
                      Nenhuma falha detectada! 🎉
                    </div>
                  ) : (
                    quality.reasonsDistribution.map((r, i) => {
                      const maxCount = quality.reasonsDistribution![0].count; // O primeiro sempre é o maior
                      const pct = Math.max(2, (r.count / maxCount) * 100);
                      
                      return (
                        <div key={r.id} className="relative overflow-hidden bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between p-3 group hover:border-slate-600 transition-all">
                          <div className="absolute left-0 top-0 bottom-0 bg-purple-500/15 transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>

                          <div className="flex items-center gap-3 z-10 pl-2 min-w-0">
                            <div className="w-6 h-6 rounded bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 shadow-inner group-hover:text-purple-400 group-hover:border-purple-500/50 transition-colors">
                              {i + 1}º
                            </div>
                            <span className="text-xs font-bold text-slate-200 truncate" title={r.name}>{r.name}</span>
                          </div>
                          <div className="z-10 flex items-center gap-1.5 shrink-0 pl-3">
                            <span className="text-sm font-black text-white">{r.count}</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              {r.count === 1 ? 'falha' : 'falhas'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Target className="w-5 h-5 text-pink-400" /> Conformidade por Carteira
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Taxa de sucesso geral da IA por segmentação de clientes.</p>
                </div>
                <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-52 custom-scrollbar pr-2">
                  {(!quality?.byCarteira || quality.byCarteira.length === 0) ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Sem dados.</div>
                  ) : (
                    quality.byCarteira.map((c, i) => {
                      const conformityPct = c.total > 0 ? Math.round(((c.total - c.kbFailCount) / c.total) * 100) : 0;
                      let color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
                      if (conformityPct < 85) color = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
                      if (conformityPct < 70) color = 'text-red-400 bg-red-500/10 border-red-500/30';

                      return (
                        <div key={i} className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                          <div>
                            <div className="text-xs font-bold text-slate-200">{c.carteira}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {c.total} {c.total === 1 ? 'chat auditado' : 'chats auditados'}
                            </div>
                          </div>
                          <div className={`px-2.5 py-1 rounded-lg border font-black text-xs ${color}`}>
                            {conformityPct}%
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}