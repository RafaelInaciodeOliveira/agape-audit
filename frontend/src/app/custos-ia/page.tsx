'use client';

import React, { useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import axios from 'axios';
import Link from 'next/link';
import useSWR from 'swr';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Calendar, Coins, Cpu, Crown, Receipt, BarChart3, MessageSquareWarning, RefreshCw, ChevronLeft, ChevronRight, LucideIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { API_URL, fetcher } from '../lib/api';



// Cotação do dólar (AwesomeAPI). Usa "ask", o preço de venda do dólar: quanto custa comprar US$ 1 em reais.
const EXCHANGE_URL = 'https://economia.awesomeapi.com.br/last/USD-BRL';
interface ExchangeResponse { USDBRL?: { ask?: string; create_date?: string } }
const exchangeFetcher = (url: string) => axios.get<ExchangeResponse>(url, { timeout: 8000 }).then(res => res.data);

// --- Interfaces (espelham GET /api/finops/costs) ---
interface ModelCost {
  modelName: string;
  totalCost: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requests: number;
}
interface DailyCost { day: string; totalCost: number; models: Record<string, number>; }
interface UsageRow {
  id: string;
  userId: string;
  userName?: string;
  modelName: string;
  credits?: number;
  tokensEstimated?: boolean;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  timestamp: string;
}
interface CostsResponse {
  period: { startDate: string; endDate: string };
  currency: string;
  lastSyncAt: string | null;
  summary: {
    totalCost: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requests: number;
    mostExpensiveModel: ModelCost | null;
  };
  models: string[];
  byModel: ModelCost[];
  daily: DailyCost[];
  recent: UsageRow[];
  pagination: { page: number; limit: number; totalRecords: number; totalPages: number };
}
interface Series { key: string; name: string; color: string; }

// Paleta categórica (tons para fundo escuro), validada para daltonismo em ordem fixa.
// Máximo de 7 modelos com cor própria; o restante vira "Outros" em cinza.
const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];
const OTHERS_COLOR = '#64748b';
const MAX_NAMED_SERIES = SERIES_COLORS.length;
const CHART_SURFACE = '#0c1220';
const PAGE_SIZE = 15;

// --- Formatadores ---
const money = (value: number, currency: string, maxDigits = 2) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: maxDigits,
  }).format(value || 0);

const compactNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);

const fullNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value || 0);

function formatDayBR(isoStr: string) {
  const parts = isoStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : isoStr;
}

function formatFullDateBR(isoStr: string) {
  const parts = isoStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : isoStr;
}

function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const getFirstDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};
const getToday = () => new Date().toISOString().split('T')[0];

// Os 7 modelos mais caros do período ganham cor própria, atribuída em ordem alfabética
// para que o mesmo modelo mantenha a cor quando o ranking muda entre períodos.
function buildSeries(byModel: ModelCost[]) {
  const named = byModel.slice(0, MAX_NAMED_SERIES).map(m => m.modelName).sort((a, b) => a.localeCompare(b));
  const series: Series[] = named.map((name, i) => ({ key: `s${i}`, name, color: SERIES_COLORS[i] }));
  const hasOthers = byModel.length > MAX_NAMED_SERIES;
  if (hasOthers) series.push({ key: 'others', name: 'Outros', color: OTHERS_COLOR });
  return series;
}

// --- Componentes ---
interface StatCardProps { icon: LucideIcon; label: string; value: string; subValue?: string; subValueTitle?: string; hint?: string; accent: string; }

function StatCard({ icon: Icon, label, value, subValue, subValueTitle, hint, accent }: StatCardProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 flex items-center gap-4 transition-all hover:scale-[1.02] hover:bg-slate-900/80 shadow-lg shadow-black/20 min-w-0">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-black text-slate-100 tracking-tight leading-tight truncate" title={value}>{value}</div>
        {subValue && <div className="text-sm font-semibold text-slate-400 font-mono tabular-nums truncate" title={subValueTitle}>{subValue}</div>}
        <div className="text-xs font-medium text-slate-500 mt-1">{label}</div>
        {hint && <div className="text-[11px] text-slate-400 mt-0.5 truncate" title={hint}>{hint}</div>}
      </div>
    </div>
  );
}

interface TooltipEntry { dataKey?: string | number; value?: number | string; }
interface CostTooltipProps { active?: boolean; payload?: readonly TooltipEntry[]; label?: string | number; series: Series[]; currency: string; }

