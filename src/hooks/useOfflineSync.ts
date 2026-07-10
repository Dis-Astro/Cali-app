import { useEffect, useState } from "react";
import {
  flushPendingOperations,
  getOfflineSnapshot,
  initializeOfflineSync,
  subscribeOfflineSync,
  type OfflineSnapshot,
} from "@/lib/offlineSync";

export function useOfflineSync() {
  const [state, setState] = useState<OfflineSnapshot>(getOfflineSnapshot());

  useEffect(() => {
    void initializeOfflineSync();
    return subscribeOfflineSync(setState);
  }, []);

  return {
    ...state,
    syncNow: flushPendingOperations,
  };
}
