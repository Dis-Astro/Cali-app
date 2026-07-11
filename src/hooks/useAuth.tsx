import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Preferences } from "@capacitor/preferences";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  address: string | null;
  fiscal_code: string | null;
  emergency_contact: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isCoach: boolean;
  isStaff: boolean;
  isClientePalestra: boolean;
  isClienteCoaching: boolean;
  isClienteCorso: boolean;
}

const PROFILE_CACHE_PREFIX = "spg:auth:profile:";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function readCachedProfile(userId: string): Promise<Profile | null> {
  const { value } = await Preferences.get({ key: `${PROFILE_CACHE_PREFIX}${userId}` });
  if (!value) return null;
  try {
    return JSON.parse(value) as Profile;
  } catch {
    return null;
  }
}

async function writeCachedProfile(profile: Profile) {
  await Preferences.set({
    key: `${PROFILE_CACHE_PREFIX}${profile.user_id}`,
    value: JSON.stringify(profile),
  });
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveProfile = async (userId: string) => {
    const cached = await readCachedProfile(userId);
    if (cached) setProfile(cached);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return cached;

      const fresh = data as Profile;
      setProfile(fresh);
      await writeCachedProfile(fresh);
      return fresh;
    } catch (error) {
      if (!cached) console.error("Error fetching profile:", error);
      return cached;
    }
  };

  useEffect(() => {
    let mounted = true;

    const applySession = async (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await resolveProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }

      if (mounted) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => void applySession(nextSession), 0);
    });

    void supabase.auth.getSession().then(({ data: { session: existingSession } }) => applySession(existingSession));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    const currentUserId = user?.id;
    await supabase.auth.signOut();
    if (currentUserId) await Preferences.remove({ key: `${PROFILE_CACHE_PREFIX}${currentUserId}` });
    setProfile(null);
  };

  const isAdmin = profile?.role === "admin";
  const isCoach = profile?.role === "coach";
  const isStaff = isAdmin || isCoach;
  const isClientePalestra = profile?.role === "cliente_palestra";
  const isClienteCoaching = profile?.role === "cliente_coaching";
  const isClienteCorso = profile?.role === "cliente_corso";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signOut,
        isAdmin,
        isCoach,
        isStaff,
        isClientePalestra,
        isClienteCoaching,
        isClienteCorso,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
