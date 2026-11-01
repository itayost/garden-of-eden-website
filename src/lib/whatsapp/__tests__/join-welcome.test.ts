import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JOIN_WELCOME_TEXT, sendJoinWelcome } from "../join-welcome";

const ORIGINAL_FETCH = globalThis.fetch;

describe("JOIN_WELCOME_TEXT", () => {
  it("sends trainees to book on the site, never in Arbox", () => {
    expect(JOIN_WELCOME_TEXT).toContain("https://www.edengarden.co.il/");
    expect(JOIN_WELCOME_TEXT).not.toMatch(/arbox|ארבוקס/i);
    expect(JOIN_WELCOME_TEXT.startsWith("שלום לכולם\n")).toBe(true);
    expect(JOIN_WELCOME_TEXT.endsWith("בהמשך יהיו עוד עדכונים")).toBe(true);
  });
});

describe("sendJoinWelcome", () => {
  beforeEach(() => {
    process.env.WHATSAPP_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "987654321";
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    delete process.env.WHATSAPP_JOIN_WELCOME_TEMPLATE_NAME;
  });

  it("reports a missing template without calling Meta", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const result = await sendJoinWelcome("+972521234567");
    expect(result.success).toBe(false);
    expect(result.error).toContain("WHATSAPP_JOIN_WELCOME_TEMPLATE_NAME not configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the configured template in Hebrew with no variables", async () => {
    process.env.WHATSAPP_JOIN_WELCOME_TEMPLATE_NAME = "join_welcome";
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.X" }] }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const result = await sendJoinWelcome("+972521234567");
    expect(result.success).toBe(true);
    const body = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: "+972521234567",
      type: "template",
      template: { name: "join_welcome", language: { code: "he" } },
    });
  });
});
