import { describe, expect, test } from "vitest";

import { courseViewerFromProfile, type CourseViewerRow } from "../course-viewer";

const row: CourseViewerRow = {
  role: "trainee",
  is_active: true,
  course_seen_training_on: "2026-11-20",
  course_access_until: "2026-12-31",
  arbox_bought_course: false,
  arbox_paid_training: true,
  access_override: null,
};

describe("courseViewerFromProfile", () => {
  test("copies the profile's role, status and days", () => {
    expect(courseViewerFromProfile(row)).toEqual({
      role: "trainee",
      isActive: true,
      seenTrainingOn: "2026-11-20",
      accessUntil: "2026-12-31",
      boughtCourse: false,
      courseOnly: false,
    });
  });

  test("an Arbox buyer of the digital course is a buyer", () => {
    expect(courseViewerFromProfile({ ...row, arbox_bought_course: true }).boughtCourse).toBe(true);
  });

  test("an admin's course_only override counts as a buyer", () => {
    expect(courseViewerFromProfile({ ...row, access_override: "course_only" }).boughtCourse).toBe(true);
  });

  test("a full override is not a buyer", () => {
    expect(courseViewerFromProfile({ ...row, access_override: "full" }).boughtCourse).toBe(false);
  });

  test("an unknown override is not a buyer", () => {
    expect(courseViewerFromProfile({ ...row, access_override: "something" }).boughtCourse).toBe(false);
  });

  test("a buyer who never paid for training is course-only, as the middleware tier says", () => {
    const viewer = courseViewerFromProfile({ ...row, arbox_bought_course: true, arbox_paid_training: false });
    expect(viewer.courseOnly).toBe(true);
    expect(viewer.boughtCourse).toBe(true);
  });

  test("a buyer who also paid for training is not course-only", () => {
    expect(
      courseViewerFromProfile({ ...row, arbox_bought_course: true, arbox_paid_training: true }).courseOnly,
    ).toBe(false);
  });

  test("an admin's course_only override is course-only, a full override is not", () => {
    expect(courseViewerFromProfile({ ...row, access_override: "course_only" }).courseOnly).toBe(true);
    expect(
      courseViewerFromProfile({
        ...row,
        arbox_bought_course: true,
        arbox_paid_training: false,
        access_override: "full",
      }).courseOnly,
    ).toBe(false);
  });

  test("null columns read as no role, not active, no days, no purchase and not course-only", () => {
    expect(
      courseViewerFromProfile({
        role: null,
        is_active: null,
        course_seen_training_on: null,
        course_access_until: null,
        arbox_bought_course: null,
        arbox_paid_training: null,
        access_override: null,
      }),
    ).toEqual({
      role: null,
      isActive: false,
      seenTrainingOn: null,
      accessUntil: null,
      boughtCourse: false,
      courseOnly: false,
    });
  });

  test("no profile row reads as no viewer", () => {
    expect(courseViewerFromProfile(null)).toEqual({
      role: null,
      isActive: false,
      seenTrainingOn: null,
      accessUntil: null,
      boughtCourse: false,
      courseOnly: false,
    });
  });
});
