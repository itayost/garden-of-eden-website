/**
 * Seed the "כושר גופני" (soccer-fitness) category with the "קוד הקונוסים" content.
 *
 * Creates 2 parameters:
 *   1. קוד הקונוסים        — 4 progression drills + premium cards + age ladder
 *   2. מבחני מדדים עונתיים — 2 seasonal test protocols
 *
 * Idempotent: aborts if the parameters already exist.
 * Run:  npx tsx scripts/seed-fitness-kondos.ts [--dry-run]
 */
import { loadEnvLocal, getAdminClient } from "./import-utils";

const CATEGORY_SLUG = "soccer-fitness";

type Phase = { name: string; subtitle?: string; points: string[] };
type Metric = { label: string; before: string; target: string };

interface DrillSeed {
  slug: string;
  nameEn: string;
  nameHe: string;
  setsHe: string;
  whyHe: string;
  howHe: string;
  connectHe: string;
  muscles: string[];
  card?: {
    situationLabel: string;
    subtitle: string;
    levelLabel: string;
    ageMinLabel?: string;
    goldenRule: string;
    phases: Phase[];
    metrics: Metric[];
    failureSteps: string[]; // last one is marked is_final
  };
}

interface AgeRowSeed {
  ageGroup: "U10-12" | "U13-14" | "U15-16" | "U17+";
  whatHe: string;
  metricValueHe: string;
  recoveryHe: string;
}

interface ParamSeed {
  slug: string;
  nameHe: string;
  subtitleHe: string;
  ageMetricLabel: string;
  reportTextHe: string;
  reportHighlightHe: string;
  verbalTextHe: string;
  verbalTipHe: string;
  drills: DrillSeed[];
  ageRows: AgeRowSeed[];
}

const COLOR_CODE_POINTS = [
  "אדום ← אדום: צעדי רדיפה חזקים — עצימות גבוהה, צעדים קצרים ועוצמתיים",
  "ירוק ← ירוק: ריצה קלה — התאוששות פעילה, שמירת מודעות מרחבית",
  "כחול ← כחול: ספרינט + שינוי כיוון — מקסימום עצימות, בלימה וקבלת החלטה",
  "צהוב ← צהוב: הליכה — התאוששות מלאה, נשימה, הכנה לגל הבא",
];

