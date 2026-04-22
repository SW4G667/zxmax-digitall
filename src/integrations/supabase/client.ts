import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://ibemmtkzsjygbdoulqpy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliZW1tdGt6c2p5Z2Jkb3VscXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MzcyMzcsImV4cCI6MjA5MjQxMzIzN30.8zR3dKZXP1Elb34ditAgOQj4xIlucfktQKg7y_UoCPc';

// Verificação de ambiente para evitar erro de 'localStorage is not defined' no build/server-side
const isBrowser = typeof window !== 'undefined';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: isBrowser ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
