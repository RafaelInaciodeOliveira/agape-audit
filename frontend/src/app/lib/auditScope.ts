import { isTimelineEvent, type TimelineEntry, type TimelineEvent } from './types';

// A auditoria cobre só o atendimento do Ágape: quando ele transfere a conversa para um
// especialista humano, tudo o que vem depois fica de fora (tela, seleção e painéis).

export interface AuditScope {
  /** Conversa até a transferência (inclusive o evento), ou inteira se não houve transferência. */
  entries: TimelineEntry[];
  /** Evento da transferência do Ágape para o especialista, se houve. */
  transfer: TimelineEvent | null;
  /** Quantos itens (mensagens e eventos) ficaram de fora depois da transferência. */
  omittedCount: number;
}

/** Transferência do Ágape para outro atendente (não conta remoção sem destino nem retorno ao Ágape). */
export const isSpecialistTransfer = (e: TimelineEvent, agapeMemberId: string) =>
  e._t === 'MemberTransferMetadataModel' &&
  e.previousMemberId === agapeMemberId &&
  Boolean(e.newMemberId) &&
  e.newMemberId !== agapeMemberId;

export function cutAtSpecialistTransfer(entries: TimelineEntry[], agapeMemberId: string | null): AuditScope {
  const index = agapeMemberId
    ? entries.findIndex((m) => isTimelineEvent(m) && isSpecialistTransfer(m, agapeMemberId))
    : -1;
  if (index === -1) return { entries, transfer: null, omittedCount: 0 };
  return {
    entries: entries.slice(0, index + 1),
    transfer: entries[index] as TimelineEvent,
    omittedCount: entries.length - index - 1,
  };
}
