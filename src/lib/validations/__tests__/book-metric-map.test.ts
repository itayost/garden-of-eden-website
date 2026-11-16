import { describe, expect, it } from "vitest";
import { MAX_METRIC_PARAMETERS, metricMapSchema } from "../book-metric-map";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

function idOf(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function firstMessage(input: unknown): string | undefined {
  const result = metricMapSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("metricMapSchema", () => {
  it("accepts a Goal metric with distinct parameter ids", () => {
    expect(metricMapSchema.safeParse({ metricKey: "sprint_10m", parameterIds: [P1, P2] }).success).toBe(true);
  });

  it("accepts an empty list, which clears the metric", () => {
    expect(metricMapSchema.safeParse({ metricKey: "envelope_ball", parameterIds: [] }).success).toBe(true);
  });

  it("refuses the retired kick_power_kaiser and an unknown key", () => {
    expect(firstMessage({ metricKey: "kick_power_kaiser", parameterIds: [] })).toBe("מדד לא תקין");
    expect(firstMessage({ metricKey: "speed", parameterIds: [] })).toBe("מדד לא תקין");
  });

  it("refuses a malformed parameter id", () => {
    expect(firstMessage({ metricKey: "sprint_10m", parameterIds: ["not-a-uuid"] })).toBe("מזהה פרמטר לא תקין");
  });

  it("refuses a repeated parameter id", () => {
    expect(firstMessage({ metricKey: "sprint_10m", parameterIds: [P1, P2, P1] })).toBe("פרמטר מופיע פעמיים");
  });

  it("takes 20 parameters and refuses 21", () => {
    expect(MAX_METRIC_PARAMETERS).toBe(20);
    const twenty = Array.from({ length: 20 }, (_, i) => idOf(i + 1));
    expect(metricMapSchema.safeParse({ metricKey: "sprint_10m", parameterIds: twenty }).success).toBe(true);
    expect(firstMessage({ metricKey: "sprint_10m", parameterIds: [...twenty, idOf(21)] })).toBe(
      "אפשר לבחור עד 20 פרמטרים למדד",
    );
  });
});
