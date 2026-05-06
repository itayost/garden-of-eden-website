import { describe, it, expect } from "vitest";
import {
  isProfileComplete,
  getProfileCompletionPercentage,
  getMissingRequiredFields,
  PROFILE_FIELD_LABELS_HE,
} from "../profile";
import type { Profile } from "@/types/database";

function createProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    full_name: "ישראל ישראלי",
    phone: "0501234567",
    role: "trainee",
    birthdate: "2010-01-01",
    position: "חלוץ",
    avatar_url: "https://example.com/avatar.png",
    processed_avatar_url: null,
    profile_completed: true,
    tour_completed: false,
    nutrition_appointment_status: "not_scheduled",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    deleted_at: null,
    arbox_user_id: null,
    club: null,
    welcome_message_sent_at: null,
    ...overrides,
  };
}

describe("isProfileComplete", () => {
  it("returns true for profile with full_name and birthdate", () => {
    expect(isProfileComplete(createProfile())).toBe(true);
  });

  it("returns false for null profile", () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  it("returns false when full_name is null", () => {
    expect(isProfileComplete(createProfile({ full_name: null }))).toBe(false);
  });

  it("returns false when full_name is too short", () => {
    expect(isProfileComplete(createProfile({ full_name: "א" }))).toBe(false);
  });

  it("returns false when full_name is whitespace only", () => {
    expect(isProfileComplete(createProfile({ full_name: "  " }))).toBe(false);
  });

  it("returns false when birthdate is null", () => {
    expect(isProfileComplete(createProfile({ birthdate: null }))).toBe(false);
  });

  it("returns false when both fields are missing", () => {
    expect(
      isProfileComplete(createProfile({ full_name: null, birthdate: null }))
    ).toBe(false);
  });
});

describe("getProfileCompletionPercentage", () => {
  it("returns 0 for null profile", () => {
    expect(getProfileCompletionPercentage(null)).toBe(0);
  });

  it("returns 100 for fully complete profile", () => {
    expect(getProfileCompletionPercentage(createProfile())).toBe(100);
  });

  it("returns 80 when avatar is missing", () => {
    expect(
      getProfileCompletionPercentage(createProfile({ avatar_url: null }))
    ).toBe(80);
  });

  it("returns 60 when position and avatar are missing", () => {
    expect(
      getProfileCompletionPercentage(
        createProfile({ position: null, avatar_url: null })
      )
    ).toBe(60);
  });

  it("returns 30 when only full_name is filled", () => {
    expect(
      getProfileCompletionPercentage(
        createProfile({ birthdate: null, position: null, avatar_url: null })
      )
    ).toBe(30);
  });

  it("returns 0 when all fields are missing", () => {
    expect(
      getProfileCompletionPercentage(
        createProfile({
          full_name: null,
          birthdate: null,
          position: null,
          avatar_url: null,
        })
      )
    ).toBe(0);
  });
});

describe("getMissingRequiredFields", () => {
  it("returns empty array for complete profile", () => {
    expect(getMissingRequiredFields(createProfile())).toEqual([]);
  });

  it("returns both fields for null profile", () => {
    expect(getMissingRequiredFields(null)).toEqual(["full_name", "birthdate"]);
  });

  it("returns full_name when name is null", () => {
    expect(getMissingRequiredFields(createProfile({ full_name: null }))).toEqual(
      ["full_name"]
    );
  });

  it("returns full_name when name is too short", () => {
    expect(getMissingRequiredFields(createProfile({ full_name: "א" }))).toEqual(
      ["full_name"]
    );
  });

  it("returns birthdate when missing", () => {
    expect(
      getMissingRequiredFields(createProfile({ birthdate: null }))
    ).toEqual(["birthdate"]);
  });
});

describe("PROFILE_FIELD_LABELS_HE", () => {
  it("has Hebrew labels for required fields", () => {
    expect(PROFILE_FIELD_LABELS_HE.full_name).toBe("שם מלא");
    expect(PROFILE_FIELD_LABELS_HE.birthdate).toBe("תאריך לידה");
  });

  it("has Hebrew labels for optional fields", () => {
    expect(PROFILE_FIELD_LABELS_HE.position).toBe("עמדה");
    expect(PROFILE_FIELD_LABELS_HE.avatar_url).toBe("תמונת פרופיל");
  });
});
