'use client';

import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import axios from 'axios';
import Link from 'next/link';
import { Toaster, toast } from 'sonner';
import { 
  BookOpen, Download, Upload, ArrowLeft, 
  FileText, FolderDown, Sparkles, Database, Trash2, Pencil, X, Save, AlertTriangle, LayoutGrid, List, Calendar, RefreshCw
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const fetcher = (url: string) => axios.get(url).then(res => res.data);

interface KnowledgeItem {
  id?: string;
  module: string;
  section?: string;
  title: string;
  content: string;
  source?: string;
  knowledgeBaseId?: string;
  knowledgeBaseName?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UmblerKnowledgeBase {
  id: string;
  name: string;
  status?: string;
}

function formatDate(rawDate?: string) {
  if (!rawDate) return 'Não informada';
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return 'Não informada';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Não informada';
  }
}

export default function BaseConhecimentoPage() {
  const isAuthorized = useAuth();
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [moduleToDelete, setModuleToDelete] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editKbId, setEditKbId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados de Sincronização
  const [uploadKbId, setUploadKbId] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [syncingModule, setSyncingModule] = useState<string | null>(null);

  const { data: modules = [] } = useSWR<string[]>(`${API_URL}/knowledge/modules`, fetcher);
  const { data: items = [] } = useSWR<KnowledgeItem[]>(`${API_URL}/knowledge`, fetcher);
  const { data: umblerBases = [] } = useSWR<UmblerKnowledgeBase[]>(`${API_URL}/knowledge/umbler-bases`, fetcher);
  const { data: config } = useSWR<{ defaultKnowledgeBaseId?: string }>(`${API_URL}/config`, fetcher);

  const ALLOWED_BASES = [
    "Base Geral de Conhecimento",
    "Consultas de API's",
    "Consultas de API´s",
    "Infos Técnicas",
    "Processo App e Site"
  ];
  
  const activeBases = umblerBases.filter(kb => ALLOWED_BASES.includes(kb.name.trim()));
  const defaultKbId = config?.defaultKnowledgeBaseId || '';

  const kbNameCounts = activeBases.reduce<Record<string, number>>((acc, kb) => {
    acc[kb.name] = (acc[kb.name] || 0) + 1;
    return acc;
  }, {});
  
  const kbLabel = (kb: UmblerKnowledgeBase) =>
    kbNameCounts[kb.name] > 1 ? `${kb.name} (…${kb.id.slice(-6)})` : kb.name;
    
  const kbNameById = (id?: string) => umblerBases.find((kb) => kb.id === id);
  const currentUploadKbId = uploadKbId || defaultKbId;

  const moduleKbId = (moduleName: string) => {
    const moduleItems = items.filter((it) => it.module === moduleName);
    return moduleItems.find((it) => it.knowledgeBaseId)?.knowledgeBaseId || defaultKbId;
  };
  
  const moduleKbName = (moduleName: string) => {
    const kbId = moduleKbId(moduleName);
    return kbNameById(kbId)?.name || items.find((it) => it.module === moduleName)?.knowledgeBaseName || 'Base Geral de Conhecimento';
  };

  const groupedModules = modules.reduce<Record<string, string[]>>((acc, moduleName) => {
    const groupName = moduleKbName(moduleName);
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(moduleName);
    return acc;
  }, {});

  // --- NOVA LÓGICA DE SINCRONIZAÇÃO COM TRATAMENTO DO ERRO 404 ---
  const handleSyncWithUmbler = async (moduleName: string, kbId: string) => {
    setSyncingModule(moduleName);
    const toastId = toast.loading(`Enviando "${moduleName}" para a Umbler...`);

    try {
      await axios.post(`${API_URL}/knowledge/sync-umbler`, {
        moduleName,
        knowledgeBaseId: kbId
      });
      toast.success('Enviado e sincronizado com sucesso!', { id: toastId });
    } catch (error) {
      // Usamos axios.isAxiosError para o TypeScript saber o formato exato do erro sem usar "any"
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        toast.info('Tudo certo! O arquivo já está atualizado na Umbler (nenhuma alteração nova para enviar).', { id: toastId });
      } else {
        toast.error('Erro ao enviar. Verifique os logs do servidor.', { id: toastId });
      }
    } finally {
      setSyncingModule(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('knowledgeBaseId', currentUploadKbId);
    formData.append('knowledgeBaseName', kbNameById(currentUploadKbId)?.name || '');

    setUploading(true);
    try {
      await axios.post(`${API_URL}/knowledge/upload-txt`, formData);
      toast.success('Módulo salvo no sistema com sucesso!');
      mutate(`${API_URL}/knowledge/modules`);
      mutate(`${API_URL}/knowledge`);

      if (autoSync) {
        const generatedModuleName = file.name.replace(/\.[^/.]+$/, "").trim() || 'Módulo Geral';
        handleSyncWithUmbler(generatedModuleName, currentUploadKbId);
      }
    } catch {
      toast.error('Erro ao importar arquivo.');
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

  const handleOpenEditor = (moduleName: string) => {
    const moduleItems = items.filter((item: KnowledgeItem) => item.module === moduleName);
    
    let txtOutput = '';
    let lastSection = '';

    moduleItems.forEach((item: KnowledgeItem) => {
      if (item.source?.includes('raw')) {
        txtOutput += `${item.content}\n`;
        return;
      }

      if (item.section && item.section !== lastSection) {
        txtOutput += `\n## ${item.section}\n`;
        lastSection = item.section;
      }
      txtOutput += `* ${item.title}: ${item.content}\n`;
    });

    setEditText(txtOutput.trim());
    setEditKbId(moduleKbId(moduleName));
    setEditingModule(moduleName);
  };

  const handleSaveEditor = async () => {
    if (!editingModule) return;

    setSavingEdit(true);
    try {
      await axios.put(`${API_URL}/knowledge/module/${encodeURIComponent(editingModule)}`, {
        textContent: editText,
        knowledgeBaseId: editKbId,
        knowledgeBaseName: kbNameById(editKbId)?.name || '',
      });
      toast.success('Arquivo atualizado com sucesso!');
      mutate(`${API_URL}/knowledge/modules`);
      mutate(`${API_URL}/knowledge`);
      
      const currentModule = editingModule;
      setEditingModule(null);

      if (autoSync) {
        handleSyncWithUmbler(currentModule, editKbId);
      }
    } catch {
      toast.error('Erro ao salvar alterações.');
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
      setTimeout(() => { handleDownloadModule(mod); }, index * 400);
    });
    toast.info(`Baixando ${modules.length} arquivos separadamente...`);
  };

  if (!isAuthorized) {
    return <div className="h-screen w-screen bg-slate-950"></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans overflow-x-hidden">
      <Toaster theme="dark" position="top-right" richColors />

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6 w-full gap-4">
          
          {/* Lado Esquerdo - Título */}
          <div className="flex items-center gap-4 min-w-0 pr-2">
            <Link 
              href="/" 
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="truncate">
              <h1 className="text-xl md:text-2xl font-bold text-blue-400 flex items-center gap-2 truncate">
                <BookOpen className="w-6 h-6 shrink-0" /> Central da Base de Conhecimento
              </h1>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1 truncate">
                Gerencie, treine via auditorias e envie os arquivos para a Umbler.
              </p>
            </div>
          </div>

          {/* Lado Direito - Botões */}
          <div className="flex items-center gap-3 shrink-0 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
            
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                title="Visualização em Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide flex items-center gap-1">
                <Database className="w-3 h-3" /> Novo arquivo vai para:
              </span>
              <select
                value={currentUploadKbId}
                onChange={(e) => setUploadKbId(e.target.value)}
                className="bg-slate-900 border border-blue-500/40 rounded-xl px-3 py-1.5 text-xs font-medium text-blue-300 outline-none cursor-pointer w-[220px]"
              >
                <option value="" disabled className="bg-slate-900 text-slate-500">Selecione uma base...</option>
                {activeBases.map((kb) => (
                  <option key={kb.id} value={kb.id} className="bg-slate-900 text-slate-200 truncate">
                    {kbLabel(kb)}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex flex-col gap-1 cursor-pointer group shrink-0">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${autoSync ? 'text-emerald-400' : 'text-slate-500'}`} /> Envio Auto
              </span>
              <div className="relative inline-flex items-center">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={autoSync}
                  onChange={() => setAutoSync(!autoSync)} 
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 border border-slate-700"></div>
              </div>
            </label>

            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-blue-600/20 transition-all shrink-0">
              <Upload className="w-4 h-4" />
              {uploading ? 'Importando...' : 'Subir'}
              <input
                type="file"
                accept=".txt,.json,.yaml,.yml"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            <button
              onClick={handleDownloadAllIndividual}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer shrink-0"
            >
              <FolderDown className="w-4 h-4 text-emerald-400" />
              Baixar Todos
            </button>
          </div>
        </div>

        {modules.length === 0 ? (
          <div className="text-center p-12 bg-slate-900/40 rounded-3xl border border-slate-800/80 space-y-3">
            <Database className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 font-medium text-sm">Nenhum módulo cadastrado na base.</p>
            <p className="text-slate-500 text-xs">Suba um arquivo acima para começar.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="space-y-8">
            {Object.entries(groupedModules)
              .sort(([kbNameA], [kbNameB]) => kbNameA.localeCompare(kbNameB))
              .map(([kbName, moduleNames]) => {
                const sortedModules = [...moduleNames].sort((a, b) => a.localeCompare(b));

                return (
                  <div key={kbName}>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-3">
                      <Database className="w-4 h-4 text-blue-400" /> {kbName}
                      <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">{sortedModules.length}</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {sortedModules.map((moduleName, i) => {
                        const moduleItems = items.filter((item: KnowledgeItem) => item.module === moduleName);
                        const createdAt = moduleItems[0]?.createdAt;
                        const updatedAt = moduleItems[0]?.updatedAt;
                        const isModified = createdAt && updatedAt && new Date(updatedAt).getTime() > new Date(createdAt).getTime() + 1000;
                        const previewText = moduleItems.length > 0 ? moduleItems.map((i: KnowledgeItem) => i.content).join(' ').substring(0, 150) + '...' : 'Sem conteúdo.';
                        const currentKbId = moduleKbId(moduleName);

                        return (
                          <div
                            key={i}
                            className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
                          >
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <span className="p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
                                  <FileText className="w-5 h-5" />
                                </span>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono bg-slate-800 px-2.5 py-1 rounded-full text-slate-400 mr-1">
                                    {moduleItems.length} tópico(s)
                                  </span>

                                  <button
                                    onClick={() => handleOpenEditor(moduleName)}
                                    title="Editar conteúdo"
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

                              <h3 className="font-bold text-base text-slate-100 mb-1">{moduleName}</h3>

                              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mb-3">
                                <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                {isModified ? (
                                  <span>Modificado: <strong className="text-slate-200">{formatDate(updatedAt)}</strong></span>
                                ) : (
                                  <span>Importado: <strong className="text-slate-200">{formatDate(createdAt)}</strong></span>
                                )}
                              </div>

                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed" title={previewText}>
                                {previewText}
                              </p>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-between items-center">
                              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                <Sparkles className="w-3 h-3 text-amber-400" /> Pronto p/ Umbler
                              </span>

                              <div className="flex gap-2">
                                {!autoSync && (
                                  <button
                                    onClick={() => handleSyncWithUmbler(moduleName, currentKbId)}
                                    disabled={syncingModule === moduleName}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 ${syncingModule === moduleName ? 'animate-spin' : ''}`} /> 
                                    {syncingModule === moduleName ? 'Enviando...' : 'Enviar'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDownloadModule(moduleName)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" /> Baixar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
            })}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedModules)
              .sort(([kbNameA], [kbNameB]) => kbNameA.localeCompare(kbNameB))
              .map(([kbName, moduleNames]) => {
                const sortedModules = [...moduleNames].sort((a, b) => a.localeCompare(b));

                return (
                  <div key={kbName}>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-3">
                      <Database className="w-4 h-4 text-blue-400" /> {kbName}
                      <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">{sortedModules.length}</span>
                    </h2>
                    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-800/80">
                      {sortedModules.map((moduleName, i) => {
                        const moduleItems = items.filter((item: KnowledgeItem) => item.module === moduleName);
                        const createdAt = moduleItems[0]?.createdAt;
                        const updatedAt = moduleItems[0]?.updatedAt;
                        const isModified = createdAt && updatedAt && new Date(updatedAt).getTime() > new Date(createdAt).getTime() + 1000;
                        const previewText = moduleItems.length > 0 ? moduleItems.map((i: KnowledgeItem) => i.content).join(' ').substring(0, 150) + '...' : 'Sem conteúdo.';
                        const currentKbId = moduleKbId(moduleName);

                        return (
                          <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-900/80 transition-all gap-4">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              <span className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 shrink-0">
                                <FileText className="w-4 h-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-sm text-slate-100 truncate">{moduleName}</h3>
                                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
                                  <span>{moduleItems.length} tópico(s)</span>
                                  <span>•</span>
                                  {isModified ? (
                                    <span>Modificado: <strong className="text-slate-200">{formatDate(updatedAt)}</strong></span>
                                  ) : (
                                    <span>Importado: <strong className="text-slate-200">{formatDate(createdAt)}</strong></span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 truncate max-w-lg" title={previewText}>
                                  {previewText}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {!autoSync && (
                                <button
                                  onClick={() => handleSyncWithUmbler(moduleName, currentKbId)}
                                  disabled={syncingModule === moduleName}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                                  title="Enviar p/ Umbler"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${syncingModule === moduleName ? 'animate-spin' : ''}`} /> 
                                  {syncingModule === moduleName ? 'Enviando...' : 'Enviar'}
                                </button>
                              )}

                              <button
                                onClick={() => handleDownloadModule(moduleName)}
                                className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all cursor-pointer"
                                title="Baixar .TXT"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEditor(moduleName)}
                                title="Editar conteúdo"
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
                        );
                      })}
                    </div>
                  </div>
                );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
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

            <div className="px-6 pt-4">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider font-mono">
                <Database className="w-3.5 h-3.5 text-blue-400" /> Este arquivo pertence à base:
              </label>
              <select
                value={editKbId}
                onChange={(e) => setEditKbId(e.target.value)}
                className="w-full bg-slate-900 border border-blue-500/40 rounded-xl px-3 py-2 text-xs font-medium text-blue-300 outline-none cursor-pointer"
              >
                {activeBases.map((kb) => (
                  <option key={kb.id} value={kb.id} className="bg-slate-900 text-slate-200">
                    {kbLabel(kb)}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Trocar aqui e salvar move o arquivo de base na Umbler (remove da antiga, cria na nova).
              </p>
            </div>

            <div className="flex-1 p-6 bg-slate-950 flex flex-col">
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider font-mono">
                Conteúdo Bruto
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
                Salva instantaneamente e mantém o controle de versão da data
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