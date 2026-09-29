'use client';

import { CheckSquare, X, Tag, Plus, Trash2, Pencil, Settings, ListX } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import type { FailReason, Subtopic, Topic } from '../../lib/types';
import { API_URL, apiErrorMessage } from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  topics: Topic[];
  failReasons: FailReason[];
  mutateTopics: () => unknown;
  mutateFailReasons: () => unknown;
}

// Modal de Configurações: CRUD de temas/subtemas e motivos de erro.
// Fica sempre montado (retorna null quando fechado) para manter aba e rascunhos entre aberturas.
export function SettingsModal({ open, onClose, topics, failReasons, mutateTopics, mutateFailReasons }: Props) {
  const [settingsTab, setSettingsTab] = useState<'topics' | 'reasons'>('topics');

  const [newTopicName, setNewTopicName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState('');
  const [addingSubtopicTo, setAddingSubtopicTo] = useState<string | null>(null);
  const [newSubtopicName, setNewSubtopicName] = useState('');
  const [editingSubtopicId, setEditingSubtopicId] = useState<string | null>(null);
  const [editingSubtopicName, setEditingSubtopicName] = useState('');

  const [newReasonName, setNewReasonName] = useState('');
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [editingReasonName, setEditingReasonName] = useState('');

  // Executa uma ação de configuração com toast de sucesso/erro; devolve true se deu certo.
  const runAction = async (action: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await action();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err, failure));
      return false;
    }
  };

  const handleAddTopic = async () => {
    const name = newTopicName.trim();
    if (!name) return;
    if (await runAction(() => axios.post(`${API_URL}/topics`, { name }), `Tema "${name}" criado.`, 'Erro ao criar o tema.')) setNewTopicName('');
    mutateTopics();
  };
  const handleRenameTopic = async (id: string) => {
    const name = editingTopicName.trim();
    if (!name) return;
    if (await runAction(() => axios.put(`${API_URL}/topics/${id}`, { name }), 'Tema renomeado.', 'Erro ao renomear o tema.')) setEditingTopicId(null);
    mutateTopics();
  };
  const handleDeleteTopic = async (id: string) => {
    if (!confirm('Excluir este tópico e seus subtópicos?')) return;
    await runAction(() => axios.delete(`${API_URL}/topics/${id}`), 'Tema excluído.', 'Erro ao excluir o tema.');
    mutateTopics();
  };
  const handleAddSubtopic = async (topicId: string) => {
    const name = newSubtopicName.trim();
    if (!name) return;
    if (await runAction(() => axios.post(`${API_URL}/topics/${topicId}/subtopics`, { name }), `Subtema "${name}" criado.`, 'Erro ao criar o subtema.')) {
      setNewSubtopicName('');
      setAddingSubtopicTo(null);
    }
    mutateTopics();
  };
  const handleRenameSubtopic = async (id: string) => {
    const name = editingSubtopicName.trim();
    if (!name) return;
    if (await runAction(() => axios.put(`${API_URL}/subtopics/${id}`, { name }), 'Subtema renomeado.', 'Erro ao renomear o subtema.')) setEditingSubtopicId(null);
    mutateTopics();
  };
  const handleDeleteSubtopic = async (id: string) => {
    if (!confirm('Excluir este subtópico?')) return;
    await runAction(() => axios.delete(`${API_URL}/subtopics/${id}`), 'Subtema excluído.', 'Erro ao excluir o subtema.');
    mutateTopics();
  };

  const handleAddReason = async () => {
    const name = newReasonName.trim();
    if (!name) return;
    if (await runAction(() => axios.post(`${API_URL}/fail-reasons`, { name }), `Motivo "${name}" criado.`, 'Erro ao criar o motivo.')) setNewReasonName('');
    mutateFailReasons();
  };
  const handleRenameReason = async (id: string) => {
    const name = editingReasonName.trim();
    if (!name) return;
    if (await runAction(() => axios.put(`${API_URL}/fail-reasons/${id}`, { name }), 'Motivo renomeado.', 'Erro ao renomear o motivo.')) setEditingReasonId(null);
    mutateFailReasons();
  };
  const handleDeleteReason = async (id: string) => {
    if (!confirm('Excluir este motivo de erro permanentemente?')) return;
    await runAction(() => axios.delete(`${API_URL}/fail-reasons/${id}`), 'Motivo excluído.', 'Erro ao excluir o motivo.');
    mutateFailReasons();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-slate-950 border border-slate-700 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-base font-black flex items-center gap-2 text-slate-100">
            <Settings className="w-5 h-5 text-blue-400" /> Configurações Gerais
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:scale-90 transition-all duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex bg-slate-900 border-b border-slate-800 p-2">
          <button 
            onClick={() => setSettingsTab('topics')} 
            className={`flex-1 py-2 text-xs font-bold text-center rounded-xl active:scale-95 transition-all duration-200 cursor-pointer ${settingsTab === 'topics' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
          >
            <Tag className="w-4 h-4 inline-block mr-1.5" /> Temas e Subtópicos
          </button>
          <button 
            onClick={() => setSettingsTab('reasons')} 
            className={`flex-1 py-2 text-xs font-bold text-center rounded-xl active:scale-95 transition-all duration-200 cursor-pointer ${settingsTab === 'reasons' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
          >
            <ListX className="w-4 h-4 inline-block mr-1.5" /> Motivos de Erro
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {settingsTab === 'topics' && (
            <>
              {topics.map((t: Topic) => (
                <div key={t.id} className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    {editingTopicId === t.id ? (
                      <input autoFocus value={editingTopicName} onChange={(e) => setEditingTopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameTopic(t.id)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-bold text-slate-100 outline-none focus:border-blue-500" />
                    ) : (
                      <span className="text-sm font-bold text-slate-200">{t.name}</span>
                    )}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setAddingSubtopicTo(addingSubtopicTo === t.id ? null : t.id)} className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg cursor-pointer"><Plus className="w-4 h-4" /></button>
                      {editingTopicId === t.id ? (
                        <button onClick={() => handleRenameTopic(t.id)} className="p-1.5 text-emerald-400 hover:bg-slate-800 rounded-lg cursor-pointer"><CheckSquare className="w-4 h-4" /></button>
                      ) : (
                        <button onClick={() => { setEditingTopicId(t.id); setEditingTopicName(t.name); }} className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg cursor-pointer"><Pencil className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => handleDeleteTopic(t.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {(t.subtopics || []).length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-slate-800 space-y-2">
                      {t.subtopics?.map((s: Subtopic) => (
                        <div key={s.id} className="flex items-center justify-between gap-3">
                          {editingSubtopicId === s.id ? (
                            <input autoFocus value={editingSubtopicName} onChange={(e) => setEditingSubtopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameSubtopic(s.id)} className="flex-1 bg-slate-950 border border-slate-700 rounded-md p-1.5 text-xs font-bold text-slate-200 outline-none focus:border-blue-500" />
                          ) : (
                            <span className="text-xs font-bold text-slate-400">{s.name}</span>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            {editingSubtopicId === s.id ? (
                              <button onClick={() => handleRenameSubtopic(s.id)} className="p-1 text-emerald-400 hover:bg-slate-800 rounded-md cursor-pointer"><CheckSquare className="w-3.5 h-3.5" /></button>
                            ) : (
                              <button onClick={() => { setEditingSubtopicId(s.id); setEditingSubtopicName(s.name); }} className="p-1 text-slate-500 hover:text-blue-300 hover:bg-slate-800 rounded-md cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                            )}
                            <button onClick={() => handleDeleteSubtopic(s.id)} className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-md cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingSubtopicTo === t.id && (
                    <div className="mt-3 pl-4 flex items-center gap-2">
                      <input autoFocus value={newSubtopicName} onChange={(e) => setNewSubtopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSubtopic(t.id)} placeholder="Nome do subtópico" className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500" />
                      <button onClick={() => handleAddSubtopic(t.id)} className="p-1.5 text-blue-400 hover:bg-slate-800 rounded-lg cursor-pointer"><Plus className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {settingsTab === 'reasons' && (
            <>
              <p className="text-xs text-slate-400 mb-2">Crie as opções de erro que os auditores poderão marcar durante a avaliação de uma resposta ou do chat inteiro.</p>
              {failReasons.map((r: FailReason) => (
                <div key={r.id} className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-3">
                  {editingReasonId === r.id ? (
                    <input autoFocus value={editingReasonName} onChange={(e) => setEditingReasonName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameReason(r.id)} className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-bold text-slate-100 outline-none focus:border-blue-500" />
                  ) : (
                    <span className="text-sm font-bold text-slate-200">{r.name}</span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    {editingReasonId === r.id ? (
                      <button onClick={() => handleRenameReason(r.id)} className="p-1.5 text-emerald-400 hover:bg-slate-800 rounded-lg cursor-pointer"><CheckSquare className="w-4 h-4" /></button>
                    ) : (
                      <button onClick={() => { setEditingReasonId(r.id); setEditingReasonName(r.name); }} className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg cursor-pointer"><Pencil className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => handleDeleteReason(r.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 flex items-center gap-3 bg-slate-900/50">
          {settingsTab === 'topics' ? (
            <>
              <input value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()} placeholder="Adicionar novo tópico principal..." className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-200 outline-none focus:border-blue-500" />
              <button onClick={handleAddTopic} className="p-3 bg-blue-600 hover:bg-blue-500 hover:-translate-y-0.5 active:scale-95 rounded-xl text-white cursor-pointer transition-all duration-200 shadow-sm shadow-blue-600/20"><Plus className="w-5 h-5" /></button>
            </>
          ) : (
            <>
              <input value={newReasonName} onChange={(e) => setNewReasonName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddReason()} placeholder="Novo motivo de erro..." className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-200 outline-none focus:border-blue-500" />
              <button onClick={handleAddReason} className="p-3 bg-blue-600 hover:bg-blue-500 hover:-translate-y-0.5 active:scale-95 rounded-xl text-white cursor-pointer transition-all duration-200 shadow-sm shadow-blue-600/20"><Plus className="w-5 h-5" /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
