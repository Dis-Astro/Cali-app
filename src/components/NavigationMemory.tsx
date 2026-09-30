import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { readNavigation, safeResumePath, saveNavigation } from "@/lib/navigationMemory";

export default function NavigationMemory() {
  const { profile } = useAuth();
  const location = useLocation();
  const userId = profile?.user_id;
  useEffect(() => {
    const path = safeResumePath(location.pathname + location.search);
    if (!userId || !path) return;
    const saved = readNavigation(userId);
    const target = saved?.path === path ? saved.scroll : 0;
    let touched = false;
    const cancel = () => { touched = true; };
    const restore = () => { if (!touched) window.scrollTo(0, target); };
    const timers = [0, 150, 500, 1200].map((delay) => window.setTimeout(restore, delay));
    const remember = () => saveNavigation(userId, path, window.scrollY);
    const hidden = () => { if (document.visibilityState === "hidden") remember(); };
    saveNavigation(userId, path, target);
    window.addEventListener("pagehide", remember);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    return () => {
      timers.forEach(window.clearTimeout);
      remember();
      window.removeEventListener("pagehide", remember);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [userId, location.pathname, location.search]);
  return null;
}
