'use client';

import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import axios from 'axios';
import Link from 'next/link';
import { Toaster, toast } from 'sonner';
import { 
  BookOpen, Download, Upload, ArrowLeft, 
  FileText, FolderDown, Sparkles, Database, Trash2, Pencil, X, Save, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function BaseConhecimentoPage() {
  const isAuthorized = useAuth();
  const [uploading, setUploading] = useState(false);

  // Estados para exclusão
  const [moduleToDelete, setModuleToDelete] = useState<string | null>(null);

  // Estados para edição do TXT
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const { data: modules = [] } = useSWR<string[]>(`${API_URL}/knowledge/modules`, fetcher);
  const { data: items = [] } = useSWR(`${API_URL}/knowledge`, fetcher);

  if (!isAuthorized) {
    return <div className="h-screen w-screen bg-slate-950"></div>;
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await axios.post(`${API_URL}/knowledge/upload-txt`, formData);
      toast.success('Módulo importado com sucesso!');
      mutate(`${API_URL}/knowledge/modules`);
      mutate(`${API_URL}/knowledge`);
    } catch {
      toast.error('Erro ao importar arquivo .txt');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadModule = (moduleName: string) => {
    const url = `${API_URL}/knowledge/export-txt?moduleName=${encodeURIComponent(moduleName)}`;
    window.open(url, '_blank');
  };

  const confirmDeleteModule = async () => {
    if (!moduleToDelete) return;

    try {
      await axios.delete(`${API_URL}/knowledge/module/${encodeURIComponent(moduleToDelete)}`);
      toast.success(`Módulo "${moduleToDelete}" excluído!`);
      mutate(`${API_URL}/knowledge/modules`);
      mutate(`${API_URL}/knowledge`);
    } catch {
      toast.error('Erro ao excluir módulo.');
    } finally {
      setModuleToDelete(null);
    }
  };

  // Abrir editor com o texto montado no formato .txt
  const handleOpenEditor = (moduleName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const moduleItems = items.filter((item: any) => item.module === moduleName);
    
    let txtOutput = `${moduleName}\n\n`;
    let lastSection = '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    moduleItems.forEach((item: any) => {
      if (item.section && item.section !== lastSection) {
        txtOutput += `\n## ${item.section}\n`;
        lastSection = item.section;
      }
      txtOutput += `* ${item.title}: ${item.content}\n`;
    });

    setEditText(txtOutput);
    setEditingModule(moduleName);
  };

  // Salvar alterações manuais do TXT
  const handleSaveEditor = async () => {
    if (!editingModule) return;

    setSavingEdit(true);
    try {
      await axios.put(`${API_URL}/knowledge/module/${encodeURIComponent(editingModule)}`, {
        textContent: editText
      });
      toast.success('Arquivo .txt atualizado com sucesso!');
      mutate(`${API_URL}/knowledge/modules`);
      mutate(`${API_URL}/knowledge`);
      setEditingModule(null);
    } catch {
      toast.error('Erro ao salvar alterações do .txt');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDownloadAllIndividual = () => {
    if (modules.length === 0) {
      toast.error('Nenhum módulo disponível para download.');
      return;
    }

    modules.forEach((mod, index) => {
      setTimeout(() => {
        handleDownloadModule(mod);
      }, index * 400);
    });

    toast.info(`Baixando ${modules.length} arquivos .txt separadamente...`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <Toaster theme="dark" position="top-right" richColors />

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
                <BookOpen className="w-6 h-6" /> Central da Base de Conhecimento
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Gerencie, treine via auditorias e baixe os arquivos .txt prontos para a Umbler.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-blue-600/20 transition-all">
              <Upload className="w-4 h-4" />
              {uploading ? 'Importando...' : 'Subir Novo .TXT'}
              <input 
                type="file" 
                accept=".txt" 
                onChange={handleFileUpload} 
                disabled={uploading}
                className="hidden" 
              />
            </label>

            <button
              onClick={handleDownloadAllIndividual}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
            >
              <FolderDown className="w-4 h-4 text-emerald-400" />
              Baixar Todos (.TXTs Individuais)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.length === 0 ? (
            <div className="col-span-2 text-center p-12 bg-slate-900/40 rounded-3xl border border-slate-800/80 space-y-3">
              <Database className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-slate-400 font-medium text-sm">Nenhum módulo cadastrado na base.</p>
              <p className="text-slate-500 text-xs">Suba um arquivo .txt acima para começar.</p>
            </div>
          ) : (
            modules.map((moduleName, i) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const moduleItems = items.filter((item: any) => item.module === moduleName);

              return (
                <div 
                  key={i} 
                  className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
                        <FileText className="w-5 h-5" />
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono bg-slate-800 px-2.5 py-1 rounded-full text-slate-400 mr-1">
                          {moduleItems.length} tópicos
                        </span>

                        <button
                          onClick={() => handleOpenEditor(moduleName)}
                          title="Editar conteúdo do .txt"
                          className="p-2 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setModuleToDelete(moduleName)}
                          title="Excluir este módulo"
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-bold text-base text-slate-100 mb-2">{moduleName}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      Procedimentos e treinos de auditoria associados a este módulo.
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                      <Sparkles className="w-3 h-3 text-amber-400" /> Pronto para Umbler
                    </span>

                    <button
                      onClick={() => handleDownloadModule(moduleName)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar .TXT
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL BONITO DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {moduleToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Excluir Módulo</h3>
                <p className="text-xs text-slate-400">Ação irreversível no banco de dados</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800 font-medium">
              Tem certeza que deseja excluir o <strong className="text-white">&quot;{moduleToDelete}&quot;</strong> e todos os seus tópicos associados?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModuleToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteModule}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition-all cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DIRETA DO .TXT */}
      {editingModule && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-slate-100">
                  <Pencil className="w-5 h-5 text-blue-400" /> Editor da Base de Conhecimento
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Módulo: <span className="text-blue-300 font-semibold">{editingModule}</span></p>
              </div>

              <button
                onClick={() => setEditingModule(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 bg-slate-950 flex flex-col">
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider font-mono">
                Conteúdo Bruto (.TXT)
              </label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="flex-1 w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 text-sm text-slate-200 font-mono leading-relaxed outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all custom-scrollbar resize-none"
                placeholder="Edite o arquivo aqui..."
              />
            </div>

            <div className="p-5 border-t border-slate-800 flex justify-between items-center bg-slate-900/50">
              <span className="text-xs text-slate-500 font-mono">
                Respeite o formato `## Seção` e `* Título: Conteúdo`
              </span>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingModule(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEditor}
                  disabled={savingEdit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}