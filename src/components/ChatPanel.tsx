import { useEffect, useRef, useState, type FormEvent } from 'react';
import api from '../lib/api';
import { useSession } from '../state/SessionProvider';
import { Empty, Loading } from './ui';
import { clockTime } from '../lib/format';
import type { ChatMessage } from '../lib/types';

/**
 * One room.
 *
 * Realtime rather than polling: Postgres pushes the INSERT and re-checks RLS
 * per subscriber, so a player cannot listen their way into a room they are not
 * standing in. History is one fetch on mount; everything after is pushed.
 */
export default function ChatPanel({ channel }: { channel: string }) {
  const { toast } = useSession();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    let alive = true;
    setMessages(null);

    api.chat.history(channel)
      .then((m) => { if (alive) setMessages(m); })
      .catch(() => { if (alive) setMessages([]); });

    const unsubscribe = api.chat.subscribe(channel, (m) => {
      // Guard against the echo of our own optimistic insert arriving twice.
      setMessages((prev) => (prev?.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m]));
    });

    return () => { alive = false; unsubscribe(); };
  }, [channel]);

  // Stay pinned to the bottom unless the reader has scrolled up to read back.
  useEffect(() => {
    const el = logRef.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = logRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;

    // Clear optimistically so the box is ready for the next line straight away,
    // and put the text back if the server refuses it (rate limit, mute). The
    // input itself is never disabled — locking it while a request was in flight
    // swallowed whatever the player typed next, which read as messages silently
    // vanishing.
    setSending(true);
    setText('');
    pinned.current = true;
    try {
      await api.chat.send(channel, body);
    } catch (err) {
      setText(body);
      toast(err instanceof Error ? err.message : 'Message did not send.', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat">
      <div />
      <div className="chat-log" ref={logRef} onScroll={onScroll}>
        {messages === null && <Loading label="Joining the room" />}
        {messages?.length === 0 && <Empty>Nobody has said anything in here.</Empty>}
        {messages?.map((m) => (
          <div className="chat-msg" key={m.id}>
            <span className="when">{clockTime(m.created_at)}</span>
            <span className="who">{m.author_name}</span>
            <span className="what">{m.body}</span>
          </div>
        ))}
      </div>

      <form className="chat-form" onSubmit={send}>
        <input
          type="text"
          value={text}
          maxLength={500}
          placeholder="Say something…"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
