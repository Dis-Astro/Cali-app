import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Preferences } from "@capacitor/preferences";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { downloadWorkoutPlanForOffline } from "@/lib/offlineWorkout";

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
  isAuthenticated: boolean;
  offlineMode: boolean;
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
const LAST_USER_KEY = "spg:auth:last-user";
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
  const [offlineUserId, setOfflineUserId] = useState<string | null>(null);
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
      if (fresh.role === "cliente_coaching") {
        void downloadWorkoutPlanForOffline(fresh.user_id).catch((error) =>
          console.warn("Precaricamento scheda offline non riuscito:", error),
        );
      }
      return fresh;
    } catch (error) {
      if (!cached) console.error("Error fetching profile:", error);
      return cached;
    }
  };

  useEffect(() => {
    let mounted = true;
    let subscription: ReturnType<typeof supabase.auth.onAuthStateChange>["data"]["subscription"] | null = null;

    const applySession = async (nextSession: Session | null, allowOfflineFallback = true) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setOfflineUserId(nextSession.user.id);
        await Preferences.set({ key: LAST_USER_KEY, value: nextSession.user.id });
        await resolveProfile(nextSession.user.id);
      } else {
        const { value: cachedUserId } = await Preferences.get({ key: LAST_USER_KEY });
        const canUseOfflineIdentity = allowOfflineFallback && !navigator.onLine && Boolean(cachedUserId);
        if (canUseOfflineIdentity && cachedUserId) {
          setOfflineUserId(cachedUserId);
          setProfile(await readCachedProfile(cachedUserId));
        } else {
          setOfflineUserId(null);
          setProfile(null);
          if (navigator.onLine) await Preferences.remove({ key: LAST_USER_KEY });
        }
      }

      if (mounted) setLoading(false);
    };

    const bootstrap = async () => {
      const { value: cachedUserId } = await Preferences.get({ key: LAST_USER_KEY });
      if (cachedUserId) {
        const cachedProfile = await readCachedProfile(cachedUserId);
        if (mounted && cachedProfile) {
          setOfflineUserId(cachedUserId);
          setProfile(cachedProfile);
        }
      }

      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        await applySession(existingSession);
      } catch {
        await applySession(null);
      }
      if (!mounted) return;

      const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
        window.setTimeout(() => void applySession(nextSession), 0);
      });
      subscription = authListener.data.subscription;
    };

    const refreshSession = () => {
      if (!navigator.onLine) return;
      void supabase.auth.getSession().then(({ data: { session: currentSession } }) =>
        applySession(currentSession, false),
      );
    };

    void bootstrap();
    window.addEventListener("online", refreshSession);
    document.addEventListener("visibilitychange", refreshSession);

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      window.removeEventListener("online", refreshSession);
      document.removeEventListener("visibilitychange", refreshSession);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.session?.user) {
      setSession(data.session);
      setUser(data.session.user);
      setOfflineUserId(data.session.user.id);
      await Preferences.set({ key: LAST_USER_KEY, value: data.session.user.id });
      await resolveProfile(data.session.user.id);
      setLoading(false);
    }
    return { error };
  };

  const signOut = async () => {
    const currentUserId = user?.id || offlineUserId;
    await Preferences.remove({ key: LAST_USER_KEY });
    if (currentUserId) await Preferences.remove({ key: `${PROFILE_CACHE_PREFIX}${currentUserId}` });
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setUser(null);
    setOfflineUserId(null);
    setProfile(null);
  };

  const isAuthenticated = Boolean(user || offlineUserId);
  const offlineMode = !user && Boolean(offlineUserId);

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
        isAuthenticated,
        offlineMode,
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
