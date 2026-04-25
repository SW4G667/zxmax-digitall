import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  public_id?: number;
  email: string;
  display_name: string;
  avatar_url: string;
  pix_key: string;
  is_verified_seller: boolean;
  document_type: string;
}

interface BanInfo {
  reason: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  banned: BanInfo | null;
  isAdmin: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<Pick<Profile, "display_name" | "avatar_url" | "pix_key" | "document_type">>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState<BanInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) setProfile(data as Profile);
    return data as Profile | null;
  };

  const checkBan = async (userId: string) => {
    const { data } = await supabase
      .from("bans")
      .select("reason, created_at")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (data) {
      setBanned(data as BanInfo);
      return true;
    }
    setBanned(null);
    return false;
  };

  const checkAdmin = async (userId: string, email?: string) => {
    // Hardcoded admin check for the specific email
    if (email === "admin@keybot.com") {
      setIsAdmin(true);
      // Also ensure the role exists in the database for RLS
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      
      if (!existingRole) {
        await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      }
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      
      if (sess?.user) {
        // Use setTimeout to avoid Supabase deadlock
        setTimeout(async () => {
          await fetchProfile(sess.user.id);
          await checkBan(sess.user.id);
          await checkAdmin(sess.user.id, sess.user.email);
          setLoading(false);
        }, 0);
      } else {
        setProfile(null);
        setBanned(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        Promise.all([
          fetchProfile(sess.user.id),
          checkBan(sess.user.id),
          checkAdmin(sess.user.id, sess.user.email),
        ]).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setBanned(null);
    setIsAdmin(false);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const updateProfileFn = async (data: Partial<Pick<Profile, "display_name" | "avatar_url" | "pix_key" | "document_type">>) => {
    if (!user) return;
    await supabase.from("profiles").update(data).eq("user_id", user.id);
    await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading, banned, isAdmin,
      signUp, signIn, signOut: signOut,
      refreshProfile, updateProfile: updateProfileFn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
