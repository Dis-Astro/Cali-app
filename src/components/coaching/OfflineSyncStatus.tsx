import { Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineSync } from "@/hooks/useOfflineSync";

const OfflineSyncStatus = () => {
  const { isOnline, isSyncing, pendingCount, lastError, syncNow } = useOfflineSync();

  const label = !isOnline
    ? pendingCount > 0
      ? `Offline · ${pendingCount} da sincronizzare`
      : "Offline"
    : isSyncing
      ? "Sincronizzazione..."
      : pendingCount > 0
        ? `${pendingCount} da sincronizzare`
        : "Sincronizzato";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void syncNow()}
      disabled={!isOnline || isSyncing || pendingCount === 0}
      title={lastError || label}
      className={`h-8 max-w-[170px] gap-1.5 rounded-full px-2.5 text-[10px] font-semibold ${
        !isOnline
          ? "bg-orange-500/10 text-orange-500 hover:bg-orange-500/10"
          : pendingCount > 0
            ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/15"
            : "bg-primary/10 text-primary hover:bg-primary/15"
      }`}
    >
      {isSyncing ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : !isOnline ? (
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
      ) : pendingCount > 0 ? (
        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Cloud className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </Button>
  );
};

export default OfflineSyncStatus;
