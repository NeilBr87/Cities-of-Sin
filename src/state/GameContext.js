import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { getToken, setToken } from '../api/client';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [authed, setAuthed] = useState(!!getToken());
  const [me, setMe] = useState(null);
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);

  const flash = useCallback((text, kind = 'good') => {
    setNotice({ text, kind });
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const player = await api.player.me();
      setMe(player);
      setAuthed(true);
      return player;
    } catch (e) {
      if (e.status === 401) {
        setToken(null);
        setAuthed(false);
        setMe(null);
      } else if (e.status === 409) {
        // Signed in, but no character created yet.
        setAuthed(true);
        setMe(null);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (getToken()) await refresh();
      setBooting(false);
    })();
  }, [refresh]);

  // Nerve, health and heat all regenerate server-side on read, so a slow poll
  // keeps the header honest without hammering the backend.
  useEffect(() => {
    if (!authed || !me) return undefined;
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [authed, me, refresh]);

  const signIn = useCallback(async (creds, isSignup) => {
    if (isSignup) await api.auth.signup(creds);
    else await api.auth.login(creds);
    setAuthed(true);
    await refresh();
  }, [refresh]);

  const signOut = useCallback(() => {
    api.auth.logout();
    setAuthed(false);
    setMe(null);
  }, []);

  /**
   * Wraps any api call so that a thrown error surfaces as a notice instead of
   * an unhandled rejection, and a successful call refreshes the player.
   */
  const act = useCallback(async (fn, successText) => {
    try {
      const result = await fn();
      if (result?.player) setMe(result.player);
      else await refresh();
      if (successText) flash(typeof successText === 'function' ? successText(result) : successText, 'good');
      return result;
    } catch (e) {
      flash(e.message || 'Something went wrong.', 'error');
      return null;
    }
  }, [refresh, flash]);

  const value = useMemo(() => ({
    booting, authed, me, setMe, refresh, signIn, signOut, act, notice, flash,
  }), [booting, authed, me, refresh, signIn, signOut, act, notice, flash]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside a GameProvider');
  return ctx;
}
