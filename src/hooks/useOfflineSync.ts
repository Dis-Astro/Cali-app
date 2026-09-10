import { useEffect, useState } from "react";
import {
  flushPendingOperations,
  getOfflineSnapshot,
  initializeOfflineSync,
  setOfflineSyncAccount,
  subscribeOfflineSync,
  type OfflineSnapshot,
} from "@/lib/offlineSync";
import { useAuth } from "@/hooks/useAuth";

export function useOfflineSync() {
  const { user, profile, isAuthenticated } = useAuth();
  const accountId = isAuthenticated ? user?.id ?? profile?.user_id ?? null : null;
  const [state, setState] = useState<OfflineSnapshot>(getOfflineSnapshot());

  useEffect(() => {
    void setOfflineSyncAccount(accountId).then(() => {
      if (accountId) void flushPendingOperations();
    });
    void initializeOfflineSync();
    return subscribeOfflineSync(setState);
  }, [accountId]);

  // Never render the previous account's status, including the render before
  // the identity effect runs during sign-out or account switching.
  const accountState = state.accountId === accountId ? state : {
    ...state, accountId, pendingCount: 0, lastSyncAt: null, lastError: null, isSyncing: false,
  };

  return {
    ...accountState,
    syncNow: flushPendingOperations,
  };
}
