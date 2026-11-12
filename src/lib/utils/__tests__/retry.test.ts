import { describe, expect, it } from "vitest";
import { retryWhile } from "../retry";

describe("retryWhile", () => {
  it("returns the first result that needs no retry", async () => {
    const answers = ["busy", "busy", "done"];
    let calls = 0;
    const result = await retryWhile(async () => answers[calls++], (r) => r === "busy", { attempts: 3, delayMs: 0 });
    expect(result).toBe("done");
    expect(calls).toBe(3);
  });

  it("stops after the last attempt and returns its result", async () => {
    let calls = 0;
    const result = await retryWhile(async () => `busy ${++calls}`, () => true, { attempts: 3, delayMs: 0 });
    expect(result).toBe("busy 3");
    expect(calls).toBe(3);
  });

  it("does not retry a result that is already good", async () => {
    let calls = 0;
    await retryWhile(async () => ++calls, () => false, { attempts: 3, delayMs: 0 });
    expect(calls).toBe(1);
  });
});
