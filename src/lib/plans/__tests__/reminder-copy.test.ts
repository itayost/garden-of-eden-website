import { describe, it, expect } from "vitest";
import { reminderReason, REMINDED_COLUMN } from "../reminder-copy";

describe("reminder copy", () => {
  it("has Hebrew text and a stamp column per milestone", () => {
    expect(reminderReason("three_days")).toBe("מסתיים בעוד 3 ימים");
    expect(reminderReason("last_session")).toBe("נותר אימון אחד");
    expect(reminderReason("expired")).toBe("הסתיים");
    expect(REMINDED_COLUMN.three_days).toBe("reminded_3_days_at");
    expect(REMINDED_COLUMN.last_session).toBe("reminded_last_session_at");
    expect(REMINDED_COLUMN.expired).toBe("reminded_expired_at");
  });
});
