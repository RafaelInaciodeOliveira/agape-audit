import { Send, RefreshCw, ArrowLeft, ClipboardCheck } from 'lucide-react';
import type { FailReason, Message, Topic } from '../../lib/types';
import { renderMessageContent } from '../../lib/chatFormat';
import { TopicSubtopicSelects } from './TopicSubtopicSelects';
import { FailReasonChecklist } from './FailReasonChecklist';

type Setter<T> = (value: T) => void;

interface Props {
  selectedMessage: Message;
  topics: Topic[];
  failReasons: FailReason[];
  availableModules: string[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  msgClientQuestion: string; setMsgClientQuestion: Setter<string>;
  msgTopicId: string; setMsgTopicId: Setter<string>;
  msgSubtopicId: string; setMsgSubtopicId: Setter<string>;
  msgFailReasons: string[]; toggleMsgFailReason: (id: string) => void;
  msgFeedback: string; setMsgFeedback: Setter<string>;
  msgTrainAi: boolean; setMsgTrainAi: Setter<boolean>;
  msgTargetModule: string; setMsgTargetModule: Setter<string>;
  msgQaQuestion: string; setMsgQaQuestion: Setter<string>;
  msgQaAnswer: string; setMsgQaAnswer: Setter<string>;
}

// Painel da direita: auditoria de uma resposta do Ágape (e Q&A de treino).
// O estado do formulário fica na página, que o preenche ao selecionar a resposta.
export function MessageAuditPanel({
  selectedMessage, topics, failReasons, availableModules, onClose, onSubmit,
  msgClientQuestion, setMsgClientQuestion, msgTopicId, setMsgTopicId, msgSubtopicId, setMsgSubtopicId,
  msgFailReasons, toggleMsgFailReason, msgFeedback, setMsgFeedback, msgTrainAi, setMsgTrainAi,
  msgTargetModule, setMsgTargetModule, msgQaQuestion, setMsgQaQuestion, msgQaAnswer, setMsgQaAnswer,
}: Props) {
  return (
    <div className="w-[22rem] 2xl:w-96 bg-slate-950 p-6 flex flex-col overflow-y-auto border-l border-slate-800/80 relative custom-scrollbar shadow-2xl animate-gaveta">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
        <h3 className="text-base font-bold flex items-center gap-2 text-slate-100">
          <ClipboardCheck className="w-5 h-5 text-blue-400" /> Auditoria da Resposta
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:scale-90 transition-all duration-200 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 text-sm text-slate-300 leading-relaxed shadow-inner">
          <span className="font-bold text-slate-100 block mb-1.5">Resposta do Ágape:</span> 
          <span className="italic opacity-90">&quot;{renderMessageContent(selectedMessage).slice(0, 200)}...&quot;</span>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5">Pergunta do cliente (Contexto)</label>
          <input
            type="text"
            value={msgClientQuestion}
            onChange={(e) => setMsgClientQuestion(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TopicSubtopicSelects
            topics={topics}
            topicId={msgTopicId}
            subtopicId={msgSubtopicId}
            onTopicChange={(value) => { setMsgTopicId(value); setMsgSubtopicId(''); }}
            onSubtopicChange={setMsgSubtopicId}
            labelClassName="block text-sm font-semibold text-slate-300 mb-1.5"
          />
        </div>

        <div className="space-y-1 pt-4 border-t border-slate-800/80">
          <label className="block text-sm font-semibold text-slate-300 mb-2">Motivos de Falha / Observações</label>

          <FailReasonChecklist failReasons={failReasons} selected={msgFailReasons} onToggle={toggleMsgFailReason} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5">Observações do Auditor (Opcional)</label>
          <textarea
            value={msgFeedback}
            onChange={(e) => setMsgFeedback(e.target.value)}
            rows={3}
            placeholder="Detalhe o que o Ágape fez de errado nesta resposta..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500 custom-scrollbar"
          />
        </div>

        <div className="pt-4 border-t border-slate-800/80">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors mb-3">
            <input
              type="checkbox"
              checked={msgTrainAi}
              onChange={(e) => setMsgTrainAi(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-blue-600 cursor-pointer"
            />
            <RefreshCw className="w-4 h-4" /> Enviar Q&A para Treinar o Ágape
          </label>

          {msgTrainAi && (
            <div className="space-y-4 bg-slate-900/80 p-4 rounded-xl border border-slate-700/80 transition-all shadow-inner">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Módulo / TXT de Destino</label>
                <select
                  value={msgTargetModule}
                  onChange={(e) => setMsgTargetModule(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Selecione o arquivo .txt...</option>
                  {availableModules.map((mod, idx) => (
                    <option key={idx} value={mod}>{mod}</option>
                  ))}
                  {availableModules.length === 0 && (
                    <>
                      <option value="Módulo 1: Cadastros">Módulo 1: Cadastros</option>
                      <option value="Módulo 4: Financeiro">Módulo 4: Financeiro</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Pergunta de Treino</label>
                <input
                  type="text"
                  value={msgQaQuestion}
                  onChange={(e) => setMsgQaQuestion(e.target.value)}
                  placeholder="Ex: Como faço para emitir carteirinha?"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Resposta Ideal Esperada</label>
                <textarea
                  value={msgQaAnswer}
                  onChange={(e) => setMsgQaAnswer(e.target.value)}
                  rows={3}
                  placeholder="Ex: Acesse Cadastros > Carteirinhas e clique em Emitir..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 outline-none focus:border-blue-500 custom-scrollbar"
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-600/30 active:scale-[0.98] active:translate-y-0 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all duration-300 ease-out cursor-pointer mt-2"
        >
          <Send className="w-4 h-4" /> Salvar Auditoria da Resposta
        </button>
      </form>
    </div>
  );
}
