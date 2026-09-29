'use client';

import React, { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, ChevronsUpDown, Clock, FileText, History, RefreshCw, Trash2, X } from 'lucide-react';
import { buildDiffRows, type DiffLineRow } from './diffRows';
import { apiErrorMessage, fetcher } from '../lib/api';

export interface BackupSummary {
  id: string;
  module: string;
  createdAt: string;
  reason: 'edit' | 'upload';
  size: number;
}

interface BackupPage {
  items: BackupSummary[];
  nextCursor: { beforeCreatedAt: string; beforeId: string } | null;
}

interface BackupDetail extends BackupSummary {
  content: string;
}

interface Props {
  apiUrl: string;
  moduleName: string;
  onClose: () => void;
  onRestore: (content: string) => void;
}

const PAGE_SIZE = 20;
const CURRENT = 'current';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: 'Data inválida', time: '' };
  return { date: d.toLocaleDateString('pt-BR'), time: d.toLocaleTimeString('pt-BR') };
}

function formatSize(chars: number) {
  return chars >= 1000 ? `${(chars / 1000).toFixed(1)} mil caracteres` : `${chars} caracteres`;
}

function versionLabel(b?: BackupSummary) {
  if (!b) return 'versão selecionada';
  const { date, time } = formatDateTime(b.createdAt);
  return `backup de ${date} ${time}`;
}

function DiffLine({ row }: { row: DiffLineRow }) {
  const tone =
    row.kind === 'added' ? 'bg-emerald-500/10 text-emerald-200' :
    row.kind === 'removed' ? 'bg-red-500/10 text-red-200' :
    'text-slate-400 hover:bg-slate-800/50';
  const mark = row.kind === 'added' ? 'bg-emerald-500/40 text-emerald-50' : 'bg-red-500/40 text-red-50';
  return (
    <div className={`flex items-start ${tone}`}>
      <span className="select-none shrink-0 w-10 text-right pr-2 text-[10px] leading-6 text-slate-600">{row.oldNumber ?? ''}</span>
      <span className="select-none shrink-0 w-10 text-right pr-2 text-[10px] leading-6 text-slate-600 border-r border-slate-800">{row.newNumber ?? ''}</span>
      <span className={`select-none shrink-0 w-6 text-center font-black leading-6 ${
        row.kind === 'added' ? 'text-emerald-500' : row.kind === 'removed' ? 'text-red-500' : 'text-slate-700'
      }`}>
        {row.kind === 'added' ? '+' : row.kind === 'removed' ? '-' : ' '}
      </span>
      <span className="whitespace-pre-wrap break-words leading-6 pr-4 min-w-0 flex-1">
        {row.segments.length === 1 && row.segments[0].text === ''
          ? ' '
          : row.segments.map((seg, i) =>
              seg.highlight ? <mark key={i} className={`${mark} rounded-sm`}>{seg.text}</mark> : <React.Fragment key={i}>{seg.text}</React.Fragment>
            )}
      </span>
    </div>
  );
}

