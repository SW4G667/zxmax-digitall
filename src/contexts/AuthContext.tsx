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
    metadata.preferred_username ||
    authUser.email?.split('@')[0] ||
    'Usuario'
  );
};

const getAvatarUrl = (authUser: SupabaseUser) => {
  const metadata = authUser.user_metadata ?? {};

  return metadata.avatar_url || metadata.picture || metadata.user_avatar || null;
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

  const syncProfileFromAuthUser = async (authUser: SupabaseUser) => {
    const email = authUser.email?.toLowerCase();

    if (!email) {
      return null;
    }

    // Se já tivermos o perfil carregado e o role for admin, evitamos sobrescrever o role no upsert
    // (Embora o upsert aqui não inclua o campo 'role' por padrão, é bom garantir)
    const { error: upsertError } = await supabase.from('users').upsert(
      {
        id: authUser.id,
        email,
        display_name: getDisplayName(authUser),
        avatar_url: getAvatarUrl(authUser),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'id',
      }
    );

    if (upsertError) {
      console.error('Error upserting profile:', upsertError);
      return null;
    }

    return fetchProfile(authUser.id);
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
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const currentProfile = await fetchProfile(currentSession.user.id);
        if (mounted) {
          setProfile(currentProfile);
        }
      }

      if (mounted) {
        setLoading(false);
      }
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!currentSession?.user) {
        setLoading(false);
        return;
      }

      void (async () => {
        // No login normal, apenas buscamos o perfil
        const currentProfile = await fetchProfile(currentSession.user.id);
        if (mounted) {
          setProfile(currentProfile);
          setLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string): Promise<{ error: string | null }> => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.functions.invoke('secure-signup', {
        body: {
          email: normalizedEmail,
          password,
          displayName: displayName.trim(),
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data?.error) {
        return { error: data.error };
      }

      // Se for o admin especial, fazemos o login automático imediatamente
      if (data?.skipVerification) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        
        if (loginError) {
          return { error: "Conta criada, mas erro ao logar automaticamente: " + loginError.message };
        }
        
        toast.success("Conta de administrador criada e logada com sucesso!");
      }

      return { error: null };
    } catch (err) {
      return { error: 'Erro ao criar conta. Tente novamente.' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Email ou senha incorretos.' };
        }
        return { error: error.message };
      }

      return { error: null };
    } catch (err) {
      return { error: 'Erro ao fazer login. Tente novamente.' };
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

      if (error) {
        return { error: error.message };
      }

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
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signUp,
        signIn,
        signInWithDiscord,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
