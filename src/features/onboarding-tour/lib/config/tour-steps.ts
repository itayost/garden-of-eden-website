import type { DriveStep } from "driver.js";

export const TOUR_STEPS: DriveStep[] = [
  {
    element: "[data-tour='welcome']",
    popover: {
      title: "!ברוכים הבאים לאקדמיה",
      description:
        "בואו נכיר את האזור האישי שלכם.<br/>הסיור הקצר הזה יראה לכם איך להשתמש בכל הכלים.",
      showButtons: ["next", "close"],
      nextBtnText: "בואו נתחיל &larr;",
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
        "&#127939; <strong>לפני אימון</strong> — מלאו לפני כל אימון<br/>" +
        "&#9989; <strong>אחרי אימון</strong> — מלאו אחרי כל אימון<br/>" +
        "&#129383; <strong>תזונה</strong> — חובה למלא פעם אחת לפני פגישת תזונאי",
      side: "bottom",
      align: "center",
      popoverClass: "tour-step-actions",
    },
  },
  {
    element: "[data-tour='streak-card']",
    popover: {
      title: "&#128293; רצף אימונים",
      description:
        "כאן תראו את רצף האימונים שלכם.<br/>נסו לשמור על רצף ו<strong>לשבור את השיא האישי!</strong>",
      side: "top",
      align: "start",
      popoverClass: "tour-step-streak",
    },
  },
  {
    element: "[data-tour='welcome']",
    popover: {
      title: "!אתם מוכנים &#9917;",
      description:
        "זהו! עכשיו אתם מכירים את כל הכלים.<br/><strong>בהצלחה באימונים!</strong>",
      showButtons: ["close"],
      doneBtnText: "יאללה! &larr;",
      side: "bottom",
      align: "center",
      popoverClass: "tour-step-done",
    },
  },
];
