import type { DriveStep } from "driver.js";

export const TOUR_STEPS: DriveStep[] = [
  {
    element: "[data-tour='welcome']",
    popover: {
      title: "ברוכים הבאים לאקדמיה!",
      description:
        "הסיור הקצר הזה יראה לכם איך להשתמש באזור האישי שלכם.",
      showButtons: ["next", "close"],
      nextBtnText: "בואו נתחיל",
      side: "bottom",
      align: "center",
      popoverClass: "tour-step-welcome",
    },
  },
  {
    element: "[data-tour='quick-actions']",
    popover: {
      title: "השאלונים שלכם",
      description:
        "<strong>לפני אימון</strong> — מלאו לפני כל אימון<br/>" +
        "<strong>אחרי אימון</strong> — מלאו אחרי כל אימון<br/>" +
        "<strong>תזונה</strong> — חובה למלא פעם אחת לפני פגישת תזונאי",
      side: "bottom",
      align: "center",
      popoverClass: "tour-step-actions",
    },
  },
  {
    element: "[data-tour='streak-card']",
    popover: {
      title: "רצף אימונים",
      description:
        "כאן תראו את רצף האימונים שלכם.<br/><strong>שמרו על הרצף ושברו את השיא!</strong>",
      side: "top",
      align: "start",
      popoverClass: "tour-step-streak",
    },
  },
  {
    element: "[data-tour='welcome']",
    popover: {
      title: "אתם מוכנים!",
      description:
        "עכשיו אתם מכירים את כל הכלים.<br/><strong>בהצלחה באימונים!</strong>",
      showButtons: ["next", "close"],
      doneBtnText: "יאללה!",
      side: "bottom",
      align: "center",
      popoverClass: "tour-step-done",
    },
  },
];