const PARAM_1: ParamSeed = {
  slug: "kondos-code",
  nameHe: "קוד הקונוסים",
  subtitleHe: "כושר תפקודי לפי שפת המשחק",
  ageMetricLabel: "שלב ומיקוד",
  reportTextHe:
    "רוב תוכניות הכושר בכדורגל בנויות על ריצות נפח ארוכות. אבל משחק אמיתי הוא לא ריצה רציפה — הוא סדרה של החלטות: הליכה, ריצה קלה, האצה, בלימה ושינוי כיוון, שוב ושוב. הקושי האמיתי של שחקן הוא לא לרוץ הרבה, אלא להתאושש בין מאמץ למאמץ — לבלום, לשנות כיוון ולחזור לרוץ, דקה אחרי דקה. היום כ-90% מהאימון הוא ריצות נפח ורק כ-10% ספרינטים ושינויי כיוון; היחס צריך לנוע בהדרגה לכיוון 50/50. שיטת קוד הקונוסים מאמנת בדיוק את התבנית הזו.",
  reportHighlightHe:
    "הבסיס האירובי לא נזרק — הוא מה שקובע כמה מהר הילד מתאושש בין ספרינטים.",
  verbalTextHe:
    "קוד הצבעים הוא השפה של האימון. כל צבע קונוס מסמל סוג תנועה אחר: אדום ← אדום — צעדי רדיפה חזקים, עצימות גבוהה. ירוק ← ירוק — ריצה קלה, התאוששות פעילה ושמירה על מודעות מרחבית. כחול ← כחול — ספרינט ושינוי כיוון, מקסימום עצימות, בלימה וקבלת החלטה. צהוב ← צהוב — הליכה, התאוששות מלאה ונשימה לקראת הגל הבא.",
  verbalTipHe:
    "פזרו את הקונוסים בפיזור לא סימטרי ולא צפוי — משחק אמיתי אף פעם לא מסודר. השחקן צריך לסרוק ולהחליט תוך כדי תנועה, לא לשנן רצף קבוע מראש.",
  ageRows: [
    {
      ageGroup: "U10-12",
      whatHe: "ריבוע הצבעים בלבד · 15×15 מ׳, בלי כדור — הטמעת תבנית התנועה",
      metricValueHe: "4 סבבים",
      recoveryHe: "30 שנ׳ בין סבבים",
    },
    {
      ageGroup: "U13-14",
      whatHe: "מוסיפים מסלול פרוץ (10 קונוסים) — שבירת הסדר הקבוע",
      metricValueHe: "3 סבבים × 45 שנ׳",
      recoveryHe: "90 שנ׳",
    },
    {
      ageGroup: "U15-16",
      whatHe: "מוסיפים קריאה חיה — קבלת החלטה תחת עומס",
      metricValueHe: "4 סבבים × 45-50 שנ׳",
      recoveryHe: "90 שנ׳",
    },
    {
      ageGroup: "U17+",
      whatHe: "עם כדור ברגל — ספרינט, בלימה ופנייה של 180°",
      metricValueHe: "3-4 סבבים × 40 שנ׳ · Drop-off מתחת ל-10%",
      recoveryHe: "2 דק׳",
    },
  ],
  drills: [
    {
      slug: "fitness-color-square",
      nameEn: "Color Square",
      nameHe: "ריבוע הצבעים",
      setsHe: "4-6 סבבים · מנוחה 20 שנ׳ · ללא כדור",
      whyHe:
        "הטמעת התבנית הבסיסית — הגוף לומד לזהות צבע ולהגיב באופן אוטומטי, בלי כדור ובלי לחץ זמן.",
      howHe:
        "עוברים בין הקונוסים בסדר קבוע: אדום→אדום (רדיפה), ירוק→ירוק (ריצה קלה), כחול→כחול (ספרינט ושינוי כיוון), צהוב→צהוב (הליכה). חוזרים על הסבב 4-6 פעמים.",
      connectHe:
        "לפני שאתה מגיב נכון במשחק, הגוף צריך לדעת את התנועה בעל פה. כאן בונים את השפה.",
      muscles: ["קואורדינציה", "שינוי כיוון", "בלימה"],
      card: {
        situationLabel: "שלב 1 · יסודות",
        subtitle: "הטמעת תבנית התנועה",
        levelLabel: "יסודות",
        ageMinLabel: "מגיל 10",
        goldenRule:
          "קודם תבנית, אחר כך מהירות. אם הצבע לא מזוהה אוטומטית — אין טעם להוסיף לחץ זמן.",
        phases: [
          {
            name: "הקמה",
            subtitle: "ריבוע 15×15 מ׳",
            points: [
              "4 זוגות קונוסים: אדום, ירוק, כחול, צהוב",
              "ריבוע בגודל כ-15×15 מ׳ — קונוס מכל צבע בכל פינה",
              "שני קונוסים מאותו צבע זה מול זה",
            ],
          },
          { name: "קוד הצבעים", subtitle: "שפת התנועה", points: COLOR_CODE_POINTS },
          {
            name: "ביצוע",
            subtitle: "סדר קבוע",
            points: [
              "עוברים בסדר קבוע: אדום → ירוק → כחול → צהוב",
              "כל מעבר מבוצע לפי התנועה שהצבע מסמל",
              "4-6 סבבים, מנוחה 20 שנ׳ בין סבבים",
            ],
          },
        ],
        metrics: [
          { label: "זיהוי צבע", before: "עצירה למחשבה", target: "תגובה אוטומטית" },
          { label: "יציבות זמן סבב", before: "ירידה מתמדת", target: "±5% בין סבבים" },
        ],
        failureSteps: [
          "הצבע לא מזוהה אוטומטית",
          "השחקן עוצר לחשוב באמצע התנועה",
          "התבנית לא נטמעת — אין בסיס לשלבים הבאים",
        ],
      },
    },
    {
      slug: "fitness-open-course",
      nameEn: "Open Course",
      nameHe: "מסלול פרוץ",
      setsHe: "3-4 סבבים של 45-60 שנ׳ · מנוחה 60-90 שנ׳ · ללא כדור",
      whyHe:
        "שבירת הסדר הקבוע — קונוסים מפוזרים באקראי בכל השטח, מדמים את חוסר הסדר של משחק אמיתי.",
      howHe:
        "השחקן בונה מסלול משלו — עובר על כל הקונוסים לפי צבעם, אך בוחר את סדר הביקור. כל מעבר בין קונוסים מאותו צבע מבוצע לפי התנועה שהצבע מסמל.",
      connectHe: "במשחק אף אחד לא מסדר לך את המסלול. אתה סורק, בוחר, ורץ.",
      muscles: ["שינוי כיוון", "מודעות מרחבית", "סיבולת אנאירובית"],
      card: {
        situationLabel: "שלב 2 · תבנית משחק",
        subtitle: "שבירת הסדר הקבוע",
        levelLabel: "תבנית משחק",
        ageMinLabel: "מגיל 13",
        goldenRule:
          "אם השחקן משנן רצף קבוע — הפיזור צפוי מדי. פזרו את הקונוסים מחדש.",
        phases: [
          {
            name: "הקמה",
            subtitle: "שטח כ-30×20 מ׳",
            points: [
              "10-14 קונוסים, בערך 3 מכל צבע",
              "פיזור ללא סדר גיאומטרי — לא בשורות",
              "מרחקים משתנים של 5-20 מטר",
            ],
          },
          {
            name: "ביצוע",
            subtitle: "השחקן בוחר את המסלול",
            points: [
              "השחקן עובר על כל הקונוסים לפי צבעם",
              "הוא בוחר בעצמו את סדר הביקור",
              "3-4 סבבים של 45-60 שנ׳, מנוחה 60-90 שנ׳",
            ],
          },
        ],
        metrics: [
          { label: "Drop-off בין סבב ראשון לאחרון", before: "15-20%", target: "מתחת ל-10%" },
          { label: "יציבות זמן סבב", before: "ירידה מתמדת", target: "±5%" },
        ],
        failureSteps: [
          "מנוחה קצרה מדי בין סבבים",
          "הזמנים מתדרדרים והבלימה מתרשלת",
          "דפוס תנועה גרוע — עדיף לקצר את הסט ולשמור על איכות",
        ],
      },
    },
    {
      slug: "fitness-live-read",
      nameEn: "Live Read",
      nameHe: "קריאה חיה",
      setsHe: "4 סבבים של 40-50 שנ׳ · מנוחה מלאה 90 שנ׳+ · ללא כדור",
      whyHe:
        "הוספת שכבת אי-ודאות — בדיוק כמו במשחק, השחקן לא יודע מראש לאן ירוץ. זה מפתח חשיבה מהירה תחת עומס פיזי.",
      howHe:
        "המאמן קורא בקול צבע (או מצביע) ברגע שהשחקן מתקרב לצומת החלטה. השחקן חייב להגיב תוך פחות משנייה ולבצע את התנועה המתאימה. קריאות בקצב לא סדיר, כולל מעבר פתאומי מספרינט להליכה.",
      connectHe:
        "הכדור מגיע בלי להודיע. ההחלטה נופלת תוך שנייה — גם כשאתה כבר עייף.",
      muscles: ["קבלת החלטה", "זמן תגובה", "שינוי כיוון"],
      card: {
        situationLabel: "שלב 3 · קבלת החלטה",
        subtitle: "החלטה תחת עומס",
        levelLabel: "קבלת החלטה",
        ageMinLabel: "מגיל 15",
        goldenRule:
          "קראו בקצב לא סדיר, כולל הפתעות — מעבר ישיר מספרינט להליכה. אם השחקן יכול לנחש מה בא — זה כבר לא אימון החלטה.",
        phases: [
          {
            name: "הקמה",
            subtitle: "אותו מסלול פרוץ",
            points: [
              "אותו מסלול פרוץ משלב 2",
              "מאמן או שותף עומד בצד עם ראות לכל השטח",
            ],
          },
          {
            name: "ביצוע",
            subtitle: "תגובה תוך פחות משנייה",
            points: [
              "המאמן קורא צבע ברגע שהשחקן מתקרב לצומת החלטה",
              "השחקן מגיב תוך פחות משנייה ומבצע את התנועה",
              "4 סבבים של 40-50 שנ׳, מנוחה מלאה 90 שנ׳+",
            ],
          },
          {
            name: "איך מודדים",
            subtitle: "סטופר ומחברת מספיקים",
            points: [
              "סטופר על כל סבב מלא",
              "השוואת זמן סבב 1 לסבב האחרון (Drop-off)",
              "תצפית ויזואלית על איכות הבלימה",
            ],
          },
        ],
        metrics: [
          { label: "זמן תגובה לקריאה", before: "מעל שנייה", target: "מתחת לשנייה" },
          { label: "Drop-off בין סבבים", before: "15% ומעלה", target: "מתחת ל-10%" },
        ],
        failureSteps: [
          "התגובה לקריאה איטית מדי",
          "השחקן מגיע לצומת בלי החלטה",
          "מאבד את הרגע — בדיוק כמו במשחק",
        ],
      },
    },
    {
      slug: "fitness-with-ball",
      nameEn: "With The Ball",
      nameHe: "עם כדור ברגל",
      setsHe: "3-4 סבבים של 40 שנ׳ · מנוחה מלאה 2 דק׳ · עם כדור",
      whyHe:
        "הספציפיות הגבוהה ביותר — התרגיל שמדמה בדיוק את הרגע: ספרינט עם כדור ואז הצורך לבלום ולחזור אחורה.",
      howHe:
        "זהה לקריאה חיה, אך: כחול = ספרינט עם כדור עד הקונוס הבא, עצירה מבוקרת ופנייה של 180° (כאילו חוזרים אחורה להגנה). ירוק = ריצה קלה עם כדור. אדום = רדיפה או הליכה מהירה בלי כדור.",
      connectHe:
        "זה בדיוק הרגע שאתה מאבד כדור בהתקפה וצריך לבלום ולחזור אחורה להגנה.",
      muscles: ["ספרינט", "בלימה", "שינוי כיוון", "סיבולת אנאירובית"],
      card: {
        situationLabel: "שלב 4 · סימולציית משחק",
        subtitle: "ספרינט עם כדור, בלימה וחזרה אחורה",
        levelLabel: "סימולציית משחק",
        ageMinLabel: "מגיל 16",
        goldenRule:
          "ברגע העצירה: כפיפת ברך, מרכז כובד נמוך, כתפיים מעל הברכיים. זה בדיוק המרכיב שרוב תוכניות הכושר מזניחות — וזה מה שפותר את הקושי לחזור אחורה.",
        phases: [
          {
            name: "הקמה",
            subtitle: "אותו מסלול, עם כדור",
            points: [
              "אותו מסלול פרוץ משלב 2, עם כדור",
              "קטעי כחול מבוצעים תמיד עם הכדור צמוד לרגל",
            ],
          },
          {
            name: "ביצוע",
            subtitle: "ספרינט ← בלימה ← 180°",
            points: [
              "כחול = ספרינט עם כדור, עצירה מבוקרת ופנייה של 180°",
              "ירוק = ריצה קלה עם כדור",
              "אדום = רדיפה בלי כדור (עבודה בלי הכדור)",
              "3-4 סבבים של 40 שנ׳, מנוחה מלאה 2 דק׳",
            ],
          },
          {
            name: "טכניקת בלימה",
            subtitle: "המרכיב שמזניחים",
            points: [
              "כפיפת ברך",
              "מרכז כובד נמוך",
              "כתפיים מעל הברכיים",
              "בלי החלקה — ברך יציבה",
            ],
          },
        ],
        metrics: [
          {
            label: "איכות בלימה",
            before: "ברך נכנסת פנימה, החלקה",
            target: "ברך יציבה, כתפיים מעל הברכיים",
          },
          { label: "חזרה אחורה אחרי ספרינט", before: "איטית וכבדה", target: "פנייה 180° מיידית" },
          { label: "Drop-off בין סבבים", before: "15% ומעלה", target: "מתחת ל-10%" },
        ],
        failureSteps: [
          "בלימה בברך ישרה, מרכז כובד גבוה",
          "החלקה ואיבוד שיווי משקל",
          "פציעה — ובמשחק, יריב שכבר ברח",
        ],
      },
    },
  ],
};

