import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import { Empty, Loading } from './ui';
import Avatar from './Avatar';
import { fullName, timeAgo } from '../game/format';

/**
 * Chat rooms.
 *
 * Channels are derived from who you are, not stored as memberships: global,
 * your city, your district, your family, your crew, your party, the police
 * band for your city, your department, and the prison block if you are inside.
 *
 * This polls. See docs/XANO_SETUP.md for swapping the poll for Xano Realtime,
 * which is a drop-in replacement for the loop below.
 */
export default function Chat({ fixedChannel }) {
  const [channels, setChannels] = useState(null);
  const [active, setActive] = useState(fixedChannel || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const logRef = useRef(null);

  useEffect(() => {
    if (fixedChannel) {
      setActive(fixedChannel);
      setChannels([{ id: fixedChannel, label: 'Room' }]);
      return;
    }
    api.chat.channels().then((c) => {
      setChannels(c);
      setActive((a) => a || c[0]?.id);
    }).catch(() => setChannels([]));
  }, [fixedChannel]);

  const poll = useCallback(async () => {
    if (!active) return;
    try {
      const msgs = await api.chat.messages(active);
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  }, [active]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      const msg = await api.chat.send(active, body);
      setMessages((m) => [...m, msg]);
    } catch {
      poll();
    }
  }

  if (!channels) return <Loading what="Finding a room" />;

  return (
    <div>
      {!fixedChannel && (
        <div className="tabs">
          {channels.map((c) => (
            <div key={c.id} className={`tab ${active === c.id ? 'active' : ''}`} onClick={() => setActive(c.id)}>
              {c.label}
            </div>
          ))}
        </div>
      )}

      <div className="chat-wrap">
        <div className="chat-log" ref={logRef}>
          {messages.length === 0 && <Empty>Nobody has said anything. Go first.</Empty>}
          {messages.map((m) => (
            <div className="chat-msg" key={m.id}>
              <Avatar player={m.author} size={26} />
              <div style={{ minWidth: 0 }}>
                <span className="who">{m.author ? fullName(m.author) : 'Someone'}</span>
                <span className="when">{timeAgo(m.at)}</span>
                <div>{m.text}</div>
              </div>
            </div>
          ))}
        </div>
        <form className="chat-form" onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something…" maxLength={500} />
          <button className="btn-brass" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
