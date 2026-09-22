# כמה מאמנים לשעת אימון

תאריך: 2026-09-22
סטטוס: מאושר לתכנון יישום

## הבעיה

`daily_schedule_slots.trainer_id` ו-`weekly_schedule_bands.trainer_id` מחזיקים מאמן
אחד. עדן ביקשה להוסיף מאמן נוסף לשעת אימון, ובקריית אתא, שהיא אימון קבוצתי, זה
המצב הרגיל ולא החריג.

## ההחלטה

טבלת קישור לכל אחת מהשתיים, בלי תקרה, ובלי מאמן "ראשי". יש ראשון לפי **סדר** ולא
לפי תפקיד, וזה מה שנותן לכרטיס את הצבע. העמודות הישנות נמחקות, כדי שיהיה מקור אמת
אחד לשאלה מי מאמן כאן.

נשקל ונדחה: עמודה שנייה (`second_trainer_id`) פותרת שניים ולא שלושה, ושמירת
`trainer_id` לצד הטבלה יוצרת שני מקורות אמת לאותה שאלה.

## מודל הנתונים

```sql
CREATE TABLE public.daily_schedule_slot_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.daily_schedule_slots(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  trainer_name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_slot_trainers_unique
  ON public.daily_schedule_slot_trainers (slot_id, trainer_id) WHERE trainer_id IS NOT NULL;
CREATE INDEX idx_slot_trainers_slot
  ON public.daily_schedule_slot_trainers (slot_id, order_index);
CREATE INDEX idx_slot_trainers_trainer
  ON public.daily_schedule_slot_trainers (trainer_id) WHERE trainer_id IS NOT NULL;
```

ואותה טבלה בדיוק ל-`weekly_schedule_band_trainers` עם `band_id`.

`trainer_id` **nullable עם ON DELETE SET NULL**, לא NOT NULL עם CASCADE. זה לא פרט
טכני: התיעוד ב-`resolveTrainerName` אומר שה-snapshot של השם קיים כדי להשאיר את הלוח
קריא אחרי שמאמן שונה שמו או נמחק. NOT NULL עם CASCADE היה מוחק את השורה והשם היה
נעלם איתה.

### שינוי התנהגות מכוון

היום `daily_schedule_slots.trainer_id` הוא `ON DELETE SET NULL` והסלוט שורד, אבל
`weekly_schedule_bands.trainer_id` הוא `ON DELETE CASCADE`: **מחיקת מאמן מוחקת את כל
הרצועות שלו מהשבוע הקבוע.** אחרי השינוי שתי הטבלאות מתנהגות אותו דבר, ומחיקת מאמן
משאירה רצועה יתומה עם שם ובלי מזהה, במקום להעלים אותה. אושר במפורש.

### גיבוי ומחיקת העמודות

```sql
INSERT INTO public.weekly_schedule_band_trainers (band_id, trainer_id, trainer_name, order_index)
SELECT id, trainer_id, trainer_name, 0 FROM public.weekly_schedule_bands;

INSERT INTO public.daily_schedule_slot_trainers (slot_id, trainer_id, trainer_name, order_index)
SELECT id, trainer_id, trainer_name, 0 FROM public.daily_schedule_slots
WHERE trainer_id IS NOT NULL;

ALTER TABLE public.weekly_schedule_bands DROP COLUMN trainer_id, DROP COLUMN trainer_name;
ALTER TABLE public.daily_schedule_slots DROP COLUMN trainer_id, DROP COLUMN trainer_name;
```

נתונים: 34 רצועות, כולן עם מאמן. 267 סלוטים, מהם 9 בלי מאמן שפשוט לא מקבלים שורה,
ואפס שיש להם מזהה בלי שם.

RLS, בדיוק כמו טבלת האב של כל אחת:

- `daily_schedule_slot_trainers` מקבלת מדיניות `FOR ALL` לצוות פעיל, בצורה של
  `schedule_slot_trainees_staff_write`, ו-SELECT לכל צוות בצורת
  `schedule_slot_trainees_staff_select`.
- `weekly_schedule_band_trainers` מקבלת SELECT לצוות ו-INSERT/UPDATE/DELETE
  לאדמין פעיל בלבד, בצורת `weekly_bands_admin_*`. רצועה היא החלטה של אדמין היום
  והיא נשארת כזו.

## מה נגזר מזה

**צבע.** `trainerColor()` מקבל את המאמן הראשון בסדר. הזהות הוויזואלית שורדת ושני
סלוטים באותה שעה עדיין נבדלים. כרטיס בלי מאמנים מקבל את הפלטה הנייטרלית, כמו היום.

**מי במשמרת.** `deriveOnDuty()` מוריד היום רצועה כשהמאמן שלה נעדר
(`!absentTrainerIds.has(band.trainer_id)`). מעכשיו הוא מוריד אותה רק כשכל מאמניה
נעדרים, ומציג את הנותרים. `expectedTrainerIds`, שמחליט אילו היעדרויות שוות הצגה,
נבנה מכל מאמני הרצועות של אותו יום.

