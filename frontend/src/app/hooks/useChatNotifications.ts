import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { API_URL, fetcher } from '../lib/api';
import type { Chat } from '../lib/types';

// Notificações do navegador quando um chat novo cai na aba Entrada sem auditoria.

/**
 * - unsupported: navegador sem Notification API
 * - blocked: permissão negada (só o usuário desbloqueia, nas configurações do site)
 * - off: ainda não pediu permissão, ou permitiu mas desligou no sininho
 * - on: permitido e ligado
 */
export type NotificationState = 'unsupported' | 'blocked' | 'off' | 'on';

const PREF_KEY = 'agape_notifications_enabled';
// Acima disso, os chats novos de um mesmo polling viram uma notificação só.
const GROUP_THRESHOLD = 3;
const POLL_INTERVAL = 15000;
const ICON = '/favicon.ico';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const isSupported = () => typeof window !== 'undefined' && 'Notification' in window;

function readPref() {
  try { return localStorage.getItem(PREF_KEY) !== '0'; } catch { return true; }
}

function writePref(enabled: boolean) {
  try { localStorage.setItem(PREF_KEY, enabled ? '1' : '0'); } catch { /* sem storage: vale só nesta sessão */ }
}

function getSnapshot(): NotificationState {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission === 'granted' && readPref()) return 'on';
  return 'off';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Reflete mudanças feitas fora do sininho (configurações do site, outra aba).
  window.addEventListener('storage', emit);
  window.addEventListener('focus', emit);
  let status: PermissionStatus | null = null;
  navigator.permissions?.query({ name: 'notifications' }).then((s) => { status = s; s.addEventListener('change', emit); }).catch(() => {});
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', emit);
    window.removeEventListener('focus', emit);
    status?.removeEventListener('change', emit);
  };
}

// Chat que ninguém auditou ainda (nem nota geral, nem auditoria de resposta).
const isPending = (chat: Chat) => !chat.audit && !chat.hasMessageAudits;

function showNotification(title: string, body: string, tag: string) {
  try {
    const n = new Notification(title, { body, icon: ICON, tag });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {
    // Alguns navegadores (Chrome no Android) só aceitam notificação via service worker.
  }
}

function notifyNewChats(chats: Chat[]) {
  if (chats.length > GROUP_THRESHOLD) {
    showNotification('Novos chats no Ágape', `${chats.length} chats aguardam auditoria`, 'agape-new-chats');
    return;
  }
  // A tag por chat faz o navegador substituir em vez de empilhar (ex: várias abas abertas).
  for (const chat of chats) {
    showNotification('Novo chat no Ágape', `${chat.contactName} aguarda auditoria`, `agape-chat-${chat.id}`);
  }
}

export function useChatNotifications(attendantId: string) {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => 'unsupported' as const);
  const enabled = state === 'on';

  // Mesma URL da aba Entrada sem busca: o SWR deduplica com a lista quando ela está aberta.
  // Continua consultando com a aba do navegador em segundo plano, que é quando a notificação importa.
  const url = enabled && attendantId ? `${API_URL}/chats?search=&attendantId=${attendantId}&status=abertos` : null;
  const { data } = useSWR<{ items?: Chat[] }>(url, fetcher, {
    refreshInterval: POLL_INTERVAL,
    refreshWhenHidden: true,
    refreshWhenOffline: false,
  });

  // Ids já vistos. A primeira resposta de cada atendente só serve de base (não notifica),
  // então recarregar a página ou trocar de atendente não dispara uma rajada.
  const seenRef = useRef<{ key: string; ids: Set<string> } | null>(null);

  useEffect(() => {
    if (!url) { seenRef.current = null; return; }
    if (!data?.items) return;

    const pending = data.items.filter(isPending);
    const seen = seenRef.current;
    if (!seen || seen.key !== url) {
      seenRef.current = { key: url, ids: new Set(pending.map((c) => c.id)) };
      return;
    }

    const fresh = pending.filter((c) => !seen.ids.has(c.id));
    fresh.forEach((c) => seen.ids.add(c.id));
    if (fresh.length > 0) notifyNewChats(fresh);
  }, [url, data]);

  const toggle = useCallback(async () => {
    if (!isSupported()) return;
    if (Notification.permission === 'denied') {
      toast.error('Notificações bloqueadas. Libere nas configurações do site no navegador.', { id: 'notifications-blocked' });
      return;
    }
    if (Notification.permission === 'granted') {
      const next = !readPref();
      writePref(next);
      emit();
      toast.success(next ? 'Notificações de novos chats ativadas.' : 'Notificações de novos chats desativadas.', { id: 'notifications-toggle' });
      return;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      writePref(true);
      toast.success('Notificações de novos chats ativadas.', { id: 'notifications-toggle' });
    } else if (result === 'denied') {
      toast.error('Permissão de notificação negada.', { id: 'notifications-toggle' });
    }
    emit();
  }, []);

  return { state, toggle };
}