export default function BackupHistoryModal({ apiUrl, moduleName, onClose, onRestore }: Props) {
  const moduleUrl = `${apiUrl}/knowledge/module/${encodeURIComponent(moduleName)}`;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string>(CURRENT);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const getKey = (index: number, previous: BackupPage | null) => {
    if (previous && !previous.nextCursor) return null;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (index > 0 && previous?.nextCursor) {
      params.set('beforeCreatedAt', previous.nextCursor.beforeCreatedAt);
      params.set('beforeId', previous.nextCursor.beforeId);
    }
    return `${moduleUrl}/backups?${params.toString()}`;
  };

  const { data: pages, error: listError, size, setSize, isLoading: loadingList, isValidating, mutate: mutateList } =
    useSWRInfinite<BackupPage>(getKey, fetcher, { revalidateFirstPage: false });

  const backups = useMemo(() => pages?.flatMap(p => p.items) ?? [], [pages]);
  const hasMore = !!pages?.[pages.length - 1]?.nextCursor;
  const loadingMore = isValidating && !!pages && size > pages.length;

  const { data: current, error: currentError } = useSWR<{ content: string; itemCount: number }>(`${moduleUrl}/current-text`, fetcher);
  const { data: selected, error: selectedError, isLoading: loadingSelected } =
    useSWR<BackupDetail>(selectedId ? `${apiUrl}/knowledge/backups/${selectedId}` : null, fetcher);
  const { data: baseBackup, error: baseError } =
    useSWR<BackupDetail>(baseId !== CURRENT ? `${apiUrl}/knowledge/backups/${baseId}` : null, fetcher);

  const baseText = baseId === CURRENT ? current?.content : baseBackup?.content;
  const selectedSummary = backups.find(b => b.id === selectedId);
  const baseSummary = backups.find(b => b.id === baseId);

  const diff = useMemo(() => {
    if (baseText === undefined || !selected) return null;
    return buildDiffRows(baseText, selected.content, !showAll);
  }, [baseText, selected, showAll]);

  // Trechos expandidos valem só para o par de versões comparado no momento.
  const diffKey = `${selectedId}|${baseId}|${showAll}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmDeleteId) setConfirmDeleteId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDeleteId, onClose]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (id === baseId) setBaseId(CURRENT);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await axios.delete(`${apiUrl}/knowledge/backups/${confirmDeleteId}`);
      toast.success('Backup apagado com sucesso!');
      if (selectedId === confirmDeleteId) setSelectedId(null);
      if (baseId === confirmDeleteId) setBaseId(CURRENT);
      await mutateList(
        prev => prev?.map(p => ({ ...p, items: p.items.filter(b => b.id !== confirmDeleteId) })),
        { revalidate: false }
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Erro ao apagar o backup.'));
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const comparingWithCurrent = baseId === CURRENT;
  const loadingDiff = loadingSelected || (baseText === undefined && !currentError && !baseError);
  const diffError = selectedError || (comparingWithCurrent ? currentError : baseError);

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6" onClick={onClose}>
        <div
          className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`Histórico de versões de ${moduleName}`}
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
            <div className="min-w-0">
              <h3 className="text-base font-bold flex items-center gap-2 text-slate-100">
                <History className="w-5 h-5 text-amber-400" /> Histórico de Versões
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Backups salvos automaticamente de: <span className="text-amber-300 font-semibold">{moduleName}</span>
              </p>
            </div>
            <button onClick={onClose} title="Fechar (Esc)" className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* LISTA DE VERSÕES */}
            <div className="w-64 shrink-0 border-r border-slate-800 bg-slate-900/30 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {loadingList ? (
                <div className="text-center text-slate-500 text-xs py-10 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-500" /> Carregando...
                </div>
              ) : listError ? (
                <div className="text-center text-red-400 text-xs py-10 space-y-3">
                  <p>Erro ao carregar histórico.</p>
                  <button onClick={() => mutateList()} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">
                    Tentar novamente
                  </button>
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center text-slate-500 text-xs py-10 px-2 leading-relaxed">
                  Nenhum backup encontrado. Um backup é criado sempre que o módulo é editado ou reimportado.
                </div>
              ) : (
                <>
                  {backups.map(bkp => {
                    const { date, time } = formatDateTime(bkp.createdAt);
                    const isSelected = selectedId === bkp.id;
                    const isBase = baseId === bkp.id;
                    return (
                      <button
                        key={bkp.id}
                        onClick={() => handleSelect(bkp.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : isBase
                              ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-bold text-sm mb-1">
                          <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" />{date}</span>
                          <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded font-bold ${
                            bkp.reason === 'upload' ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {bkp.reason === 'upload' ? 'Upload' : 'Edição'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex justify-between gap-2">
                          <span>às {time}</span>
                          <span>{formatSize(bkp.size)}</span>
                        </div>
                      </button>
                    );
                  })}
                  {hasMore && (
                    <button
                      onClick={() => setSize(size + 1)}
                      disabled={loadingMore}
                      className="w-full py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {loadingMore ? 'Carregando...' : 'Carregar mais antigos'}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* COMPARAÇÃO */}
            <div className="flex-1 min-w-0 bg-slate-950 p-6 flex flex-col">
              {!selectedId ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                  <FileText className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium">Selecione uma data na barra lateral para visualizar o comparativo.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-wider font-mono">Comparar com</span>
                        <select
                          value={baseId}
                          onChange={e => setBaseId(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value={CURRENT}>Versão atual</option>
                          {backups.filter(b => b.id !== selectedId).map(b => {
                            const { date, time } = formatDateTime(b.createdAt);
                            return <option key={b.id} value={b.id}>Backup de {date} {time}</option>;
                          })}
                        </select>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => setConfirmDeleteId(selectedId)}
                          className="flex items-center gap-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 px-3 py-2 rounded-lg text-xs font-bold transition-all border border-red-500/30 cursor-pointer"
                          title="Apagar este backup para sempre"
                        >
                          <Trash2 className="w-4 h-4" /> Apagar
                        </button>
                        <button
                          onClick={() => selected && onRestore(selected.content)}
                          disabled={!selected}
                          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className="w-4 h-4" /> Carregar no Editor
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                      <span className="flex items-center gap-1.5 text-red-400 bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20">
                        <span className="font-black text-sm">-</span>
                        {comparingWithCurrent ? 'Texto atual (será apagado/sobrescrito)' : `Só no ${versionLabel(baseSummary)}`}
                        {diff && !diff.identical && <strong className="ml-1">{diff.removed}</strong>}
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                        <span className="font-black text-sm">+</span>
                        {comparingWithCurrent ? 'Texto do backup (voltará para o sistema)' : `Só no ${versionLabel(selectedSummary)}`}
                        {diff && !diff.identical && <strong className="ml-1">{diff.added}</strong>}
                      </span>
                      <label className="flex items-center gap-1.5 text-slate-400 bg-slate-800/50 px-2.5 py-1 rounded border border-slate-700/50 cursor-pointer select-none ml-auto">
                        <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="accent-amber-500" />
                        Mostrar texto inalterado
                      </label>
                    </div>
                  </div>

                  <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl py-2 text-sm font-mono overflow-y-auto custom-scrollbar">
                    {diffError ? (
                      <div className="h-full flex items-center justify-center text-red-400 text-xs">
                        Erro ao carregar o conteúdo da versão. Feche e abra o histórico novamente.
                      </div>
                    ) : loadingDiff || !diff ? (
                      <div className="h-full flex items-center justify-center text-slate-500 text-xs gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-500" /> Calculando diferenças...
                      </div>
                    ) : diff.identical ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 text-xs">
                        <FileText className="w-10 h-10 opacity-20" />
                        As duas versões são idênticas.
                      </div>
                    ) : (
                      <>
                        {diff.timedOut && (
                          <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2 font-sans">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            Os textos são grandes e muito diferentes; exibindo como substituição completa.
                          </div>
                        )}
                        {diff.rows.map((row, idx) => {
                          if (row.type === 'line') return <DiffLine key={idx} row={row} />;
                          if (expanded.has(`${diffKey}|${row.id}`)) {
                            return row.rows.map((r, k) => <DiffLine key={`${row.id}-${k}`} row={r} />);
                          }
                          return (
                            <button
                              key={row.id}
                              onClick={() => setExpanded(prev => new Set(prev).add(`${diffKey}|${row.id}`))}
                              className="w-full flex items-center justify-center gap-2 py-1.5 my-1 bg-slate-800/40 hover:bg-slate-800 text-sky-300 text-[11px] font-sans font-semibold cursor-pointer transition-all"
                            >
                              <ChevronsUpDown className="w-3.5 h-3.5" />
                              {row.hiddenCount} {row.hiddenCount === 1 ? 'linha inalterada' : 'linhas inalteradas'}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Apagar Backup</h3>
                <p className="text-xs text-slate-400">Ação irreversível no banco de dados</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800 font-medium">
              Tem certeza que deseja apagar esta versão de backup <strong className="text-white">permanentemente</strong>? Você não poderá recuperá-la depois.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Apagando...' : 'Sim, Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
