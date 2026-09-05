import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Preferences } from "@capacitor/preferences";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { downloadWorkoutPlanForOffline } from "@/lib/offlineWorkout";
import { clearCourseReminders } from "@/features/course-booking/courseReminders";

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
const PROFILE_RETRY_DELAYS_MS = [0, 1200, 2500];
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
  const identityVersion = useRef(0);

  const resolveProfile = async (userId: string, version: number) => {
    const cached = await readCachedProfile(userId);
    if (identityVersion.current !== version) return null;
    if (cached) setProfile(cached);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return cached;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < PROFILE_RETRY_DELAYS_MS.length; attempt++) {
      if (PROFILE_RETRY_DELAYS_MS[attempt]) {
        await new Promise((resolve) => window.setTimeout(resolve, PROFILE_RETRY_DELAYS_MS[attempt]));
      }
      if (identityVersion.current !== version) return null;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (identityVersion.current !== version) return null;
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
        lastError = error;
      }
    }
    if (!cached) console.error("Error fetching profile after retry:", lastError);
    return cached;
  };

  useEffect(() => {
    let mounted = true;
    let subscription: ReturnType<typeof supabase.auth.onAuthStateChange>["data"]["subscription"] | null = null;

    const applySession = async (nextSession: Session | null, allowOfflineFallback = true) => {
      if (!mounted) return;
      const version = ++identityVersion.current;
      setProfile(null);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setOfflineUserId(nextSession.user.id);
        await Preferences.set({ key: LAST_USER_KEY, value: nextSession.user.id });
        await resolveProfile(nextSession.user.id, version);
      } else {
        const { value: cachedUserId } = await Preferences.get({ key: LAST_USER_KEY });
        if (!mounted || identityVersion.current !== version) return;
        const canUseOfflineIdentity = allowOfflineFallback && !navigator.onLine && Boolean(cachedUserId);
        if (canUseOfflineIdentity && cachedUserId) {
          setOfflineUserId(cachedUserId);
          const cached = await readCachedProfile(cachedUserId);
          if (!mounted || identityVersion.current !== version) return;
          setProfile(cached);
        } else {
          setOfflineUserId(null);
          setProfile(null);
          if (navigator.onLine) await Preferences.remove({ key: LAST_USER_KEY });
        }
      }

      if (mounted && identityVersion.current === version) setLoading(false);
    };

    const bootstrap = async () => {
      const version = identityVersion.current;
      const { value: cachedUserId } = await Preferences.get({ key: LAST_USER_KEY });
      if (cachedUserId) {
        const cachedProfile = await readCachedProfile(cachedUserId);
        if (mounted && identityVersion.current === version && cachedProfile) {
          setOfflineUserId(cachedUserId);
          setProfile(cachedProfile);
        }
      }

      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (!mounted || identityVersion.current !== version) return;
        await applySession(existingSession);
      } catch {
        if (!mounted || identityVersion.current !== version) return;
        await applySession(null);
      }
    };

    const refreshSession = () => {
      if (!navigator.onLine || document.visibilityState === "hidden") return;
      const version = identityVersion.current;
      void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        if (mounted && identityVersion.current === version) return applySession(currentSession, false);
      }).catch(() => { /* Keep the current identity on transient network errors. */ });
    };

    subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const version = ++identityVersion.current;
      window.setTimeout(() => {
        if (mounted && identityVersion.current === version) void applySession(nextSession);
      }, 0);
    }).data.subscription;
    void bootstrap();
    window.addEventListener("online", refreshSession);
    document.addEventListener("visibilitychange", refreshSession);

    return () => {
      mounted = false;
      identityVersion.current++;
      subscription?.unsubscribe();
      window.removeEventListener("online", refreshSession);
      document.removeEventListener("visibilitychange", refreshSession);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const requestVersion = ++identityVersion.current;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.session?.user && identityVersion.current === requestVersion) {
      const version = ++identityVersion.current;
      setProfile(null);
      setSession(data.session);
      setUser(data.session.user);
      setOfflineUserId(data.session.user.id);
      await Preferences.set({ key: LAST_USER_KEY, value: data.session.user.id });
      await resolveProfile(data.session.user.id, version);
      if (identityVersion.current === version) setLoading(false);
    }
    return { error };
  };

  const signOut = async () => {
    identityVersion.current++;
    const currentUserId = user?.id || offlineUserId;
    setSession(null);
    setUser(null);
    setOfflineUserId(null);
    setProfile(null);
    setLoading(false);
    await clearCourseReminders().catch(() => console.warn("Cancellazione promemoria non riuscita"));
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
