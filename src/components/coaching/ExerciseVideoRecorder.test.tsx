import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExerciseVideoRecorder from "./ExerciseVideoRecorder";

const mocks = vi.hoisted(() => ({
  native: vi.fn(() => true), permissions: vi.fn(), record: vi.fn(),
  success: vi.fn(), warning: vi.fn(), error: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock("@capacitor/camera", () => ({
  Camera: { requestPermissions: mocks.permissions, recordVideo: mocks.record },
  CameraErrorCode: { RecordVideoCancelled: "cancelled" },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, warning: mocks.warning, error: mocks.error } }));

describe("exercise and timer video recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.native.mockReturnValue(true);
    mocks.permissions.mockResolvedValue({ camera: "granted", photos: "granted" });
    mocks.record.mockResolvedValue({ saved: true });
  });
  afterEach(cleanup);
  const open = (compact = false) => {
    render(<ExerciseVideoRecorder exerciseName="Squat" compact={compact} />);
    fireEvent.click(screen.getByRole("button", { name: "Registra video per Squat" }));
  };
  it.each([false, true])("records and saves from the exercise/timer button (compact %s)", async (compact) => {
    open(compact);
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ saveToGallery: true }));
  });
  it("does not open the camera when permissions are denied", async () => {
    mocks.permissions.mockResolvedValue({ camera: "denied", photos: "granted" });
    open();
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("does not claim gallery success without confirmation", async () => {
    mocks.record.mockResolvedValue({ saved: undefined });
    open();
    await waitFor(() => expect(mocks.warning).toHaveBeenCalled());
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("treats user cancellation as normal and re-enables the button", async () => {
    mocks.record.mockRejectedValue({ code: "cancelled" });
    open();
    await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
