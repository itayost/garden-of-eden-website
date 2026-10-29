import { describe, expect, test } from "vitest";
import { saveErrorMessage, STAFF_MESSAGES } from "../staff-messages";

describe("saveErrorMessage", () => {
  test("a Survey that already has Responses", () => {
    expect(saveErrorMessage("survey_has_responses")).toBe("כבר יש תשובות, אי אפשר לשנות שאלות או קהל");
  });

  test("a Survey that no longer exists", () => {
    expect(saveErrorMessage("survey_not_found")).toBe("הסקר לא נמצא");
  });

  test("matches the code inside the longer text Postgres sends", () => {
    expect(saveErrorMessage("P0001: survey_has_responses (CONTEXT: PL/pgSQL)")).toBe(STAFF_MESSAGES.hasResponses);
  });

  test("an error the function does not name is unknown", () => {
    expect(saveErrorMessage("insert or update violates foreign key constraint")).toBeNull();
  });
});
