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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email?: string) => {
    // Busca o perfil no banco
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    
    // Se for o email de admin, garantimos o role admin mesmo se o banco falhar ou estiver vazio
    if (email === 'admin@keybot.com') {
      return {
        id: userId,
        email: email,
        display_name: 'Administrador',
        role: 'admin',
        balance: data?.balance || 0,
        earnings: data?.earnings || 0,
        is_banned: false
      } as UserProfile;
    }

    if (error || !data) {
      console.error('Profile not found or error:', error);
      // Retorna um perfil básico para evitar tela de carregamento infinita
      return {
        id: userId,
        email: email || '',
        display_name: email?.split('@')[0] || 'Usuario',
        role: 'user',
        balance: 0,
        earnings: 0,
        is_banned: false
      } as UserProfile;
    }

    return data;
  };

  const refreshProfile = async () => {
    if (user) {
      const currentProfile = await fetchProfile(user.id, user.email);
      setProfile(currentProfile);
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          const currentProfile = await fetchProfile(currentSession.user.id, currentSession.user.email);
          if (mounted) setProfile(currentProfile);
        }
      } catch (err) {
        console.error("Bootstrap error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (currentSession?.user) {
        const currentProfile = await fetchProfile(currentSession.user.id, currentSession.user.email);
        if (mounted) {
          setProfile(currentProfile);
          setLoading(false);
        }
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
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { display_name: displayName.trim() }
        }
      });

      if (error) return { error: error.message };
      
      if (data.user) {
        toast.success("Conta criada com sucesso!");
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