**`OnDutyBand`.** נושא היום `trainerId` ו-`trainerName` יחידים, והוא משותף לרצועות
ולחריגים. חריג באמת מחזיק מאמן אחד (`weekly_schedule_exceptions.trainer_id` הוא NOT
NULL ואינו משתנה), אז הצורה נעשית `trainers: { id: string | null; name: string }[]`
ומחריג יוצא מערך באורך אחד. צורה אחת לשניהם, בלי ענף.

**"רק שלי".** `filterWorklist` בודק היום `group.trainerId === currentUserId`. מעכשיו
סלוט הוא שלי אם אני אחד ממאמניו.

**מימוש.** `materialize.ts` ו-`daily-schedule-build.ts` מעתיקים את רשימת המאמנים של
הרצועה לסלוט, על הסדר.

**טקסט הוואטסאפ.** `schedule-text.ts` מדפיס את כל השמות מופרדים בפסיק במקום שם אחד.
סלוט בלי מאמנים מתנהג כמו היום.

**מיון.** `compareSlots` ב-`session-worklist.ts` ו-`byStartThenName` שוברים שוויון
לפי שם המאמן. מעכשיו לפי שם המאמן הראשון, וסלוט בלי מאמנים ממוין כמחרוזת ריקה.

## טפסים

`SlotFormDialog` ו-`BandFormDialog` מחליפים `Select` יחיד בבורר רב ערכי. הבסיס
הקיים הוא `BranchCheckboxGroup` מ-`src/features/branches/components/`, שכבר עושה
בדיוק את זה לסניפים, והסדר הוא סדר הבחירה.

`SlotFormDialog` מציע היום מאמן לפי `trainersAtTime(onDuty, time)` כשיש בדיוק אחד
מתאים. ההצעה נשארת, ומעכשיו היא מסמנת את כל המאמנים שהשבוע הקבוע שם על השעה הזאת.

סכימות ה-Zod עוברות מ-`trainerId` יחיד ל-`trainerIds: z.array(uuidSchema).max(10)`,
בלי מינימום: סלוט בלי מאמן חוקי היום ונשאר חוקי.

## מה לא משתנה

משמרות אינן נגזרות מרצועות: `trainer_shifts` ו-`/api/shifts/sync` לא נוגעים ב-
`weekly_schedule_bands` בכלל. `weekly_schedule_exceptions.trainer_id` נשאר יחיד, כי
היעדרות והוספה חד פעמית שייכות למאמן אחד לפי הגדרה.

## בדיקות

- `deriveOnDuty()`: רצועה עם שני מאמנים שאחד מהם נעדר מוצגת עם הנותר; עם שניהם
  נעדרים אינה מוצגת; היעדרות של מי שאינו מאמן של אף רצועה באותו יום אינה מוצגת.
- `filterWorklist()`: "רק שלי" תופס את המאמן השני.
- `buildScheduleWhatsAppText()`: שני שמות, שם אחד, ואפס.
- `compareSlots`: מיון לפי שם המאמן הראשון, וסלוט בלי מאמנים.
- אחרי המיגרציה: `npm run db:types` ו-`npm run db:schema`.
- תרחיש מול המסד בטרנזקציה עם ROLLBACK: רצועה עם שני מאמנים מתממשת לסלוט עם שניהם,
  ומחיקת אחד המאמנים משאירה את הרצועה עם השני.

## סדר העלאה: שתי מיגרציות, לא אחת

מחיקת העמודות באותה מיגרציה שיוצרת את הטבלאות הייתה מחייבת את המיגרציה ואת הפריסה
לצאת יחד, ומשאירה חלון שבו אחד מהשניים שבור. אין צורך: מפצלים.

1. **מיגרציה א'** יוצרת את שתי טבלאות הקישור ומגבה אליהן, **ומשאירה את העמודות
   הישנות במקומן**. הקוד שרץ בפרודקשן באותו רגע עדיין קורא `trainer_id`, שעדיין שם,
   וממשיך לעבוד בלי לדעת שקרה משהו.
2. **פריסה** של הקוד החדש, שקורא וכותב את טבלאות הקישור. העמודות הישנות עדיין
   קיימות ומעכשיו מתיישנות, וזה בסדר כי איש לא קורא אותן.
3. **מיגרציה ב'** מגבה שוב עם `ON CONFLICT DO NOTHING`, ואז מוחקת את העמודות.
   הגיבוי החוזר סוגר את החלון היחיד שנשאר: סלוט שנוצר בין שלב 1 לשלב 2 נכתב על ידי
   הקוד הישן לעמודה ובלי שורת קישור, ובלעדיו היה נראה מעכשיו כסלוט בלי מאמן.

החלון נסגר לגמרי, במחיר מיגרציה שנייה.
