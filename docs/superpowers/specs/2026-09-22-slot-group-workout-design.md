# אימון קבוצתי לסלוט

תאריך: 2026-09-22
סטטוס: מאושר לתכנון יישום

## הבעיה

קריית אתא היא אימון קבוצתי: המתאמנים נרשמים בעצמם לסלוט עם `max_trainees`, וכל מי
שנרשם עושה את אותו אימון. המודל היום הוא אימון לכל מתאמן ליום, עם
`UNIQUE (trainee_id, session_date)` על `training_sessions`, ואין שום ישות של אימון
ברמת הסלוט. עדן פותחת סלוט ביומן, רואה רשימת שמות, ואין לה שום דרך לכתוב את
האימון של השעה הזאת פעם אחת.

המצב הזה דווח כ"אני לא מצליח להוסיף תרגילים לסלוט בקריית אתא". זה לא באג בקוד
קיים אלא פער בפיצ'ר.

## אילוץ מכריע

`exercise_logs.session_exercise_id` מצביע על `training_session_exercises`, ומדיניות
`training_session_exercises_trainee_select_own` נותנת למתאמן לקרוא רק תרגילים של
אימון שהוא הבעלים שלו. המתאמנים צריכים לראות את האימון באפליקציה ולדווח ביצועים,
ולכן לכל רשום חייבת להיות רשומת `training_sessions` משלו. כל מודל שבו האימון חי רק
על הסלוט נפסל על הסף.

## ההחלטה

האימון הקבוצתי נשמר על הסלוט והוא מקור האמת, ונפרס לאימונים אישיים. מי שערך אימון
של מתאמן בודד חורג מהקבוצה, והעדכון הקבוצתי הבא מדלג עליו.

גישות שנשקלו ונדחו:

- **כפתור "העתק לכל הקבוצה" בלי טבלה חדשה.** הכי זול, אבל אין תשובה לשאלה "מה
  האימון של הסלוט הזה": מי שנרשם אחרי ההעתקה לא מקבל כלום, ועריכה אומרת להעתיק
  שוב ולדרוס ידנית.
- **המתאמן קורא ישירות מהסלוט.** דורש לשכתב את נתיב הקריאה של המתאמן, את ה-RLS
  ואת הקישור של דיווחי הביצועים, ומפצל את נתיב הקריאה לשניים.

## מודל הנתונים

### טבלה חדשה: `slot_workout_exercises`

משקפת את `training_session_exercises` פחות `session_id`, כולל אותם CHECK
constraints על היעדים, כדי שמה שנשמר בקבוצה לא יוכל להיפסל בפריסה.

```sql
create table public.slot_workout_exercises (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references daily_schedule_slots(id) on delete cascade,
  exercise_id uuid not null references workout_exercises(id) on delete cascade,
  order_index int not null default 0,
  target_sets int,
  target_reps_he text,
  target_load_he text,
  target_reps int,
  target_weight_kg numeric(5,2),
  target_duration_seconds int,
  target_distance_m int,
  notes_he text,
  constraint slot_workout_exercises_targets_range check (
    (target_reps is null or target_reps between 1 and 999)
    and (target_weight_kg is null or target_weight_kg between 0 and 500)
    and (target_duration_seconds is null or target_duration_seconds between 1 and 86400)
    and (target_distance_m is null or target_distance_m between 1 and 100000)
  )
);
create index idx_slot_workout_exercises_slot
  on public.slot_workout_exercises (slot_id, order_index);
```

RLS: קריאה וכתיבה לצוות בלבד, באותה צורה של
`training_session_exercises_staff_all`. אין מדיניות למתאמן, כי המתאמן קורא את
העותק האישי שלו ולא את הסלוט.

### עמודות חדשות על `daily_schedule_slots`

```sql
alter table public.daily_schedule_slots
  add column workout_notes_he text,
  add column workout_built_by uuid references profiles(id),
  add column workout_built_by_name text,
  add column workout_updated_at timestamptz;

alter table public.daily_schedule_slots
  add constraint slot_workout_notes_length check (char_length(workout_notes_he) <= 300);
```

