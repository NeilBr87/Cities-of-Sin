import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import api from '../lib/api';
import type { Me } from '../lib/types';

export type ToastKind = 'good' | 'error' | 'info';
export interface Toast { id: number; text: string; kind: ToastKind }

interface SessionValue {
  booting: boolean;
  session: Session | null;
  me: Me | null;
  toasts: Toast[];
  refresh: () => Promise<Me | null>;
  /** Optimistic-free helper: run an RPC, absorb the error into a toast. */
  act: <T>(fn: () => Promise<T>, success?: string | ((r: T) => string)) => Promise<T | null>;
  toast: (text: string, kind?: ToastKind) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);
  // Distinct from `session != null`: this says whether we have *asked* Supabase
  // yet. Before it flips, a null session means "don't know", not "signed out".
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastId = useRef(1);

  const toast = useCallback((text: string, kind: ToastKind = 'good') => {
    const id = nextToastId.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await api.player.me();
      setMe(next);
      return next;
    } catch {
      // A signed-in user with no profile row yet (the trigger races the first
      // page load on a fresh signup) is a transient state, not an error.
      setMe(null);
      return null;
    }
  }, []);

  // Auth bootstrap. Reading the stored session off disk is asynchronous, so
  // until `authReady` flips we genuinely do not know whether anyone is signed
  // in — and must not act as though nobody is.
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      setSession(next);
      setAuthReady(true);
      if (!next) setMe(null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Gated on authReady. Without that gate this fired on the very first render
  // with session still null, cleared `booting`, and let the router conclude the
  // user was signed out — redirecting to /signin and then bouncing to /app,
  // which silently threw away whatever URL they actually asked for. That is why
  // a hard reload of /app/crimes used to land on the dashboard.
  useEffect(() => {
    if (!authReady) return undefined;
    let alive = true;
    (async () => {
      if (session) await refresh();
      if (alive) setBooting(false);
    })();
    return () => { alive = false; };
  }, [authReady, session, refresh]);

  // Nerve, health and heat regenerate on read, so a slow poll is enough to keep
  // the header honest. Everything urgent arrives over Realtime instead.
  useEffect(() => {
    if (!session || !me?.character) return undefined;
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [session, me?.character, refresh]);

  const act = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | null> => {
      try {
        const result = await fn();
        // Most RPCs return the refreshed player alongside their outcome.
        const withMe = result as { me?: Me } | null;
        if (withMe && typeof withMe === 'object' && withMe.me) setMe(withMe.me);
        else await refresh();

        if (success) {
          toast(typeof success === 'function' ? success(result) : success, 'good');
        }
        return result;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong.', 'error');
        return null;
      }
    },
    [refresh, toast],
  );

  const signOut = useCallback(async () => {
    await api.auth.signOut();
    setMe(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ booting, session, me, toasts, refresh, act, toast, signOut }),
    [booting, session, me, toasts, refresh, act, toast, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside a SessionProvider');
  return ctx;
}

/** For pages that only render behind a live character. */
export function useCharacter() {
  const { me } = useSession();
  if (!me?.character) throw new Error('useCharacter used outside a live character route');
  return { character: me.character, city: me.city!, district: me.district!, vault: me.vault };
}
