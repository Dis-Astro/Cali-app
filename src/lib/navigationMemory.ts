const prefix = "spg:navigation:v1:";
export function safeResumePath(path: unknown): string | null {
  if (typeof path !== "string" || path.length > 1024 || path.includes("\\") || !/^\/(coaching|palestra|coach|admin)(\/|\?|$)/.test(path)) return null;
  const url = new URL(path, "https://local.invalid");
  if (url.origin !== "https://local.invalid" || url.pathname.includes("audio-timer")) return null;
  const planId = url.searchParams.get("planId");
  return url.pathname + (planId && /^[a-zA-Z0-9-]{1,80}$/.test(planId) ? `?planId=${planId}` : "");
}
export function readNavigation(userId: string | undefined): { path: string; scroll: number } | null {
  if (!userId) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(prefix + userId) || "null");
    const path = safeResumePath(saved?.path);
    return path ? { path, scroll: Number.isFinite(saved.scroll) ? Math.max(0, Math.min(saved.scroll, 100000)) : 0 } : null;
  } catch { return null; }
}
export function saveNavigation(userId: string, path: string, scroll: number) {
  const safe = safeResumePath(path);
  if (!safe) return;
  try { localStorage.setItem(prefix + userId, JSON.stringify({ path: safe, scroll })); } catch { /* Navigation remains usable if storage is full. */ }
}