`workout_built_by` ו-`workout_built_by_name` אינם נוחות. `training_sessions.built_by`
הוא NOT NULL, וכשמתאמן נרשם בעצמו ומקבל את האימון הקבוצתי אין שום איש צוות בבקשה.
הזקיפה הולכת למי שכתב את האימון הקבוצתי, וזה גם נכון עובדתית.

### עמודה חדשה על `training_sessions`

```sql
alter table public.training_sessions add column slot_workout_synced_at timestamptz;
```

לא NULL אומר "האימון הזה נכתב על ידי הקבוצה ואיש לא נגע בו אישית מאז". שמירה
מ-`upsertSessionAction` (מסך האימון האישי) מאפסת אותה ל-NULL. תאריך ולא enum, כי
הוא נושא גם את "מתי" בלי עמודה נוספת.

## פריסה

שמירה של אימון קבוצתי היא גם הפריסה. אין כפתור "החל" נפרד: אימון קבוצתי שנשמר
ולא הגיע לאיש הוא בדיוק המצב שבגללו נפסלה גישת ההעתקה.

### הפונקציה

`apply_slot_workout(p_slot_id uuid)`, plpgsql, **בלי** SECURITY DEFINER, עם
`grant execute to authenticated`. ה-RLS הקיים על `training_sessions` נשאר השומר,
כמו ב-`replace_session_exercises`. מחזירה ספירה לכל קטגוריה.

לכל רשום פעיל ומקושר בסלוט (`cancelled_at is null and trainee_id is not null`):

| מצב | פעולה |
|---|---|
| אין לו אימון באותו יום | `create`: אימון חדש, `slot_workout_synced_at = now()` |
| יש אימון מהסלוט הזה, לא הושלם, `synced_at` לא NULL | `refresh`: התרגילים נכתבים מחדש |
| `synced_at` NULL | `skip_custom` |
| `completed_at` לא NULL | `skip_completed` |
| האימון שלו באותו יום שייך לסלוט אחר | `skip_other_slot` |

אימון שנוצר בפריסה מקבל `slot_id` של הסלוט, ו-`built_by` ו-`built_by_name`
מ-`workout_built_by` ו-`workout_built_by_name` שלו. ב-`refresh` נכתבים מחדש גם
התרגילים וגם `notes_he` מ-`workout_notes_he`, והזקיפה נשארת של מי שכתב את האימון
הקבוצתי ולא של מי שלחץ שמור.

רשימת התרגילים הקבוצתית עוברת את `sessionExerciseSchema` ואת
`MAX_EXERCISES_PER_SESSION` (40), אותה סכימה של אימון אישי.

### מחיקת האימון הקבוצתי

שמירה של רשימה ריקה היא מחיקת האימון הקבוצתי, ולא שגיאה כמו במסך האישי. היא
מוחקת את שורות `slot_workout_exercises`, מאפסת את ארבע עמודות ה-workout על
הסלוט, ומוחקת את האימונים שנפרסו ממנו לפי אותו תנאי של ביטול: רק
`slot_workout_synced_at` לא NULL ו-`completed_at` NULL. המסך מבקש אישור לפני,
ואומר כמה מתאמנים יאבדו את האימון.

### הרשמה מאוחרת

מי שנרשם אחרי שהאימון נבנה מקבל אותו ברגע ההרשמה. פונקציה קטנה משותפת,
`apply_slot_workout_to_trainee(p_slot_id uuid, p_trainee_id uuid)`, נקראת משני
מקומות:

- מתוך `book_slot`, באותה טרנזקציה, אחרי שהמקום נתפס. `book_slot` כבר
  SECURITY DEFINER, אז היא כותבת את האימון בלי ש-RLS של מתאמן יחסום.
- מ-`addSlotTraineeAction`, כשאיש צוות מוסיף מתאמן לרשימה. שם הקריאה רצה על
  הלקוח של המשתמש, ו-RLS של צוות מתיר את הכתיבה, ולכן גם היא מקבלת
  `grant execute to authenticated`.