function CostTooltip({ active, payload, label, series, currency }: CostTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload
    .map(p => ({ serie: series.find(s => s.key === p.dataKey), value: Number(p.value || 0) }))
    .filter(r => r.serie && r.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div className="bg-slate-800 border border-slate-700 text-xs p-3 rounded-xl shadow-2xl flex flex-col gap-1.5 min-w-[12rem]">
      <span className="font-bold border-b border-slate-600 pb-1 mb-0.5 text-slate-200">{formatFullDateBR(String(label))}</span>
      {rows.length === 0 && <span className="text-slate-400">Sem consumo neste dia.</span>}
      {rows.map(r => (
        <span key={r.serie!.key} className="flex items-center justify-between gap-4 text-slate-300">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.serie!.color }} />
            <span className="truncate">{r.serie!.name}</span>
          </span>
          <span className="font-mono font-bold text-white tabular-nums">{money(r.value, currency, 4)}</span>
        </span>
      ))}
      {rows.length > 1 && (
        <span className="flex justify-between gap-4 border-t border-slate-600 pt-1 mt-0.5 text-slate-300">
          Total <span className="font-mono font-bold text-white tabular-nums">{money(total, currency, 4)}</span>
        </span>
      )}
    </div>
  );
}

function DailyCostChart({ daily, byModel, currency }: { daily: DailyCost[]; byModel: ModelCost[]; currency: string }) {
  const series = useMemo(() => buildSeries(byModel), [byModel]);

  const chartData = useMemo(() => {
    const keyByModel = new Map(series.filter(s => s.key !== 'others').map(s => [s.name, s.key]));
    return daily.map(d => {
      const row: Record<string, string | number> = { day: d.day };
      for (const s of series) row[s.key] = 0;
      for (const [model, cost] of Object.entries(d.models)) {
        const key = keyByModel.get(model) || 'others';
        row[key] = Number(row[key] || 0) + cost;
      }
      return row;
    });
  }, [daily, series]);

  const hasData = daily.some(d => d.totalCost > 0);

  return (
    <div className="flex flex-col gap-4">
      {series.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-400">
          {series.map(s => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ background: s.color }} /> {s.name}
            </span>
          ))}
        </div>
      )}
      <div className="relative h-80 w-full">
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <p className="text-sm text-slate-500">Nenhum consumo registrado no período.</p>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="#1e293b" />
            <XAxis
              dataKey="day"
              tickFormatter={formatDayBR}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              minTickGap={12}
            />
            <YAxis
              tickFormatter={(v: number) => money(v, currency)}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
              content={(props) => (
                <CostTooltip
                  active={props.active}
                  payload={props.payload as readonly TooltipEntry[] | undefined}
                  label={props.label}
                  series={series}
                  currency={currency}
                />
              )}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="cost"
                fill={s.color}
                stroke={CHART_SURFACE}
                strokeWidth={1}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={40}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function UsageTable({ rows, colorByModel, currency, usdRate }: { rows: UsageRow[]; colorByModel: Map<string, string>; currency: string; usdRate: number | null }) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl">
        <p className="text-sm text-slate-500">Nenhuma requisição registrada no período.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <th className="py-3 pr-4 font-bold">Data / Hora</th>
            <th className="py-3 pr-4 font-bold">Usuário</th>
            <th className="py-3 pr-4 font-bold">Modelo</th>
            <th className="py-3 pr-4 font-bold text-right">Prompt</th>
            <th className="py-3 pr-4 font-bold text-right">Completion</th>
            <th className="py-3 pr-4 font-bold text-right">Total tokens</th>
            <th className="py-3 pr-4 font-bold text-right">Créditos</th>
            <th className="py-3 font-bold text-right">Custo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-slate-800/60 hover:bg-slate-900/60 transition-colors">
              <td className="py-3 pr-4 text-slate-400 whitespace-nowrap font-mono text-xs">{formatDateTimeBR(r.timestamp)}</td>
              <td className="py-3 pr-4 text-slate-300 max-w-[12rem] truncate" title={r.userId}>{r.userName || r.userId}</td>
              <td className="py-3 pr-4 whitespace-nowrap">
                <span className="flex items-center gap-2 text-slate-200 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorByModel.get(r.modelName) || OTHERS_COLOR }} />
                  {r.modelName}
                </span>
              </td>
              <td className="py-3 pr-4 text-right text-slate-400 font-mono tabular-nums">{fullNumber(r.promptTokens)}</td>
              <td className="py-3 pr-4 text-right text-slate-400 font-mono tabular-nums">{fullNumber(r.completionTokens)}</td>
              <td className="py-3 pr-4 text-right text-slate-300 font-mono tabular-nums" title={r.tokensEstimated ? 'Estimado (a origem não informa tokens)' : undefined}>
                {r.tokensEstimated ? '~' : ''}{fullNumber(r.totalTokens)}
              </td>
              <td className="py-3 pr-4 text-right text-slate-400 font-mono tabular-nums">{r.credits != null ? fullNumber(r.credits) : '—'}</td>
              <td className="py-3 text-right font-mono tabular-nums whitespace-nowrap">
                <div className="text-slate-100 font-bold">{money(r.totalCost, currency, 4)}</div>
                {usdRate && <div className="text-[11px] text-slate-500">{money(r.totalCost / usdRate, 'USD', 4)}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps { page: number; totalPages: number; totalRecords: number; loading: boolean; onChange: (page: number) => void; }

function Pagination({ page, totalPages, totalRecords, loading, onChange }: PaginationProps) {
  const buttonClass = 'flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-blue-300 hover:border-blue-500/40 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:border-slate-800 disabled:active:scale-100';
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-1">
      <span className="text-xs text-slate-500">
        Página <span className="font-semibold text-slate-300">{page}</span> de <span className="font-semibold text-slate-300">{totalPages}</span>
        {' · '}{fullNumber(totalRecords)} {totalRecords === 1 ? 'registro' : 'registros'}
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(page - 1)} disabled={loading || page <= 1} className={buttonClass}>
          <ChevronLeft className="w-3.5 h-3.5" /> Anterior
        </button>
        <button onClick={() => onChange(page + 1)} disabled={loading || page >= totalPages} className={buttonClass}>
          Próxima <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <div key={i} className="h-[5.5rem] rounded-xl bg-slate-900/60 border border-slate-800/60" />)}
      </div>
      <div className="h-[26rem] rounded-2xl bg-slate-900/40 border border-slate-800/60" />
      <div className="h-72 rounded-2xl bg-slate-900/40 border border-slate-800/60" />
    </div>
  );
}

