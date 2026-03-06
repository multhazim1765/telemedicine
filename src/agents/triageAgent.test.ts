import { describe, expect, it, vi } from "vitest";
import { triageAgent } from "./triageAgent";

describe("triageAgent", () => {
  it("returns high severity for critical symptom combinations in offline mode", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    const result = await triageAgent(["chest_pain", "breathlessness"]);

    expect(result.severityScore).toBeGreaterThanOrEqual(7);
    expect(result.severityLevel).toBe("high");
  });

  it("returns low severity for mild symptoms in offline mode", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    const result = await triageAgent(["cough"]);

    expect(result.severityLevel).toBe("low");
  });
});
