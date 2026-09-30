import { beforeEach, describe, expect, it } from "vitest";
import { readNavigation, saveNavigation, safeResumePath } from "./navigationMemory";
describe("resume navigation", () => {
  beforeEach(() => localStorage.clear());
  it("restores the workout day and archive query for its owner only", () => {
    saveNavigation("a", "/coaching/scheda/2?planId=plan-1", 430);
    expect(readNavigation("a")).toEqual({ path: "/coaching/scheda/2?planId=plan-1", scroll: 430 });
    expect(readNavigation("b")).toBeNull();
  });
  it("rejects external, authentication and removed timer routes and strips secrets", () => {
    for (const path of ["https://other.test", "//other.test", "/login", "/set-password", "/admin/audio-timer", "/coach/\\other.test"]) {
      expect(safeResumePath(path)).toBeNull();
    }
    expect(safeResumePath("/coaching?access_token=secret#token")).toBe("/coaching");
  });
});
