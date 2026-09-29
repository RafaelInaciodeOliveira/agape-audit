import { Star, BookOpen, Send, X } from 'lucide-react';
import type { FailReason, Topic } from '../../lib/types';
import { getRatingColor } from '../../lib/chatFormat';
import { TopicSubtopicSelects } from './TopicSubtopicSelects';
import { FailReasonChecklist } from './FailReasonChecklist';

type Setter<T> = (value: T) => void;

interface Props {
  topics: Topic[];
  failReasons: FailReason[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  rating: number; setRating: Setter<number>;
  generalTopicId: string; setGeneralTopicId: Setter<string>;
  generalSubtopicId: string; setGeneralSubtopicId: Setter<string>;
  generalFailReasons: string[]; toggleGeneralFailReason: (id: string) => void;
  feedback: string; setFeedback: Setter<string>;
}

// Painel da direita: avaliação do atendimento como um todo (nota, tópico, motivos, observação).
export function ChatAuditPanel({
  topics, failReasons, onClose, onSubmit, rating, setRating, generalTopicId, setGeneralTopicId,
  generalSubtopicId, setGeneralSubtopicId, generalFailReasons, toggleGeneralFailReason, feedback, setFeedback,
}: Props) {
  return (
    <div className="w-[22rem] 2xl:w-96 bg-slate-950 p-6 flex flex-col overflow-y-auto border-l border-slate-800/80 relative custom-scrollbar shadow-2xl animate-gaveta">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
        <h3 className="text-base font-bold flex items-center gap-2 text-slate-100">
          <BookOpen className="w-5 h-5 text-blue-400" /> Auditoria do Atendimento
        </h3>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:scale-90 transition-all duration-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-6 leading-relaxed bg-slate-900/50 p-3.5 rounded-xl border border-slate-800 font-medium">
        Nota geral do atendimento. Pra auditar respostas específicas do Ágape em detalhe (tópico, falha na base, treino), clique na bolha da resposta na conversa.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-3 text-center">
            Classificação Geral do Atendimento
          </label>

          <div className="flex gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-700/80 justify-around shadow-inner">
            {[1, 2, 3, 4, 5].map((star) => {
              const isActive = star <= rating;
              const colors = getRatingColor(rating);

              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(rating === star ? 0 : star)}
                  className={`p-1.5 focus:outline-none hover:scale-125 active:scale-75 transition-all duration-300 ease-out cursor-pointer ${isActive ? 'scale-110' : 'scale-100'}`}
                >
                  <Star className={`w-8 h-8 transition-colors duration-300 ${isActive ? `${colors.fill} ${colors.text}` : 'text-slate-700 hover:text-slate-500'}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
          <TopicSubtopicSelects
            topics={topics}
            topicId={generalTopicId}
            subtopicId={generalSubtopicId}
            onTopicChange={(value) => { setGeneralTopicId(value); setGeneralSubtopicId(''); }}
            onSubtopicChange={setGeneralSubtopicId}
            labelClassName="block text-sm font-bold text-slate-300 mb-1.5"
          />
        </div>

        <div className="space-y-1 pt-4 border-t border-slate-800/80">
          <label className="block text-sm font-bold text-slate-300 mb-2">Motivos de Falha na Conversa</label>

          <FailReasonChecklist failReasons={failReasons} selected={generalFailReasons} onToggle={toggleGeneralFailReason} />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">
            Observações Gerais do Auditor
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Resumo do atendimento como um todo..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500 custom-scrollbar font-medium"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-600/30 active:scale-[0.98] active:translate-y-0 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all duration-300 ease-out cursor-pointer mt-4"
        >
          <Send className="w-4 h-4" /> Salvar Auditoria Geral
        </button>
      </form>
    </div>
  );
}
