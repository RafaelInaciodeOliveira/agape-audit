import type { Subtopic, Topic } from '../../lib/types';

interface Props {
  topics: Topic[];
  topicId: string;
  subtopicId: string;
  onTopicChange: (topicId: string) => void;
  onSubtopicChange: (subtopicId: string) => void;
  labelClassName: string;
}

// Selects Tópico/Subtópico usados nos dois painéis de auditoria (o grid que os envolve fica em cada painel).
export function TopicSubtopicSelects({ topics, topicId, subtopicId, onTopicChange, onSubtopicChange, labelClassName }: Props) {
  return (
    <>
      <div>
        <label className={labelClassName}>Tópico</label>
        <select
          value={topicId}
          onChange={(e) => onTopicChange(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 outline-none focus:border-blue-500 cursor-pointer transition-all"
        >
          <option value="">Selecione...</option>
          {topics.map((t: Topic) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClassName}>Subtópico</label>
        <select
          value={subtopicId}
          onChange={(e) => onSubtopicChange(e.target.value)}
          disabled={!topicId}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-40 transition-all"
        >
          <option value="">-</option>
          {(topics.find((t: Topic) => t.id === topicId)?.subtopics || []).map((s: Subtopic) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
    </>
  );
}
