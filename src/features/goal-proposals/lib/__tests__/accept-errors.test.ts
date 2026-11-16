import { describe, expect, it } from "vitest";
import { acceptErrorMessage } from "../accept-errors";

describe("acceptErrorMessage", () => {
  it("reads a second open Goal on the metric (the unique index)", () => {
    expect(
      acceptErrorMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "idx_player_goals_unique_active"',
      }),
    ).toBe("כבר קיים יעד פעיל למדד זה");
  });

  it("reads each error accept_goal_proposal raises on purpose", () => {
    expect(acceptErrorMessage({ code: "P0001", message: "proposal_changed" })).toBe("ההצעה השתנתה, רעננו את הדף");
    expect(acceptErrorMessage({ code: "P0001", message: "proposal_not_found" })).toBe("ההצעה לא נמצאה");
    expect(acceptErrorMessage({ code: "P0001", message: "not_a_trainee" })).toBe("ניתן להגדיר יעדים רק לחניכים");
    expect(acceptErrorMessage({ code: "P0001", message: "assessment_deleted" })).toBe("המבדק של ההצעה נמחק");
  });

  it("matches the code inside the longer text Postgres sends", () => {
    expect(acceptErrorMessage({ message: "P0001: proposal_changed (CONTEXT: PL/pgSQL function accept_goal_proposal)" })).toBe(
      "ההצעה השתנתה, רעננו את הדף",
    );
  });

  it("gives the calm failure for anything else", () => {
    expect(acceptErrorMessage({ code: "08006", message: "connection failure" })).toBe("קבלת ההצעה נכשלה, נסו שוב");
    expect(acceptErrorMessage({ message: "" })).toBe("קבלת ההצעה נכשלה, נסו שוב");
  });
});
