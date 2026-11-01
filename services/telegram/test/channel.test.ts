import { describe, expect, it } from 'vitest';
import { toInboxEvent, type TgMessage, type TgUpdate, type TgUser } from '../src/channel.js';

const owner = 1111;
const msg = (over: Partial<TgMessage> = {}, from: TgUser = { id: 2222, first_name: 'Sam', username: 'sam' }): TgUpdate => ({
  update_id: 7,
  message: { message_id: 42, date: 1_800_000_000, chat: { id: 2222, type: 'private' }, from, text: 'hello', ...over },
});

describe('telegram channel', () => {
  it('maps a private message with a stable id', () => {
    const ev = toInboxEvent(msg(), owner)!;
    expect(ev).toMatchObject({ id: 'tg:2222:42', type: 'telegram.message', text: 'hello', isOwner: false, from: { id: 2222, username: 'sam', name: 'Sam', isBot: false } });
    expect(ev.command).toBeUndefined();
  });
  it('recognises owner commands only from the owner id', () => {
    expect(toInboxEvent(msg({ text: '/focus reserves on Tempo' }, { id: owner, first_name: 'Arun' }), owner)).toMatchObject({ isOwner: true, command: 'focus', commandArgs: 'reserves on Tempo' });
    expect(toInboxEvent(msg({ text: '/focus hijack' }), owner)).toMatchObject({ isOwner: false, ignoredCommand: true });
    expect(toInboxEvent(msg({ text: '/focus x' }), null)!.ignoredCommand).toBe(true);
  });
  it('/start is a greeting, not a command', () => {
    const ev = toInboxEvent(msg({ text: '/start' }), owner)!;
    expect(ev.command).toBeUndefined();
    expect(ev.ignoredCommand).toBeUndefined();
  });
  it('keeps attachments and reply context; drops empty updates', () => {
    const u = msg({ caption: 'see this', document: { file_id: 'f', mime_type: 'application/pdf' }, reply_to_message: { message_id: 40 } });
    delete u.message!.text;
    const ev = toInboxEvent(u, owner)!;
    expect(ev).toMatchObject({ text: 'see this', attachments: ['document:application/pdf'], replyTo: 40 });
    expect(toInboxEvent({ update_id: 1 }, owner)).toBeNull();
    expect(toInboxEvent(msg({ text: '' }), owner)).toBeNull();
  });
  it('edits get their own id', () => {
    const u = msg();
    const edited: TgUpdate = { update_id: 8, edited_message: { ...u.message!, text: 'hello (edited)', date: 1_800_000_100 } };
    expect(toInboxEvent(edited, owner)).toMatchObject({ id: 'tg:2222:42:edit:1800000100', edited: true, text: 'hello (edited)' });
  });
});
