// Tipos compartilhados da tela de auditoria.
export interface Subtopic { id: string; name: string; }
export interface Topic { id: string; name: string; subtopics?: Subtopic[]; }
export interface FailReason { id: string; name: string; }
export interface Attendant { id: string; name: string; }
export interface Audit { rating: number | null; failReasons?: string[]; auditorFeedback: string; topicId?: string; subtopicId?: string; }
export interface Chat { id: string; contactName: string; contactPhoto?: string; carteiraTag: string; allTags?: string[]; updatedAt: string; lastMessage?: unknown; audit?: Audit; hasMessageAudits?: boolean; }
export interface Message { id: string; source: string; text?: string; fallbackText?: string; body?: string; caption?: string; content?: string | Record<string, unknown>; type?: string; messageType?: string; fileType?: string; prefix?: string; createdAtUTC?: string; createdAt?: string; dateUTC?: string; date?: string; eventAtUTC?: string; sentByOrganizationMember?: { id: string }; botInstance?: { botName: string }; }
export interface MessageAudit { topicId?: string; subtopicId?: string; failReasons?: string[]; auditorFeedback?: string; clientQuestion?: string; targetModule?: string; }
/** Filtro avançado da lista: nota (1–5) ou status da auditoria. */
export type ChatFilter = number | 'pendente' | 'parcial';
