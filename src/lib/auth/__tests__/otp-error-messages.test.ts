import { describe, test, expect } from "vitest";
import {
  getOtpErrorMessage,
  OTP_SEND_ERROR_FALLBACK,
} from "../otp-error-messages";

function authError(code: string, message = "some message"): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

describe("getOtpErrorMessage", () => {
  test("maps otp_disabled to unregistered-phone message", () => {
    // Arrange
    const error = authError("otp_disabled", "Signups not allowed for otp");

    // Act
    const message = getOtpErrorMessage(error);

    // Assert
    expect(message).toBe("מספר הטלפון אינו רשום במערכת. פנו למועדון לצורך רישום");
  });

  test("maps sms rate limit codes to wait message", () => {
    expect(getOtpErrorMessage(authError("over_sms_send_rate_limit"))).toBe(
      "נשלחו יותר מדי בקשות. המתינו דקה ונסו שוב"
    );
    expect(getOtpErrorMessage(authError("over_request_rate_limit"))).toBe(
      "נשלחו יותר מדי בקשות. המתינו דקה ונסו שוב"
    );
  });

  test("maps sms_send_failed to delivery-failure message", () => {
    expect(getOtpErrorMessage(authError("sms_send_failed"))).toBe(
      "שליחת ההודעה נכשלה. ודאו שהמספר פעיל ב-WhatsApp ונסו שוב"
    );
  });

  test("maps phone_provider_disabled to provider-unavailable message", () => {
    expect(getOtpErrorMessage(authError("phone_provider_disabled"))).toBe(
      "התחברות בטלפון אינה זמינה כרגע. פנו למועדון"
    );
  });

  test("maps validation_failed to invalid-phone message", () => {
    expect(getOtpErrorMessage(authError("validation_failed"))).toBe(
      "מספר הטלפון אינו תקין"
    );
  });

  test("maps otp_expired to wrong-or-expired-code message", () => {
    expect(getOtpErrorMessage(authError("otp_expired"))).toBe(
      "הקוד שגוי או שפג תוקפו. בקשו קוד חדש"
    );
  });

  test("maps user_banned to banned-account message", () => {
    expect(getOtpErrorMessage(authError("user_banned"))).toBe(
      "החשבון חסום. פנו למועדון"
    );
  });

  test("falls back to message-pattern matching when code is missing", () => {
    // Arrange: older SDK / server responses carry only the English message
    const noSignups = new Error("Signups not allowed for otp");
    const cooldown = new Error(
      "For security purposes, you can only request this after 60 seconds."
    );
    const badPhone = new Error("Invalid phone number");
    const badToken = new Error("Token has expired or is invalid");

    // Act + Assert
    expect(getOtpErrorMessage(noSignups)).toBe(
      "מספר הטלפון אינו רשום במערכת. פנו למועדון לצורך רישום"
    );
    expect(getOtpErrorMessage(cooldown)).toBe(
      "נשלחו יותר מדי בקשות. המתינו דקה ונסו שוב"
    );
    expect(getOtpErrorMessage(badPhone)).toBe("מספר הטלפון אינו תקין");
    expect(getOtpErrorMessage(badToken)).toBe(
      "הקוד שגוי או שפג תוקפו. בקשו קוד חדש"
    );
  });

  test("supports plain non-Error objects (serialized errors)", () => {
    expect(getOtpErrorMessage({ code: "otp_expired" })).toBe(
      "הקוד שגוי או שפג תוקפו. בקשו קוד חדש"
    );
    expect(getOtpErrorMessage({ message: "sms rate limit exceeded" })).toBe(
      "נשלחו יותר מדי בקשות. המתינו דקה ונסו שוב"
    );
  });

  test("unknown code falls through to message-pattern matching", () => {
    expect(
      getOtpErrorMessage({ code: "some_new_code", message: "rate limit hit" })
    ).toBe("נשלחו יותר מדי בקשות. המתינו דקה ונסו שוב");
  });

  test("ignores prototype-chain property names as codes", () => {
    expect(getOtpErrorMessage({ code: "toString" })).toBe(OTP_SEND_ERROR_FALLBACK);
  });

  test("returns default fallback for unknown errors", () => {
    expect(getOtpErrorMessage(new Error("something unexpected"))).toBe(
      OTP_SEND_ERROR_FALLBACK
    );
    expect(getOtpErrorMessage("not an error")).toBe(OTP_SEND_ERROR_FALLBACK);
    expect(getOtpErrorMessage(null)).toBe(OTP_SEND_ERROR_FALLBACK);
    expect(getOtpErrorMessage(undefined)).toBe(OTP_SEND_ERROR_FALLBACK);
  });

  test("uses a custom fallback when provided", () => {
    expect(getOtpErrorMessage(new Error("boom"), "קוד האימות שגוי")).toBe(
      "קוד האימות שגוי"
    );
  });

  test("prefers code mapping over message-pattern matching", () => {
    // Arrange: code says rate limit even though message mentions signups
    const error = authError("over_sms_send_rate_limit", "Signups not allowed for otp");

    // Act + Assert
    expect(getOtpErrorMessage(error)).toBe("נשלחו יותר מדי בקשות. המתינו דקה ונסו שוב");
  });
});
