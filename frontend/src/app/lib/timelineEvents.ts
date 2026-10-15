import type { TimelineEvent } from './types';
import { formatDateTime } from './chatFormat';

// Texto dos eventos de sistema da Umbler (transferências, conversa finalizada, chatbot iniciado...)
// exibidos no meio da conversa, no mesmo espírito da timeline da própria Umbler.

export type TimelineEventKind = 'transfer' | 'closed' | 'created' | 'reopened' | 'bot' | 'botError' | 'tags' | 'schedule' | 'info';

export interface TimelineEventDescription {
  kind: TimelineEventKind;
  text: string;
  /** Linha secundária opcional (motivo, gatilho, detalhe do erro). */
  detail?: string;
}

const CAUSES: Record<string, string> = {
  ChannelDeleted: 'canal excluído',
  ContactDeleted: 'contato excluído',
  ContactBlocked: 'contato bloqueado',
  MemberDeactivated: 'atendente desativado',
  AIAgentDeleted: 'agente de IA excluído',
  TagDeleted: 'etiqueta excluída',
  SectorDeleted: 'setor excluído',
};

const SCHEDULE_KINDS: Record<string, string> = { Message: 'Mensagem', Template: 'Template', Bot: 'Chatbot', InternalNote: 'Nota interna' };

const BOT_ERRORS: Record<string, string> = {
  NoPreviousMemberToAssign: 'nenhum atendente anterior para atribuir',
  NoSectorAvailable: 'nenhum setor disponível',
  CannotCloseMemberChat: 'não pode finalizar conversa de atendente',
  AICommunicationError: 'falha de comunicação com a IA',
  AICreditsExhausted: 'créditos de IA esgotados',
  BotGaveUp: 'o chatbot desistiu do atendimento',
  SessionExpired: 'sessão expirada',
  InfiniteLoopDetected: 'loop infinito detectado',
};

const CANCEL_REASONS: Record<string, string> = { ContactSentMessage: 'o contato respondeu' };

const AUTOMATION_FLOWS: Record<string, string> = { Waiting: 'Fluxo de espera', Inactivity: 'Fluxo de inatividade', StageAutomation: 'Automação de etapa' };

const CONTACT_FIELDS: Record<string, string> = {
  Name: 'Nome', Landline: 'Telefone fixo', Email: 'E-mail', Gender: 'Gênero', PhoneNumber: 'Telefone',
  AddressLine1: 'Endereço', AddressLine2: 'Complemento', AddressCity: 'Cidade', AddressState: 'Estado',
  AddressZipCode: 'CEP', AddressCountry: 'País',
};

