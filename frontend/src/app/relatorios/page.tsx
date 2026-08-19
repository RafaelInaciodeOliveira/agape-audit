'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ArrowLeft, BarChart3, MessageSquareWarning, Star, GraduationCap, ListChecks, FileSpreadsheet } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <div className="text-lg font-bold text-slate-100 leading-tight">{value}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function ThemesBarChart({ rows }: { rows: any[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="space-y-2.5">
      {rows.length === 0 && (
        <p className="text-xs text-slate-500">Nenhuma resposta auditada com tópico ainda.</p>
      )}
      {rows.map((r, i) => {
        const label = r.subtopicName ? `${r.topicName || 'Sem tópico'} · ${r.subtopicName}` : (r.topicName || 'Sem tópico');
        const pct = (r.total / max) * 100;
        const kbFailPct = r.total > 0 ? (r.kbFailCount / r.total) * 100 : 0;
        return (
          <div key={i}>
            <div className="flex justify-between items-baseline gap-3 text-[11px] mb-1">
              <span className="text-slate-300 font-medium truncate min-w-0">{label}</span>
              <span className="text-slate-500 font-mono shrink-0 whitespace-nowrap">
                {r.total}{r.kbFailCount > 0 && <span className="text-red-400"> ({r.kbFailCount} falha base)</span>}
              </span>
            </div>
            <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full bg-blue-600/70 relative" style={{ width: `${pct}%` }}>
                {kbFailPct > 0 && (
                  <div
                    className="absolute right-0 top-0 h-full bg-red-500/80"
                    style={{ width: `${kbFailPct}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailyBarChart({ rows, failKey }: { rows: any[]; failKey?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="flex items-end gap-2 overflow-x-auto custom-scrollbar pb-1">
      {rows.length === 0 && <p className="text-xs text-slate-500">Sem dados no período.</p>}
      {rows.map((r, i) => {
        const heightPct = (r.total / max) * 100;
        const failCount = failKey ? r[failKey] || 0 : 0;
        const failPct = r.total > 0 ? (failCount / r.total) * 100 : 0;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-9" title={`${r.day}: ${r.total}`}>
            <div className="w-full bg-slate-900 rounded-t border border-slate-800 relative flex flex-col justify-end" style={{ height: '96px' }}>
              <div className="bg-blue-600/70 w-full relative" style={{ height: `${heightPct}%` }}>
                {failPct > 0 && (
                  <div className="absolute bottom-0 left-0 w-full bg-red-500/80" style={{ height: `${failPct}%` }} />
                )}
              </div>
            </div>
            <span className="text-[9px] text-white font-mono whitespace-nowrap">{r.day?.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const [themes, setThemes] = useState<any[]>([]);
  const [quality, setQuality] = useState<any>(null);
  const [value, setValue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Relatórios · Auditoria Ágape';
    const load = async () => {
      try {
        const [themesRes, qualityRes, valueRes] = await Promise.all([
          axios.get(`${API_URL}/reports/themes`),
          axios.get(`${API_URL}/reports/quality`),
          axios.get(`${API_URL}/reports/value`),
        ]);
        setThemes(themesRes.data || []);
        setQuality(qualityRes.data);
        setValue(valueRes.data);
      } catch (err) {
        console.error('Erro ao buscar relatórios:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pct = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '—');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-300 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold text-blue-400 flex items-center gap-2 flex-1">
          <BarChart3 className="w-5 h-5" /> Relatórios de Auditoria do Ágape
        </h1>
        <a
          href={`${API_URL}/reports/export`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-emerald-300 hover:border-emerald-500/40 transition-all"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar CSV
        </a>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Carregando relatórios...</p>
      ) : (
        <div className="space-y-8">
          <p className="text-[11px] text-slate-500 -mt-2 leading-relaxed max-w-2xl">
            Estes números refletem o que já foi auditado manualmente, não 100% do volume de conversas do Ágape na Umbler.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={ListChecks} label="Respostas auditadas" value={quality?.totalAudited ?? 0} accent="bg-blue-500/10 text-blue-400" />
            <StatCard icon={MessageSquareWarning} label="Falha na base" value={pct(quality?.kbFailCount ?? 0, quality?.totalAudited ?? 0)} accent="bg-red-500/10 text-red-400" />
            <StatCard icon={Star} label="Nota média do chat" value={quality?.avgRating ? Number(quality.avgRating).toFixed(1) : '—'} accent="bg-amber-500/10 text-amber-400" />
            <StatCard icon={GraduationCap} label="Q&As gerados p/ treino" value={value?.qaGenerated ?? 0} accent="bg-emerald-500/10 text-emerald-400" />
          </div>

          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-1">Temas mais perguntados</h2>
            <p className="text-[11px] text-slate-500 mb-4">Volume de respostas auditadas por tópico/subtópico. Em vermelho, a parcela marcada como falha na base — mostra onde o conhecimento do Ágape está mais fraco.</p>
            <ThemesBarChart rows={themes} />
          </div>

          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-1">Qualidade ao longo do tempo</h2>
            <p className="text-[11px] text-slate-500 mb-4">Volume de respostas auditadas por dia. Em vermelho, a parcela com falha na base de conhecimento.</p>
            <DailyBarChart rows={quality?.byDay || []} failKey="kbFailCount" />
          </div>

          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-1">Volume de auditorias por dia</h2>
            <p className="text-[11px] text-slate-500 mb-4">Quantas respostas do Ágape foram revisadas por dia.</p>
            <DailyBarChart rows={value?.messagesAuditedByDay || []} />
          </div>
        </div>
      )}
    </div>
  );
}
