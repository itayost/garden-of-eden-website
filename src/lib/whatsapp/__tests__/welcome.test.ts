import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendWelcomeMessage } from "../welcome";

const ORIGINAL_FETCH = globalThis.fetch;

function mockFetchOk(messageId = "wamid.TEST") {
  const fn = vi.fn(async () =>
    new Response(JSON.stringify({ messages: [{ id: messageId }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function mockFetchError(
  status = 400,
  payload: unknown = {
    error: { code: 132001, message: "Template name does not exist" },
  }
) {
  const fn = vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("sendWelcomeMessage", () => {
  beforeEach(() => {
    process.env.WHATSAPP_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "987654321";
    process.env.WHATSAPP_WELCOME_TEMPLATE_NAME = "garden_eden_welcome";
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    delete process.env.WHATSAPP_WELCOME_TEMPLATE_NAME;
  });

  it("returns config error when template env var is missing", async () => {
    delete process.env.WHATSAPP_WELCOME_TEMPLATE_NAME;
    const result = await sendWelcomeMessage("+972521234567", "דני");
    expect(result.success).toBe(false);
    expect(result.error).toContain("WHATSAPP_WELCOME_TEMPLATE_NAME");
  });

  it("posts to Graph API with the configured template, language he, and the trainee name as body parameter", async () => {
    const fetchSpy = mockFetchOk();
    const result = await sendWelcomeMessage("+972521234567", "דני");

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("wamid.TEST");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://graph.facebook.com/v21.0/987654321/messages");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token"
    );

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: "+972521234567",
      type: "template",
      template: {
        name: "garden_eden_welcome",
        language: { code: "he" },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: "דני" }],
          },
        ],
      },
    });
  });

  it("falls back to a default Hebrew salutation when name is null", async () => {
    const fetchSpy = mockFetchOk();
    await sendWelcomeMessage("+972521234567", null);
    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
    );
    expect(body.template.components[0].parameters[0].text).toBe("חבר/ה");
  });

  it("falls back when name is whitespace only", async () => {
    const fetchSpy = mockFetchOk();
    await sendWelcomeMessage("+972521234567", "   ");
    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
    );
    expect(body.template.components[0].parameters[0].text).toBe("חבר/ה");
  });

  it("returns a structured error when Meta rejects the request", async () => {
    mockFetchError();
    const result = await sendWelcomeMessage("+972521234567", "דני");
    expect(result.success).toBe(false);
    expect(result.error).toContain("132001");
    expect(result.error).toContain("Template name does not exist");
  });
});
