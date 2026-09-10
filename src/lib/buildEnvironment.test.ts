import { describe, expect, it } from "vitest";
import { validateBuildEnvironment } from "./buildEnvironment";

const env = { VITE_SUPABASE_PROJECT_ID: "example", VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example" };
const jwt = (role: string, ref = "example") => `header.${btoa(JSON.stringify({ role, ref }))}.signature`;
describe("release environment guard", () => {
  it("returns only public backend metadata", () => {
    expect(validateBuildEnvironment(env)).toEqual({ project: "example", backendHost: "example.supabase.co" });
    expect(validateBuildEnvironment({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: jwt("anon") }).project).toBe("example");
  });
  it("rejects mismatched targets and privileged keys without printing keys", () => {
    for (const change of [
      { VITE_SUPABASE_PROJECT_ID: "other" }, { SPG_EXPECTED_SUPABASE_PROJECT: "other" },
      { VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private" }, { VITE_SUPABASE_PUBLISHABLE_KEY: jwt("service_role") },
      { VITE_SUPABASE_PUBLISHABLE_KEY: jwt("anon", "other") }, { VITE_SUPABASE_PUBLISHABLE_KEY: "" },
      { VITE_SUPABASE_URL: "https://example.supabase.co?key=private" },
    ]) expect(() => validateBuildEnvironment({ ...env, ...change })).toThrow(/Build bloccata/);
  });
});