export default function AiCostsDashboard() {
  const isAuthorized = useAuth();
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getToday());
  const [currentPage, setCurrentPage] = useState(1);

  // Trocar o período volta o extrato para a primeira página
  const changeStartDate = (value: string) => { setStartDate(value); setCurrentPage(1); };
  const changeEndDate = (value: string) => { setEndDate(value); setCurrentPage(1); };

  const costsUrl = isAuthorized && startDate && endDate
    ? `${API_URL}/finops/costs?startDate=${startDate}&endDate=${endDate}&page=${currentPage}&limit=${PAGE_SIZE}`
    : null;
  const { data, error, isLoading, mutate } = useSWR<CostsResponse>(costsUrl, fetcher, { keepPreviousData: true });
  const [syncing, setSyncing] = useState(false);

  // Se a cotação falhar, a tela segue só em reais
  const { data: exchange } = useSWR<ExchangeResponse>(isAuthorized ? EXCHANGE_URL : null, exchangeFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30 * 60_000,
    shouldRetryOnError: false,
  });
  const parsedRate = Number(exchange?.USDBRL?.ask);
  const exchangeRate = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : null;
  const exchangeDate = exchange?.USDBRL?.create_date;

  const handleSync = async () => {
    setSyncing(true);
    const toastId = toast.loading('Importando consumo do Ágape na Umbler...');
    try {
      const res = await axios.post(`${API_URL}/finops/sync`);
      const { inserted, failedChats } = res.data;
      toast.success(
        inserted > 0 ? `${inserted} ${inserted === 1 ? 'nova resposta cobrada importada' : 'novas respostas cobradas importadas'}.` : 'Tudo em dia, nenhum consumo novo.',
        { id: toastId, description: failedChats ? `${failedChats} chat(s) com erro de leitura; tente de novo em instantes.` : undefined }
      );
      await mutate();
    } catch (err) {
      const message = (axios.isAxiosError(err) && err.response?.data?.error) || 'Falha ao sincronizar com a Umbler.';
      toast.error(message, { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const colorByModel = useMemo(() => {
    const series = buildSeries(data?.byModel || []);
    return new Map(series.filter(s => s.key !== 'others').map(s => [s.name, s.color]));
  }, [data?.byModel]);

  if (!isAuthorized) {
    return <div className="h-screen w-screen bg-slate-950"></div>;
  }

  const summary = data?.summary;
  const topModel = summary?.mostExpensiveModel;
  const topModelShare = topModel && summary && summary.totalCost > 0
    ? Math.round((topModel.totalCost / summary.totalCost) * 100)
    : 0;
  // A conversão só faz sentido quando os custos estão em reais
  const usdRate = data?.currency === 'BRL' ? exchangeRate : null;
  const toUsd = (value: number) => (usdRate ? money(value / usdRate, 'USD') : undefined);
  const rateTitle = usdRate
    ? `Cotação USD/BRL ${usdRate.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}${exchangeDate ? ` em ${exchangeDate}` : ''} (AwesomeAPI)`
    : undefined;

  const errorMessage = error
    ? (axios.isAxiosError(error) && error.response?.data?.error) || 'Não foi possível carregar os custos de IA.'
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased p-6 md:p-10 w-full mx-auto">
      <Toaster theme="dark" position="top-right" richColors />

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition-all shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5 tracking-tight">
              <Coins className="w-7 h-7 text-blue-500" /> Custos de IA
            </h1>
            <p className="text-sm text-slate-500 mt-1">Créditos consumidos pelo Ágape na Umbler e tokens estimados por resposta.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <input type="date" value={startDate} max={endDate} onChange={(e) => changeStartDate(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer font-semibold [color-scheme:dark]" />
          </div>
          <span className="text-slate-600 text-xs font-bold uppercase">até</span>
          <input type="date" value={endDate} min={startDate} onChange={(e) => changeEndDate(e.target.value)} className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer font-semibold [color-scheme:dark]" />
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          title={data?.lastSyncAt ? `Última sincronização: ${formatDateTimeBR(data.lastSyncAt)}` : 'Nunca sincronizado'}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/10 border border-blue-500/30 text-sm font-bold text-blue-400 hover:bg-blue-600 hover:text-white active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {errorMessage ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm mb-6 flex items-center gap-2 font-medium">
            <MessageSquareWarning className="w-5 h-5" /> {errorMessage}
          </div>
        ) : isLoading && !data ? (
          <DashboardSkeleton />
        ) : data && summary ? (
          <div className={`flex flex-col gap-6 w-full transition-opacity ${isLoading ? 'opacity-60' : ''}`}>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              <StatCard
                icon={Coins}
                label="Custo Total"
                value={money(summary.totalCost, data.currency)}
                subValue={toUsd(summary.totalCost)}
                subValueTitle={rateTitle}
                hint={`${fullNumber(summary.requests)} ${summary.requests === 1 ? 'requisição' : 'requisições'}`}
                accent="bg-blue-500/10 text-blue-400 border border-blue-500/20"
              />
              <StatCard
                icon={Cpu}
                label="Total de Tokens (estimado)"
                value={`~${compactNumber(summary.totalTokens)}`}
                hint={`${compactNumber(summary.promptTokens)} prompt · ${compactNumber(summary.completionTokens)} completion`}
                accent="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              />
              <StatCard
                icon={Crown}
                label="Modelo Mais Custoso"
                value={topModel ? topModel.modelName : '—'}
                hint={topModel ? `${money(topModel.totalCost, data.currency)}${usdRate ? ` (${toUsd(topModel.totalCost)})` : ''} · ${topModelShare}% do total` : undefined}
                accent="bg-amber-500/10 text-amber-400 border border-amber-500/20"
              />
            </div>

            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" /> Custo Diário por Modelo
                </h2>
                <p className="text-xs text-slate-500 mt-1">Gasto por dia, empilhado por modelo (datas em UTC).</p>
              </div>
              <DailyCostChart daily={data.daily} byModel={data.byModel} currency={data.currency} />
            </div>

            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-violet-400" /> Extrato de Consumo
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Requisições do período, das mais recentes para as mais antigas.
                </p>
              </div>
              <UsageTable rows={data.recent} colorByModel={colorByModel} currency={data.currency} usdRate={usdRate} />
              {data.pagination.totalRecords > 0 && (
                <Pagination
                  page={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  totalRecords={data.pagination.totalRecords}
                  loading={isLoading}
                  onChange={setCurrentPage}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
