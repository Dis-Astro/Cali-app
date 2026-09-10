import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineSnapshot } from "@/lib/offlineSync";
import OfflineSyncStatus from "./OfflineSyncStatus";

const { syncNow, useOfflineSync } = vi.hoisted(() => ({ syncNow: vi.fn(), useOfflineSync: vi.fn() }));
vi.mock("@/hooks/useOfflineSync", () => ({ useOfflineSync }));

const ready: OfflineSnapshot = {
  accountId: "client-1", isOnline: true, isSyncing: false, pendingCount: 0,
  lastSyncAt: null, lastError: null, storageError: false,
};

describe("offline synchronization status", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("never labels unreadable local notes as synchronized even when their count is unknown", () => {
    useOfflineSync.mockReturnValue({ ...ready, storageError: true, lastError: "Dati conservati: non disinstallare", syncNow });
    render(<OfflineSyncStatus />);
    const button = screen.getByRole("button", { name: /Errore dati locali: Dati conservati/ });
    expect(screen.queryByText("Sincronizzato")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it("offers retry and accessible error details after a failed synchronization", () => {
    useOfflineSync.mockReturnValue({ ...ready, pendingCount: 1, lastError: "Sessione non verificabile", syncNow });
    render(<OfflineSyncStatus />);
    fireEvent.click(screen.getByRole("button", { name: "Sync da verificare: Sessione non verificabile" }));
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it("keeps pending notes visible offline and disables network retry", () => {
    useOfflineSync.mockReturnValue({ ...ready, isOnline: false, pendingCount: 2, syncNow });
    render(<OfflineSyncStatus />);
    expect(screen.getByRole("button", { name: "Offline · 2 da sincronizzare" })).toBeDisabled();
  });
});
