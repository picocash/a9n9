/**
 * Pure mapping from a Telegram Bot API update to the inbox envelope
 * (docs/events.md). Owner commands are recognised only from TELEGRAM_OWNER_ID;
 * a command from anyone else is recorded as ignored and never acted on.
 */
export interface TgUser { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string; language_code?: string }
export interface TgChat { id: number; type: 'private' | 'group' | 'supergroup' | 'channel'; title?: string; username?: string }
export interface TgMessage {
  message_id: number;
  date: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  caption?: string;
  reply_to_message?: { message_id: number; from?: TgUser; text?: string };
  photo?: unknown[];
  document?: { file_id: string; file_name?: string; mime_type?: string };
  voice?: { file_id: string; duration: number };
  entities?: Array<{ type: string; offset: number; length: number }>;
}
export interface TgUpdate { update_id: number; message?: TgMessage; edited_message?: TgMessage }

export interface TelegramInboxEvent {
  id: string;
  type: 'telegram.message';
  updateId: number;
  edited: boolean;
  chat: { id: number; type: string; title?: string };
  from: { id: number; username?: string; name: string; isBot: boolean } | null;
  isOwner: boolean;
  text: string;
  attachments: string[];
  replyTo?: number;
  sentAt: string;
  /** Owner command ("/focus", "/pause", …) when the owner sent one; `ignoredCommand` when someone else tried. */
  command?: string;
  commandArgs?: string;
  ignoredCommand?: boolean;
}

export function toInboxEvent(u: TgUpdate, ownerId: number | null): TelegramInboxEvent | null {
  const m = u.message ?? u.edited_message;
  if (!m) return null;
  const text = (m.text ?? m.caption ?? '').trim();
  const attachments: string[] = [];
  if (m.photo) attachments.push('photo');
  if (m.document) attachments.push(`document:${m.document.mime_type ?? 'unknown'}`);
  if (m.voice) attachments.push(`voice:${m.voice.duration}s`);
  if (!text && attachments.length === 0) return null;
  const isOwner = ownerId !== null && m.from?.id === ownerId;
  const ev: TelegramInboxEvent = {
    id: `tg:${m.chat.id}:${m.message_id}${u.edited_message ? ':edit:' + m.date : ''}`,
    type: 'telegram.message',
    updateId: u.update_id,
    edited: Boolean(u.edited_message),
    chat: { id: m.chat.id, type: m.chat.type, ...(m.chat.title ? { title: m.chat.title } : {}) },
    from: m.from ? { id: m.from.id, ...(m.from.username ? { username: m.from.username } : {}), name: [m.from.first_name, m.from.last_name].filter(Boolean).join(' '), isBot: Boolean(m.from.is_bot) } : null,
    isOwner,
    text,
    attachments,
    sentAt: new Date(m.date * 1000).toISOString(),
    ...(m.reply_to_message ? { replyTo: m.reply_to_message.message_id } : {}),
  };
  const cmd = text.match(/^\/([a-zA-Z_][\w]*)(?:@\w+)?(?:\s+([\s\S]*))?$/);
  if (cmd && cmd[1] !== 'start') {
    if (isOwner) {
      ev.command = cmd[1]!.toLowerCase();
      if (cmd[2]) ev.commandArgs = cmd[2].trim();
    } else {
      ev.ignoredCommand = true;
    }
  }
  return ev;
}
