// Tipos compartilhados da tela de auditoria.
export interface Subtopic { id: string; name: string; }
export interface Topic { id: string; name: string; subtopics?: Subtopic[]; }
export interface FailReason { id: string; name: string; }
export interface Attendant { id: string; name: string; }
export interface Audit { rating: number | null; failReasons?: string[]; auditorFeedback: string; topicId?: string; subtopicId?: string; }
export interface Chat { id: string; contactName: string; contactPhoto?: string; carteiraTag: string; allTags?: string[]; updatedAt: string; lastMessage?: unknown; audit?: Audit; hasMessageAudits?: boolean; }
export interface Message { _t?: string; id: string; source: string; text?: string; fallbackText?: string; body?: string; caption?: string; content?: string | Record<string, unknown>; type?: string; messageType?: string; fileType?: string; prefix?: string; createdAtUTC?: string; createdAt?: string; dateUTC?: string; date?: string; eventAtUTC?: string; sentByOrganizationMember?: { id: string }; botInstance?: { botName: string }; }
/** Quem executou a ação de um evento de sistema (atendente, chatbot, contato ou sistema). */
export interface TimelineAuthor { _t: 'AgentAuthorModel' | 'BotAuthorModel' | 'ContactAuthorModel' | 'SystemAuthorModel' | (string & {}); agentId?: string; botId?: string | null; name?: string; }
/** Nomes resolvidos pelo backend a partir dos ids do evento. */
export interface TimelineEventNames { author?: string; previousMember?: string; newMember?: string; previousSector?: string; newSector?: string; addedTags?: string[]; removedTags?: string[]; }
/**
 * Evento de sistema da timeline da Umbler (ex: "MemberTransferMetadataModel", "ChatClosedMetadataModel"),
 * intercalado com as mensagens. Os campos variam por tipo; a Umbler pode criar tipos novos, então tudo é opcional.
 */
export interface TimelineEvent {
  _t: string; id: string; eventAtUTC?: string; createdAtUTC?: string; author?: TimelineAuthor; names?: TimelineEventNames;
  previousMemberId?: string | null; newMemberId?: string | null; memberId?: string; previousSectorId?: string; newSectorId?: string;
  userProvidedReason?: string | null; causedBy?: string | null; reassignReason?: string | null; direction?: 'Outgoing' | 'Incoming';
  botId?: string; botTitle?: string | null; triggerName?: string | null; isParallel?: boolean; error?: string; details?: string | null;
  flow?: string; result?: string; addedTagIds?: string[]; removedTagIds?: string[]; target?: 'Chat' | 'Contact';
  scheduledToUTC?: string; action?: string; contentKind?: string; canceledReason?: string | null;
  waiting?: boolean; isPrivate?: boolean; visible?: boolean; field?: string; fieldName?: string | null; value?: string | null;
}
/** Item da conversa: mensagem ou evento de sistema. */
export type TimelineEntry = Message | TimelineEvent;
export const isTimelineEvent = (entry: TimelineEntry): entry is TimelineEvent =>
  typeof entry?._t === 'string' && entry._t.endsWith('MetadataModel');
export interface MessageAudit { topicId?: string; subtopicId?: string; failReasons?: string[]; auditorFeedback?: string; clientQuestion?: string; targetModule?: string; }
/** Filtro avançado da lista: nota (1–5) ou status da auditoria. */
export type ChatFilter = number | 'pendente' | 'parcial';