const PARAM_2: ParamSeed = {
  slug: "seasonal-fitness-tests",
  nameHe: "מבחני מדדים עונתיים",
  subtitleHe: "פרוטוקול בדיקה — לא חלק מהאימון השבועי",
  ageMetricLabel: "תדירות והתאמה",
  reportTextHe:
    "1600 מ׳ ו-400 מ׳ הן ריצות ישרות שלא מדמות תנועת משחק — ולכן הן לא נכנסות לאימון השבועי הרגיל. השימוש בהן הוא ככלי מדידה בלבד, במרווחים קבועים לאורך העונה, כדי לראות שיפור אובייקטיבי.",
  reportHighlightHe: "אלה מבחנים, לא אימונים. המטרה היא למדוד התקדמות — לא לצבור נפח.",
  verbalTextHe:
    "המבחן הוא לא האימון. פעמיים בעונה אנחנו עוצרים, מודדים, ובודקים אם העבודה באמת עובדת.",
  verbalTipHe:
    "במבחן 400 מ׳ מה שחשוב הוא לא החזרה הראשונה — אלא כמה שמרת על הזמן בחזרה האחרונה.",
  ageRows: [
    {
      ageGroup: "U10-12",
      whatHe: "לא מבצעים מבחני נפח — בגיל הזה מתמקדים בתבנית תנועה",
      metricValueHe: "—",
      recoveryHe: "—",
    },
    {
      ageGroup: "U13-14",
      whatHe: "מבחן 1600 מ׳ בלבד",
      metricValueHe: "פעם בעונה · זמן כולל",
      recoveryHe: "—",
    },
    {
      ageGroup: "U15-16",
      whatHe: "1600 מ׳ + 400 מ׳ בפריסיזון",
      metricValueHe: "1600: 2× בעונה · 400: זמן לכל חזרה",
      recoveryHe: "90 שנ׳ - 2 דק׳ בין חזרות",
    },
    {
      ageGroup: "U17+",
      whatHe: "1600 מ׳ (2× בעונה) + 400 מ׳ (4-6 חזרות)",
      metricValueHe: "Drop-off מתחת ל-10%",
      recoveryHe: "2 דק׳ בין חזרות",
    },
  ],
  drills: [
    {
      slug: "fitness-test-1600m",
      nameEn: "1600m Test",
      nameHe: "מבחן 1600 מ׳",
      setsHe: "פעמיים בעונה · מדידת זמן כולל",
      whyHe:
        "הערכת כושר אירובי בסיסי (VO2max) — התשתית שקובעת כמה מהר השחקן מתאושש בין ספרינטים.",
      howHe:
        "ריצה על מסלול מדוד (מגרש אתלטיקה או מסלול קבוע), במאמץ מקסימלי יציב לכל האורך. מודדים זמן כולל. פעמיים בעונה בלבד: בתחילת העונה (baseline) ובאמצעה.",
      connectHe: "זה לא מדמה משחק — אבל זה הבסיס שקובע כמה גלים תחזיק עד הדקה ה-90.",
      muscles: ["סיבולת אירובית"],
      card: {
        situationLabel: "בדיקת בסיס אירובי",
        subtitle: "פעמיים בעונה",
        levelLabel: "מבחן",
        goldenRule: "לא חוזר שבועית. זה כלי מדידה — לא אימון.",
        phases: [
          {
            name: "ביצוע",
            subtitle: "מאמץ מקסימלי יציב",
            points: [
              "מסלול מדוד — מגרש אתלטיקה או מסלול קבוע",
              "מאמץ מקסימלי יציב לכל האורך",
              "מדידת זמן כולל",
            ],
          },
        ],
        metrics: [
          {
            label: "זמן כולל",
            before: "baseline בתחילת העונה",
            target: "ירידה בזמן באמצע העונה",
          },
        ],
        failureSteps: [
          "יוצאים מהר מדי בהתחלה",
          "קריסה במחצית השנייה",
          "הזמן לא משקף את הכושר האמיתי",
        ],
      },
    },
    {
      slug: "fitness-test-400m",
      nameEn: "400m Test",
      nameHe: "מבחן 400 מ׳",
      setsHe: "4-6 חזרות · מנוחה 90 שנ׳-2 דק׳ · פריסיזון בלבד",
      whyHe:
        "מדידת היכולת לספוג חומצת חלב ולהתאושש ממנה במאמצים חוזרים — רלוונטי יותר לכדורגל מריצת נפח, אך עדיין לא מדמה תנועת משחק.",
      howHe:
        "4-6 חזרות של 400 מ׳ במאמץ גבוה, עם מנוחה של 90 שניות עד 2 דקות בין חזרות. מודדים את הזמן בכל חזרה ועוקבים אחרי ה-Drop-off.",
      connectHe: "החזרה האחרונה מספרת את האמת — כמה נשאר בך בדקה ה-85.",
      muscles: ["סיבולת אנאירובית"],
      card: {
        situationLabel: "בדיקת סיבולת לקטית",
        subtitle: "4-6 חזרות · פריסיזון",
        levelLabel: "מבחן",
        goldenRule: "המדד הוא ה-Drop-off, לא החזרה הראשונה.",
        phases: [
          {
            name: "ביצוע",
            subtitle: "4-6 חזרות",
            points: [
              "4-6 חזרות של 400 מ׳ במאמץ גבוה",
              "מנוחה של 90 שניות עד 2 דקות בין חזרות",
              "מדידת זמן בכל חזרה",
            ],
          },
        ],
        metrics: [
          {
            label: "Drop-off בין חזרה ראשונה לאחרונה",
            before: "מעל 10%",
            target: "מתחת ל-10%",
          },
        ],
        failureSteps: [
          "חזרה ראשונה מהירה מדי",
          "Drop-off גדול בחזרות האחרונות",
          "סיבולת לקטית לא מספקת — הבסיס צריך עבודה",
        ],
      },
    },
  ],
};

