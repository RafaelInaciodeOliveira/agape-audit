'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ArrowRight, Activity, Sparkles } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem('agape_audit_token');
    if (token) router.push('/');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        toast.success('Acesso liberado! Bem-vindo(a).');
        
        sessionStorage.setItem('agape_audit_token', 'autenticado');
        
        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        sessionStorage.setItem('agape_audit_expires', endOfDay.toString());

        router.push('/');
      } else {
        toast.error('Usuário ou senha incorretos.');
        setIsLoading(false);
      }
    } catch {
      toast.error('Erro ao conectar com o servidor.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden font-sans selection:bg-blue-500/30">
      <Toaster theme="dark" position="top-center" richColors />
      
      {/* 1. FUNDO "TEASER" (SISTEMA FAKE) - AGORA MAIS CLARO */}
      <div className="absolute inset-0 z-0 flex pointer-events-none select-none">
        {/* Fake Sidebar */}
        <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/80">
          <div className="h-20 border-b border-slate-800 p-5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/40" />
            <div className="h-4 w-32 bg-slate-700 rounded-md" />
          </div>
          <div className="p-4">
            <div className="h-10 w-full bg-slate-800 rounded-xl" />
          </div>
          <div className="flex-1 flex flex-col gap-2 p-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-4 flex items-center gap-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="w-10 h-10 rounded-full bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="flex justify-between">
                    <div className="h-3 w-24 bg-slate-600 rounded" />
                    <div className="h-2 w-8 bg-slate-700 rounded" />
                  </div>
                  <div className="h-2 w-full bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Fake Main Area */}
        <div className="flex-1 flex flex-col bg-slate-950">
          <div className="h-20 border-b border-slate-800 p-6 flex justify-between items-center bg-slate-900/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-800" />
              <div className="space-y-2">
                <div className="h-4 w-40 bg-slate-700 rounded" />
                <div className="flex gap-2">
                  <div className="h-3 w-16 bg-slate-700 rounded-full" />
                  <div className="h-3 w-12 bg-slate-700 rounded-full" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-24 bg-slate-800 rounded-xl" />
              <div className="h-10 w-32 bg-blue-600/40 rounded-xl" />
            </div>
          </div>
          
          <div className="flex-1 p-10 space-y-8">
            <div className="flex justify-end">
              <div className="w-1/3 h-24 bg-blue-600/30 border border-blue-500/30 rounded-3xl rounded-br-none" />
            </div>
            <div className="flex justify-start">
              <div className="w-2/5 h-32 bg-slate-800 border border-slate-700 rounded-3xl rounded-bl-none" />
            </div>
            <div className="flex justify-end">
              <div className="w-1/4 h-16 bg-blue-600/30 border border-blue-500/30 rounded-3xl rounded-br-none" />
            </div>
            <div className="flex justify-start">
              <div className="w-1/2 h-40 bg-slate-800 border border-slate-700 rounded-3xl rounded-bl-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. OVERLAY DE VIDRO FOSCO E BRILHOS */}
      <div className="absolute inset-0 z-0 bg-slate-950/40 backdrop-blur-[8px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* 3. CAIXA DE LOGIN CENTRAL COM TUDO DENTRO */}
      <div className="w-full max-w-md p-6 relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 sm:p-10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          
          {/* LOGO E TÍTULO */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-slate-950/50 border border-slate-800/80 rounded-2xl flex items-center justify-center shadow-inner mb-4 relative group">
              <div className="absolute inset-0 bg-white/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              {/* Puxando o favicon diretamente */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/favicon.ico" alt="Ágape" className="w-8 h-8 object-contain drop-shadow-lg" />
              <Sparkles className="w-4 h-4 text-purple-400 absolute -top-1.5 -right-1.5 animate-pulse opacity-70" />
            </div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">Auditoria Ágape</h1>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">Acesso restrito para Auditores</p>
          </div>

          {/* FORMULÁRIO */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Usuário</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-slate-950/80 border border-slate-700 text-slate-100 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 text-sm" placeholder="Digite seu usuário..." required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950/80 border border-slate-700 text-slate-100 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 text-sm" placeholder="••••••••" required />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-3.5 mt-2 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group text-sm">
              {isLoading ? <><Activity className="w-5 h-5 animate-spin" /> Autenticando...</> : <>Entrar no Sistema <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}