// "NoPreviousMemberToAssign" → "No previous member to assign" (fallback para enums sem tradução).
const humanize = (value: string) => {
  const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const quoted = (name?: string | null) => (name ? ` "${name}"` : '');

const formatWhen = (raw?: string) => {
  const { dateStr, timeStr } = formatDateTime(raw);
  return timeStr ? `${dateStr.toLowerCase()} às ${timeStr}` : dateStr.toLowerCase();
};

/** " por Fulano" / " pelo chatbot X" / " pelo contato"; vazio quando foi o sistema. */
function byAuthor(e: TimelineEvent): string {
  switch (e.author?._t) {
    case 'AgentAuthorModel': return ` por ${e.names?.author || 'um atendente'}`;
    case 'BotAuthorModel': return ` pelo chatbot${quoted(e.names?.author || e.author.name)}`;
    case 'ContactAuthorModel': return ' pelo contato';
    default: return '';
  }
}

function joinDetails(...parts: Array<string | null | undefined | false>): string | undefined {
  const text = parts.filter(Boolean).join(' · ');
  return text || undefined;
}

const reasonDetail = (e: TimelineEvent) =>
  joinDetails(e.userProvidedReason && `Motivo: ${e.userProvidedReason}`, e.causedBy && `Causa: ${CAUSES[e.causedBy] || humanize(e.causedBy)}`);

export function describeTimelineEvent(e: TimelineEvent): TimelineEventDescription {
  const names = e.names || {};
  const type = e._t.replace(/MetadataModel$/, '');

  switch (type) {
    case 'ChatCreated':
      return { kind: 'created', text: `Conversa iniciada${byAuthor(e)}` };

    case 'ChatClosed':
      return { kind: 'closed', text: `Conversa finalizada${byAuthor(e)}`, detail: reasonDetail(e) };

    case 'ChatReopened':
      return { kind: 'reopened', text: `Conversa reaberta${byAuthor(e)}` };

    case 'MemberTransfer': {
      // Atendente fora da lista configurada no Ágape chega sem nome: texto genérico.
      const next = names.newMember || 'outro atendente';
      const text = !e.previousMemberId
        ? `Conversa atribuída a ${names.newMember || 'um atendente'}`
        : !e.newMemberId
          ? `${names.previousMember || 'Atendente'} removido(a) da conversa`
          : `Conversa transferida${names.previousMember ? ` de ${names.previousMember}` : ''} para ${next}`;
      return { kind: 'transfer', text: `${text}${byAuthor(e)}`, detail: reasonDetail(e) };
    }

    case 'SectorTransfer': {
      const prev = names.previousSector ? ` do setor ${names.previousSector}` : '';
      const next = names.newSector ? ` para o setor ${names.newSector}` : ' para outro setor';
      return { kind: 'transfer', text: `Conversa transferida${prev}${next}${byAuthor(e)}`, detail: reasonDetail(e) };
    }

    case 'ChannelTransfer':
      return {
        kind: 'transfer',
        text: e.direction === 'Incoming' ? 'Conversa recebida de outro canal' : `Conversa transferida para outro canal${byAuthor(e)}`,
        detail: reasonDetail(e),
      };

    case 'BotStarted':
      return { kind: 'bot', text: `Chatbot${quoted(e.botTitle)} iniciado`, detail: joinDetails(e.triggerName && `Gatilho: ${e.triggerName}`) };

    case 'BotManuallyStarted':
      return { kind: 'bot', text: `Chatbot${quoted(e.botTitle)} iniciado manualmente${byAuthor(e)}`, detail: joinDetails(e.triggerName && `Gatilho: ${e.triggerName}`) };

    case 'ChatReassignBotStarted':
      return { kind: 'bot', text: 'Chatbot iniciado por reatribuição automática', detail: joinDetails(e.triggerName && `Gatilho: ${e.triggerName}`) };

    case 'BotStopped':
      return { kind: 'bot', text: `Chatbot interrompido${byAuthor(e)}` };

    case 'BotScheduled':
      return { kind: 'schedule', text: `Chatbot agendado para ${formatWhen(e.scheduledToUTC)}`, detail: joinDetails(e.triggerName && `Gatilho: ${e.triggerName}`) };

    case 'BotError':
      return {
        kind: 'botError',
        text: `Erro no chatbot${quoted(e.author?.name)}: ${e.error ? BOT_ERRORS[e.error] || humanize(e.error) : 'erro desconhecido'}`,
        detail: joinDetails(e.details),
      };

    case 'AutomationFlowExecuted': {
      const flow = (e.flow && AUTOMATION_FLOWS[e.flow]) || 'Automação';
      const result =
        e.result === 'BotStarted' ? `iniciou o chatbot${quoted(e.botTitle)}`
        : e.result === 'ChatClosed' ? 'finalizou a conversa'
        : e.result ? `não executou (${humanize(e.result).toLowerCase()})` : 'executado';
      return { kind: e.result === 'ChatClosed' ? 'closed' : 'bot', text: `${flow} ${result}` };
    }

    case 'TagsChanged': {
      const where = e.target === 'Contact' ? 'do contato' : 'da conversa';
      const added = names.addedTags?.length ? names.addedTags : null;
      const removed = names.removedTags?.length ? names.removedTags : null;
      const parts = [
        added && `+ ${added.join(', ')}`,
        removed && `− ${removed.join(', ')}`,
      ];
      const fallback = !added && !removed ? `${(e.addedTagIds?.length || 0) + (e.removedTagIds?.length || 0)} alteração(ões)` : '';
      return { kind: 'tags', text: `Etiquetas ${where} alteradas${byAuthor(e)}`, detail: joinDetails(...parts, fallback) };
    }

    case 'ScheduledMessageChanged': {
      const what = (e.contentKind && SCHEDULE_KINDS[e.contentKind]) || 'Mensagem';
      if (e.action === 'Canceled') {
        const reason = e.canceledReason ? CANCEL_REASONS[e.canceledReason] || humanize(e.canceledReason).toLowerCase() : '';
        return { kind: 'schedule', text: `Agendamento cancelado (${what.toLowerCase()})`, detail: joinDetails(reason && `Motivo: ${reason}`) };
      }
      return { kind: 'schedule', text: `${what} agendado(a) para ${formatWhen(e.scheduledToUTC)}${byAuthor(e)}` };
    }

    case 'ChatWaitingChanged':
      return { kind: 'info', text: `${e.waiting ? 'Conversa colocada em espera' : 'Conversa retirada da espera'}${byAuthor(e)}` };

    case 'ChatPrivateChanged':
      return { kind: 'info', text: `${e.isPrivate ? 'Conversa tornada privada' : 'Conversa tornada pública'}${byAuthor(e)}` };

    case 'ChatVisibilityChanged':
      return { kind: 'info', text: `${e.visible ? 'Conversa reexibida' : 'Conversa ocultada'}${byAuthor(e)}` };

    case 'ContactFieldEdited':
      return { kind: 'info', text: `Campo "${(e.field && CONTACT_FIELDS[e.field]) || e.field || 'contato'}" do contato alterado${byAuthor(e)}`, detail: joinDetails(e.value) };

    case 'CustomFieldEdited':
      return { kind: 'info', text: `Campo "${e.fieldName || 'personalizado'}" ${e.action === 'Added' ? 'preenchido' : 'alterado'}${byAuthor(e)}`, detail: joinDetails(e.value) };

    default:
      // Tipo novo da Umbler: mostra o nome técnico legível em vez de esconder o evento.
      return { kind: 'info', text: `${humanize(type || 'Evento do sistema')}${byAuthor(e)}` };
  }
}
