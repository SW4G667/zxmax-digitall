import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { toast } from "sonner";

type UserProfile = Database['public']['Tables']['users']['Row'];

interface AuthContextType {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithDiscord: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

const getDisplayName = (authUser: SupabaseUser) => {
  const metadata = authUser.user_metadata ?? {};
  return (
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    authUser.email?.split('@')[0] ||
    'Usuario'
  );
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  const refreshProfile = async () => {
    if (user) {
      const currentProfile = await fetchProfile(user.id);
      setProfile(currentProfile);
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const currentProfile = await fetchProfile(currentSession.user.id);
        if (mounted) setProfile(currentProfile);
      }
      if (mounted) setLoading(false);
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (currentSession?.user) {
        void (async () => {
          const currentProfile = await fetchProfile(currentSession.user.id);
          if (mounted) {
            setProfile(currentProfile);
            setLoading(false);
          }
        })();
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string): Promise<{ error: string | null }> => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      
      // Cadastro direto via Supabase Auth para evitar erro de Edge Function
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { display_name: displayName.trim() },
          // Redireciona de volta para o site após confirmar email (se ativado)
          emailRedirectTo: window.location.origin,
        }
      });

      if (error) return { error: error.message };

      if (data.user) {
        // Se for o admin especial, tentamos promover no banco imediatamente (via trigger ou manual)
        // O usuário já terá o perfil criado via trigger do Supabase ou no primeiro login
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      }

      return { error: null };
    } catch (err) {
      return { error: 'Erro ao criar conta.' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return { error: 'Erro ao fazer login.' };
    }
  };

  const signInWithDiscord = async (): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'identify email',
        },
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return { error: 'Erro ao conectar com Discord.' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signUp, signIn, signInWithDiscord, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
