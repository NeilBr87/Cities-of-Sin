import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { getToken, setToken } from '../api/client';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [authed, setAuthed] = useState(!!getToken());
  const [me, setMe] = useState(null);
  // Set when the account's character has been killed. The player is signed in
  // and perfectly valid — they just do not currently have a body.
  const [dead, setDead] = useState(false);
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
      setDead(!!player.dead);
      return player;
    } catch (e) {
      if (e.status === 401) {
        setToken(null);
        setAuthed(false);
        setMe(null);
        setDead(false);
      } else if (e.status === 409) {
        // Signed in, but no character created yet.
        setAuthed(true);
        setMe(null);
        setDead(false);
      } else if (e.status === 410) {
        // Signed in, character killed. Straight to the respawn screen.
        setAuthed(true);
        setMe(null);
        setDead(true);
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
    setDead(false);
  }, []);

  /** Leaving the death screen to build a new character. */
  const clearDeath = useCallback(() => setDead(false), []);

  /**
   * Wraps any api call so that a thrown error surfaces as a notice instead of
   * an unhandled rejection, and a successful call refreshes the player.
   */
  const act = useCallback(async (fn, successText) => {
    try {
      const result = await fn();
      if (result?.player) {
        setMe(result.player);
        setDead(!!result.player.dead);
      } else await refresh();
      if (successText) flash(typeof successText === 'function' ? successText(result) : successText, 'good');
      return result;
    } catch (e) {
      // 410 means this character just died — usually because somebody else
      // killed them between renders. Send the player to the respawn screen
      // rather than showing a meaningless error toast.
      if (e.status === 410) {
        setDead(true);
        setMe(null);
        return null;
      }
      flash(e.message || 'Something went wrong.', 'error');
      return null;
    }
  }, [refresh, flash]);

  const value = useMemo(() => ({
    booting, authed, me, dead, setMe, refresh, signIn, signOut, act,
    notice, flash, clearDeath,
  }), [booting, authed, me, dead, refresh, signIn, signOut, act, notice, flash, clearDeath]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside a GameProvider');
  return ctx;
}
