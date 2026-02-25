import type { DriveStep } from "driver.js";

export const TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: "ברוכים הבאים!",
      description: "בואו נכיר את האזור האישי שלכם. הסיור הקצר הזה יראה לכם את כל מה שצריך לדעת.",
      showButtons: ["next", "close"],
      nextBtnText: "בואו נתחיל",
      doneBtnText: "סיום",
      prevBtnText: "הקודם",
    },
  },
  {
    element: "[data-tour='quick-actions']",
    popover: {
      title: "פעולות מהירות",
      description: "מכאן תוכלו לגשת במהירות לכל השאלונים והכלים החשובים.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "[data-tour='pre-workout']",
    popover: {
      title: "שאלון לפני אימון",
      description: "מלאו את השאלון הזה לפני כל אימון. זה עוזר למאמן להתאים את האימון למצבכם.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='post-workout']",
    popover: {
      title: "שאלון אחרי אימון",
      description: "אחרי כל אימון, מלאו את השאלון הזה כדי שנוכל לעקוב אחרי ההתקדמות שלכם.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='nutrition-form']",
    popover: {
      title: "שאלון תזונה",
      description: "שאלון חד-פעמי על הרגלי התזונה שלכם. חובה למלא לפני הפגישה עם התזונאי!",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='streak-card']",
    popover: {
      title: "רצף אימונים",
      description: "כאן תראו את רצף האימונים שלכם. נסו לשמור על רצף ולשבור את השיא האישי!",
      side: "top",
      align: "start",
    },
  },
  {
    popover: {
      title: "אתם מוכנים!",
      description: "זהו! עכשיו אתם מכירים את כל הכלים. בהצלחה באימונים!",
      showButtons: ["close"],
      doneBtnText: "יאללה!",
    },
  },
];