אם לסלוט אין אימון קבוצתי, שתיהן לא עושות כלום. אם למתאמן כבר יש אימון באותו יום,
הן מדלגות: נרשם עם אימון אישי או עם אימון מסלוט אחר לא נדרס בהרשמה.

### ביטול

מתאמן שמבטל הרשמה, או שמוסר מהרשימה, מאבד את האימון הזה מהאפליקציה שלו. המחיקה
מותנית: רק אם `slot_workout_synced_at` לא NULL ו-`completed_at` NULL. כלומר לעולם
לא עבודה אישית של מאמן, ולעולם לא היסטוריה של אימון שבוצע. נוסף ל-
`cancelBookingAction` ול-`removeSlotTraineeAction`.

## מסכים

הבנייה לא כותבת רכיב חדש. `SessionRowsEditor` כבר משותף לבניית אימון ולעורך
התבניות, הוא לא מחזיק state, וההורה מחליט מה שמירה אומרת. אותו דבר ל-
`ExercisePicker` ול-`sessionExerciseSchema`.

- **עמוד חדש `/admin/schedule/slot/[slotId]`**: אותה פריסה כמו בניית אימון אישי,
  עם כותרת שאומרת שזה אימון לכל הקבוצה וכמה רשומים יקבלו אותו. שומר ופורס בפעולה
  אחת, והטוסט מדווח כמה קיבלו וכמה דולגו ולמה.
- **`RosterSheet`**: מעל רשימת השמות, שורה שמראה אם לסלוט יש אימון קבוצתי וכמה
  תרגילים, ומובילה לעמוד. זה מה שהיה חסר: עדן פתחה סלוט וראתה רק שמות.
- **`SessionWorklist`**: כותרת הקבוצה של הסלוט מקבלת את אותה שורה.
- **שורת מתאמן שנערך אישית** מקבלת סימון קצר, כדי שיהיה ברור למה עדכון קבוצתי
  דילג עליו.

הפיצ'ר זמין על כל סלוט ולא רק בקריית אתא. חסימה לפי סניף היא שרירותית, והסניף
השני פשוט לא ישתמש בזה.

## שגיאות

הפריסה היא פונקציה אחת בטרנזקציה אחת: או שכולם קיבלו או שאיש לא. דילוג הוא תוצאה
ולא שגיאה, וחוזר כספירה שנאמרת בעברית. `book_slot` רצה כבר בטרנזקציה אחת, אז
הרשמה שנכשלה בכתיבת האימון לא משאירה מקום תפוס בלי אימון.

הרשאות: העמוד והפעולות עוברים `verifyAdminOrTrainer()`, והסלוט נבדק מול
`assertBranchReadable(slot.branch_id)` כמו `deleteSlotAction`. מזהים נבדקים ב-
`isValidUUID()`.

## בדיקות

הפרויקט לא עושה בדיקות עם mocks, אז ההחלטה לכל רשום יוצאת לפונקציה טהורה
`planSlotWorkoutFanout()` ב-`src/lib/schedule/slot-workout-fanout.ts`, שמחזירה לכל
מתאמן `create` / `refresh` / `skip_custom` / `skip_completed` / `skip_other_slot`.
זה מה שנבדק ב-`__tests__`, וזה מה שה-RPC מממש. חמשת המצבים מהטבלה הם חמשת
המקרים.

אחרי המיגרציה: `npm run db:types` ו-`npm run db:schema`.

## מה לא בספק הזה

שני הפריטים האחרים באותה בקשה, שכל אחד מהם יקבל ספק משלו:

1. מאמן שני לשעת אימון. `daily_schedule_slots.trainer_id` ו-
   `weekly_schedule_bands.trainer_id` מחזיקים מאמן אחד, וזה יושב על היומן, השבוע
   הקבוע, מי במשמרת, הסינון "שלי" וצבעי המאמן.
2. ביטול אימון לשבוע מול מחיקה מהיומן. שתי הפעולות כבר קיימות בקוד
   (`deleteSlotAction` כותבת tombstone ומבטלת תאריך אחד, ומחיקת band בלשונית
   השבוע הקבוע מוחקת לתמיד), אבל הן בשני מסכים ושתיהן נקראות "מחיקה".