const PARAMS = [PARAM_1, PARAM_2];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  loadEnvLocal();
  const db = getAdminClient();

  console.log(`=== seed-fitness-kondos ${dryRun ? "(DRY RUN)" : "(LIVE)"} ===\n`);

  // 1. Category
  const { data: cat } = await db
    .from("book_categories")
    .select("id, name_he")
    .eq("slug", CATEGORY_SLUG)
    .maybeSingle();
  if (!cat) throw new Error(`Category ${CATEGORY_SLUG} not found`);
  console.log(`category: ${cat.name_he} (${cat.id})`);

  // 2. Idempotency guard
  const { data: existing } = await db
    .from("book_parameters")
    .select("slug")
    .in("slug", PARAMS.map((p) => p.slug));
  if ((existing ?? []).length > 0) {
    console.log(`\nAlready seeded (${(existing ?? []).map((e) => e.slug).join(", ")}). Aborting.`);
    return;
  }

  // 3. Next parameter number
  const { data: allParams } = await db.from("book_parameters").select("number");
  let nextNumber = Math.max(0, ...(allParams ?? []).map((p) => p.number ?? 0)) + 1;

  // 4. Muscles: reuse existing by name, create missing
  const wantedMuscles = [
    ...new Set(PARAMS.flatMap((p) => p.drills.flatMap((d) => d.muscles))),
  ];
  const { data: existingMuscles } = await db.from("book_muscles").select("id, name_he");
  const muscleIdByName = new Map<string, string>(
    (existingMuscles ?? []).map((m) => [m.name_he.trim(), m.id])
  );
  const missing = wantedMuscles.filter((m) => !muscleIdByName.has(m));
  console.log(`muscles: ${wantedMuscles.length} needed, ${missing.length} to create → ${missing.join(", ") || "none"}`);

  if (dryRun) {
    for (const p of PARAMS) {
      console.log(`\nparameter #${nextNumber++} ${p.nameHe} [${p.slug}]`);
      console.log(`  drills:   ${p.drills.length} (${p.drills.map((d) => d.nameHe).join(", ")})`);
      console.log(`  cards:    ${p.drills.filter((d) => d.card).length}`);
      console.log(`  ageRows:  ${p.ageRows.length}`);
    }
    console.log("\nDry run — no writes.");
    return;
  }

  // create missing muscles
  let orderIdx = (existingMuscles ?? []).length;
  for (const name of missing) {
    const { data: created, error } = await db
      .from("book_muscles")
      .insert({ name_he: name, order_index: orderIdx++ })
      .select("id")
      .single();
    if (error || !created) throw new Error(`muscle insert failed (${name}): ${error?.message}`);
    muscleIdByName.set(name, created.id);
  }

  let drillCount = 0;
  let cardCount = 0;
  let ageCount = 0;
  let linkCount = 0;

  for (const [pIdx, p] of PARAMS.entries()) {
    const { data: param, error: pErr } = await db
      .from("book_parameters")
      .insert({
        category_id: cat.id,
        number: nextNumber++,
        slug: p.slug,
        name_he: p.nameHe,
        subtitle_he: p.subtitleHe,
        order_index: pIdx,
        is_all_positions: true,
        age_metric_label: p.ageMetricLabel,
        report_text_he: p.reportTextHe,
        report_highlight_he: p.reportHighlightHe,
        verbal_text_he: p.verbalTextHe,
        verbal_tip_he: p.verbalTipHe,
      })
      .select("id, number")
      .single();
    if (pErr || !param) throw new Error(`parameter insert failed (${p.slug}): ${pErr?.message}`);
    console.log(`\n#${param.number} ${p.nameHe}`);

    // age rows
    for (const [i, r] of p.ageRows.entries()) {
      const { error } = await db.from("book_age_rows").insert({
        parameter_id: param.id,
        age_group: r.ageGroup,
        what_he: r.whatHe,
        metric_value_he: r.metricValueHe,
        recovery_he: r.recoveryHe,
        order_index: i,
      });
      if (error) throw new Error(`age row failed: ${error.message}`);
      ageCount++;
    }

    // drills
    for (const [i, d] of p.drills.entries()) {
      const { data: drill, error: dErr } = await db
        .from("book_drills")
        .insert({
          parameter_id: param.id,
          slug: d.slug,
          name_en: d.nameEn,
          name_he: d.nameHe,
          sets_he: d.setsHe,
          how_he: d.howHe,
          why_he: d.whyHe,
          connect_he: d.connectHe,
          order_index: i,
        })
        .select("id")
        .single();
      if (dErr || !drill) throw new Error(`drill insert failed (${d.slug}): ${dErr?.message}`);
      drillCount++;
      console.log(`   - ${d.nameHe}`);

      // muscle links
      for (const m of d.muscles) {
        const mid = muscleIdByName.get(m);
        if (!mid) throw new Error(`muscle id missing for ${m}`);
        const { error } = await db
          .from("book_drill_muscles")
          .insert({ drill_id: drill.id, muscle_id: mid });
        if (error) throw new Error(`muscle link failed: ${error.message}`);
        linkCount++;
      }

      // premium card
      if (!d.card) continue;
      const c = d.card;
      const { data: card, error: cErr } = await db
        .from("book_drill_cards")
        .insert({
          drill_id: drill.id,
          situation_label_he: c.situationLabel,
          subtitle_he: c.subtitle,
          level_label: c.levelLabel,
          age_min_label: c.ageMinLabel ?? null,
          golden_rule_he: c.goldenRule,
        })
        .select("id")
        .single();
      if (cErr || !card) throw new Error(`card insert failed (${d.slug}): ${cErr?.message}`);
      cardCount++;

      for (const [fi, f] of c.failureSteps.entries()) {
        const { error } = await db.from("book_drill_card_failure_steps").insert({
          card_id: card.id,
          text_he: f,
          is_final: fi === c.failureSteps.length - 1,
          order_index: fi,
        });
        if (error) throw new Error(`failure step failed: ${error.message}`);
      }

      for (const [phi, ph] of c.phases.entries()) {
        const { data: phase, error: phErr } = await db
          .from("book_drill_card_phases")
          .insert({
            card_id: card.id,
            number: phi + 1,
            name_he: ph.name,
            subtitle_he: ph.subtitle ?? null,
            order_index: phi,
          })
          .select("id")
          .single();
        if (phErr || !phase) throw new Error(`phase failed: ${phErr?.message}`);
        for (const [pti, pt] of ph.points.entries()) {
          const { error } = await db.from("book_drill_card_phase_points").insert({
            phase_id: phase.id,
            text_he: pt,
            order_index: pti,
          });
          if (error) throw new Error(`phase point failed: ${error.message}`);
        }
      }

      for (const [mi, m] of c.metrics.entries()) {
        const { error } = await db.from("book_drill_card_metrics").insert({
          card_id: card.id,
          label_he: m.label,
          before_he: m.before,
          target_he: m.target,
          order_index: mi,
        });
        if (error) throw new Error(`metric failed: ${error.message}`);
      }
    }
  }

  console.log(
    `\nDone. parameters: ${PARAMS.length} · drills: ${drillCount} · cards: ${cardCount} · age rows: ${ageCount} · muscle links: ${linkCount}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
