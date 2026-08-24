'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, User, ArrowRight, Activity, Sparkles } from 'lucide-react';
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
        
        // 1. Salva o token temporário (morre ao fechar a aba)
        sessionStorage.setItem('agape_audit_token', 'autenticado');
        
        // 2. Calcula as 23:59:59 de hoje
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
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative group">
            <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <ShieldCheck className="w-8 h-8 text-white" />
            <Sparkles className="w-4 h-4 text-blue-200 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-slate-100 tracking-tight">Ágape Auditoria</h1>
          <p className="text-sm text-slate-400 mt-2 font-medium">Acesso restrito para Auditores</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Usuário</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-slate-950/50 border border-slate-800 text-slate-100 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600" placeholder="Digite seu usuário..." required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950/50 border border-slate-800 text-slate-100 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600" placeholder="••••••••" required />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-3.5 mt-4 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group">
              {isLoading ? <><Activity className="w-5 h-5 animate-spin" /> Autenticando...</> : <>Entrar no Sistema <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}