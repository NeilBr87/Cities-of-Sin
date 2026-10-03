import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * The API endpoint is `https://<ref>.supabase.co` — NOT the dashboard address
 * `https://supabase.com/dashboard/project/<ref>`, which is the page you were
 * looking at when you copied the ref. Pasting the latter is the single easiest
 * mistake to make here, and without this check it fails later as a wall of
 * unexplained network errors, so catch it up front.
 */
const looksLikeApiUrl = (u: string) =>
  /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(u) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(u);

/**
 * False until .env.local is filled in properly. The app renders a setup screen
 * instead of a stack trace, which makes the first five minutes of this project
 * a lot less confusing than they would otherwise be.
 */
export const isConfigured = Boolean(
  url && anonKey && !url.includes('your-project-ref') && !anonKey.includes('your-anon-key')
    && looksLikeApiUrl(url.replace(/\/+$/, '')),
);

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'anon-key-missing',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
