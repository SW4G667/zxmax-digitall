import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Fail loudly when the deployment is missing its Supabase configuration.
 *
 * Without this the client is built with `undefined` and every request fails
 * with an opaque network error — which is indistinguishable from "the store is
 * empty" and was one of the ways `Todos os produtos (0)` could happen.
 *
 * Only the *publishable* (anon) key belongs here. The service role key must
 * never reach the browser bundle.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (typeof value === 'string' && value.length > 0) return value;
  const message =
    `[zxmax] Variável de ambiente ${name} ausente. ` +
    `Configure-a no projeto (Vercel → Settings → Environment Variables) e refaça o deploy.`;
  // Logged, never rendered: it names the variable, not its value.
  console.error(message);
  throw new Error(message);
}

export const supabase = createClient<Database>(
  requireEnv('VITE_SUPABASE_URL', SUPABASE_URL),
  requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY', SUPABASE_PUBLISHABLE_KEY),
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
