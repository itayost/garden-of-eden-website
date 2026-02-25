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
      title: "הכלים שלכם",
      description:
        "מכאן תוכלו לגשת במהירות לכל השאלונים והכלים החשובים.<br/><strong>תלחצו על כל כרטיס כדי להתחיל.</strong>",
      side: "bottom",
      align: "center",
      popoverClass: "tour-step-actions",
    },
  },
  {
    element: "[data-tour='pre-workout']",
    popover: {
      title: "שאלון לפני אימון",
      description:
        "מלאו את השאלון הזה <strong>לפני כל אימון</strong>.<br/>ככה המאמן יודע להתאים את האימון למצב שלכם.",
      side: "bottom",
      align: "start",
      popoverClass: "tour-step-pre",
    },
  },
  {
    element: "[data-tour='post-workout']",
    popover: {
      title: "שאלון אחרי אימון",
      description:
        "אחרי כל אימון, מלאו את השאלון הזה.<br/>זה עוזר לנו <strong>לעקוב אחרי ההתקדמות</strong> שלכם.",
      side: "bottom",
      align: "start",
      popoverClass: "tour-step-post",
    },
  },
  {
    element: "[data-tour='nutrition-form']",
    popover: {
      title: "שאלון תזונה",
      description:
        "שאלון חד-פעמי על הרגלי התזונה שלכם.<br/><strong>חובה למלא לפני הפגישה עם התזונאי!</strong>",
      side: "bottom",
      align: "start",
      popoverClass: "tour-step-nutrition",
    },
  },
  {
    element: "[data-tour='streak-card']",
    popover: {
      title: "רצף אימונים",
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
      title: "!אתם מוכנים",
      description:
        "זהו! עכשיו אתם מכירים את כל הכלים.<br/><strong>בהצלחה באימונים!</strong> &#9917;",
      showButtons: ["close"],
      doneBtnText: "יאללה! &larr;",
      side: "bottom",
      align: "center",
      popoverClass: "tour-step-done",
    },
  },
];
