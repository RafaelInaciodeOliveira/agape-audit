'use client';

import useSWR from 'swr';
import { Star, RefreshCw, Clock, Sparkles, CheckSquare, ShieldCheck, Activity, AlertTriangle } from 'lucide-react';
import { API_URL, apiErrorMessage, fetcher } from '../../lib/api';

function getGreeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function DashboardPlaceholder({ failed }: { failed: boolean }) {
  return failed
    ? <span className="text-slate-600" title="Não foi possível carregar">—</span>
    : <RefreshCw className="w-5 h-5 animate-spin text-slate-600 my-2" />;
}

// Resumo do dia exibido uma vez por dia ao abrir a tela principal.
export function WelcomeModal({ onClose }: { onClose: () => void }) {
  const { data: dashboardData, error: dashboardError, isValidating: loadingDashboard, mutate: retryDashboard } =
    useSWR(`${API_URL}/dashboard`, fetcher, { shouldRetryOnError: false });

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-4xl w-full shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-5 shadow-inner">
          <ShieldCheck className="w-8 h-8 text-blue-400" />
        </div>

        <h2 className="text-2xl md:text-3xl font-black text-slate-100 mb-2">Resumo da Operação Diária</h2>
        <p className="text-slate-400 mb-8 text-center max-w-lg text-sm">
          {getGreeting()}! Antes de iniciar as auditorias, confira como está a saúde do sistema e do Ágape hoje.
        </p>

        {dashboardError && !dashboardData && (
          <div role="alert" className="w-full mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl px-4 py-3 text-sm">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {apiErrorMessage(dashboardError, 'Não foi possível carregar o resumo do dia.')}
            </span>
            <button
              onClick={() => retryDashboard()}
              disabled={loadingDashboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDashboard ? 'animate-spin' : ''}`} /> Tentar novamente
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-8">
          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center hover:border-slate-700 transition-colors">
            <Clock className="w-6 h-6 text-amber-400 mb-3" />
            <span className="text-3xl font-black text-slate-100">
              {dashboardData ? dashboardData.pendingChats : <DashboardPlaceholder failed={!!dashboardError} />}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Chats Pendentes</span>
          </div>

          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center hover:border-slate-700 transition-colors">
            <Sparkles className="w-6 h-6 text-emerald-400 mb-3" />
            <span className="text-3xl font-black text-slate-100">
              {dashboardData ? dashboardData.newStrapiRules : <DashboardPlaceholder failed={!!dashboardError} />}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Novas Regras (24h)</span>
          </div>

          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center hover:border-slate-700 transition-colors">
            <CheckSquare className="w-6 h-6 text-blue-400 mb-3" />
            <span className="text-3xl font-black text-slate-100">
              {dashboardData ? dashboardData.auditsThisWeek : <DashboardPlaceholder failed={!!dashboardError} />}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Auditorias (Semana)</span>
          </div>

          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center hover:border-slate-700 transition-colors">
            <Star className="w-6 h-6 text-amber-400 mb-3" />
            <span className="text-3xl font-black text-slate-100">
              {dashboardData ? dashboardData.weeklyAvgRating : <DashboardPlaceholder failed={!!dashboardError} />}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Nota Média (Semana)</span>
          </div>
        </div>

        <button 
          onClick={() => {
            const today = new Date().toLocaleDateString('pt-BR');
            localStorage.setItem('agape_welcome_seen', today);
            onClose();
          }} 
          className="bg-blue-600 hover:bg-blue-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-600/30 active:scale-95 text-white font-bold py-3 px-10 rounded-xl transition-all duration-300 ease-out cursor-pointer flex items-center gap-2"
        >
          <Activity className="w-4 h-4" /> Iniciar Auditorias
        </button>
      </div>
    </div>
  );
}
