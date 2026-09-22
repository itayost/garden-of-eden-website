# אימון לפי סלוט ולא לפי יום

תאריך: 2026-09-22
סטטוס: מאושר לתכנון יישום

## הבעיה

`training_sessions` נושא `UNIQUE (trainee_id, session_date)`. אימון הוא תכונה של
יום. אימון קבוצתי, שנוסף ב-PR #55, הוא תכונה של שעה. מתאמן שרשום לשתי שעות באותו
יום מקבל אימון אחד בלבד, של מי שנשמר ראשון, והשני מקבל `skip_other_slot`. הכרעת
הלקוח: מתאמן שרשום לשתי שעות צריך לקבל שני אימונים שונים.

זה גם סוגר קצה שנפתח ב-PR #55: מתאמן בשתי שעות חולק אימון אחד, וביטול השעה
הראשונה מוחק אותו בלי שאיש יחיל מחדש את של השנייה. עם אימון לכל סלוט אין מה
לחלוק ואין מה למחוק בטעות.

## כמה זה קורה

43 ימי מתאמן מתוך 824 (5.2%) עם שני סלוטים או יותר, על פני 31 מתאמנים, כולם
בחיפה. בקריית אתא אפס, כי אין לה עדיין אף סלוט והרשמה עצמית כבויה. הפיצ'ר
הקבוצתי פתוח לכל סלוט, ולכן הקצה חי ברגע שמאמן בחיפה משתמש בו.

## ההחלטה

אימון שייך לסלוט. גישות שנשקלו ונדחו:

- **אימון אחד ליום עם "חלקים" לכל שעה.** משנה את ההורות של
  `training_session_exercises` ומסבך כל קריאה, בתמורה לאותה תוצאה.
- **מיזוג שתי השעות לרשימה אחת.** המסך לא משתנה, אבל הגבול בין השעות נמחק
  וההשלמה נעשית עמומה. נפסל מפורשות על ידי הלקוח.

## מודל הנתונים

```sql
ALTER TABLE public.training_sessions
  DROP CONSTRAINT training_sessions_trainee_id_session_date_key;

CREATE UNIQUE INDEX training_sessions_trainee_slot_key
  ON public.training_sessions (trainee_id, slot_id) WHERE slot_id IS NOT NULL;
```

אינדקס אחד, ובכוונה לא שניים. אימון שנבנה מרשימת הבנייה תמיד נושא סלוט, ואימון
שנפתח ישירות מ-`/admin/schedule/session/[traineeId]` בלי `?slot=` לא. מתבקש
להוסיף `UNIQUE (trainee_id, session_date) WHERE slot_id IS NULL` כדי לשמור סדר
גם שם, וזו טעות: `training_sessions.slot_id` הוא `ON DELETE SET NULL`, אז מחיקת
סלוט הופכת את האימונים שלו לחסרי סלוט, ומתאמן שכבר היה לו אימון חסר סלוט באותו
יום היה גורם למחיקת הסלוט להיכשל בהפרת ייחודיות. השארת החסרי סלוט בלי אילוץ
מוותרת על סדר שממילא אף אחד לא סומך עליו, ובתמורה מחיקת סלוט לא נכשלת לעולם.

`ON DELETE CASCADE` על `slot_id` היה פותר את זה אחרת, ונפסל: הוא היה מוחק גם
אימון אישי שמאמן בנה, כלומר אובדן עבודה אמיתית בלחיצה על מחיקת סלוט.

נתונים קיימים: 316 אימונים, מהם אחד בלי סלוט, ואפס התנגשויות עם האינדקס.
האילוץ הנוכחי חזק ממנו, ולכן המעבר בטוח בהגדרה.

## הפריסה הקבוצתית

`skip_other_slot` נמחק מ-`planSlotWorkoutFanout()` ומ-
`apply_slot_workout_to_trainee`. הכלל נעשה קצר יותר, לא ארוך:

| מצב | פעולה |
|---|---|
| אין לו אימון בסלוט הזה | `create` |
| יש אימון בסלוט הזה, לא הושלם, `synced_at` לא NULL | `refresh` |
| `slot_workout_synced_at` NULL | `skip_custom` |
| `completed_at` לא NULL | `skip_completed` |

החיפוש ב-`apply_slot_workout_to_trainee` עובר מ-
`WHERE trainee_id = ... AND session_date = v_date` ל-
`WHERE trainee_id = ... AND slot_id = p_slot_id`, והבדיקה
`IF v_session_slot IS DISTINCT FROM p_slot_id` נמחקת יחד עם המשתנה.

`drop_slot_workout_session` ו-`clear_slot_workout` כבר מחפשים לפי `slot_id`
ואינם משתנים.

## ממשקי הקריאה

### המתאמן

`getMyTodaySessionAction()` הופך ל-`getMyTodaySessionsAction()` ומחזיר
`TrainingSession[]` ממוין לפי שעת הסלוט, והאימון חסר הסלוט אחרון. המיון דורש את
`start_time` של הסלוט, שמגיע דרך embed על `daily_schedule_slots`.

`/dashboard/workout` פותח אימון אחד ומקפל את השאר מתחתיו. הפתוח הוא **האחרון
שהתחיל**, כלומר הסלוט בעל ה-`start_time` הגדול ביותר שאינו אחרי השעה הנוכחית;
אם עוד לא התחיל אף אחד, הקרוב ביותר. הבחירה היא פונקציה טהורה,
`pickOpenSession()`, כי היא תלויה בשעה ולכן חייבת להיבדק בלי שעון אמיתי.

`/dashboard/scan/[code]` פותר את המכשיר מול התרגילים של הפתוח בלבד. מכשיר שלא
מופיע בו נופל לדיווח החופשי, בדיוק כמו היום, ולכן אין מצב שסריקה נכשלת בגלל
שהמתאמן פתח את השעה השנייה.

`logExerciseAction` ו-`completeMySessionAction` אינם משתנים: הראשון נתלה ב-
`session_exercise_id` והשני מקבל מזהה אימון. נתיב הכתיבה של המתאמן כבר לפי אימון.

### הצוות

| היום | אחרי |
|---|---|
| `getSessionAction(traineeId, date)` | `getSessionAction(traineeId, date, slotId)`; עם `slotId` קורא לפיו, בלעדיו את חסר הסלוט האחרון של אותו יום |
| `getSessionSummariesAction(date) -> Record<traineeId, SessionSummary>` | `-> Record<slotId, Record<traineeId, SessionSummary>>`, עם מפתח `""` לחסרי סלוט |
| `getWeekSessionStatusesAction -> date -> trainee -> status` | `-> date -> slot -> trainee -> status` |
| `getRosterSessionsAction(date, traineeIds)` | `getRosterSessionsAction(slotId, traineeIds)` |
| `upsertSessionAction` מוצא קיים לפי (trainee, date) | לפי (trainee, slot). בלי סלוט, האחרון של אותו יום לפי `created_at` עם `limit(1)` במקום `maybeSingle()`, שאחרת היה נופל על יותר מאחד |

`buildSessionWorklist()` כבר מקבץ לפי סלוט, ולכן הוא מתפשט ולא מסתבך: הוא בוחר
את הסיכום מתוך המפה של הסלוט שלו במקום מתוך מפה גלובלית לפי מתאמן.

`getPreviousSessionAction` מקבל `.order("created_at", { ascending: false })`
כשובר שוויון, כי "האימון הקודם" של יום עם שניים היה נבחר שרירותית.

## מה לא משתנה

סטריקים קוראים `user_streaks`. הקורס ו-`grant-course-badges` נוגעים ב-
`completed_at` של שיעורים, לא של אימונים. `exercise_logs` נתלה ב-
`training_session_exercises` ולכן אדיש למפתח של האימון.

## בדיקות

- `pickOpenSession()` טהורה ונבדקת: שני אימונים ואחד באמצע, לפני הראשון, אחרי
  האחרון, אימון חסר סלוט בלבד, ורשימה ריקה.
- `planSlotWorkoutFanout()` מאבד את `skip_other_slot`, וארבעת המצבים הנותרים
  נבדקים כפי שהם.
- `toDaySessionStatuses()` ו-`buildSessionWorklist()` מקבלים בדיקות למפתח החדש.
- מחיקת סלוט שמשאירה אימון אישי חסר סלוט ליד אימון חסר סלוט קיים: עוברת, ושניהם
  נשארים. זה המקרה שבגללו אין אינדקס על חסרי הסלוט.
- אחרי המיגרציה: `npm run db:types` ו-`npm run db:schema`.
- תרחיש מלא מול המסד בטרנזקציה עם ROLLBACK: מתאמן בשני סלוטים באותו יום מקבל שני
  אימונים שונים, ביטול אחד מהם משאיר את השני על כנו, ועריכה אישית של אחד לא
  נוגעת בשני.

## סיכון

אין דחיפות: לקריית אתא אין עדיין אף סלוט והרשמה עצמית כבויה. עם זאת, האילוץ
שיורד הוא כזה שכל שלב 2 נשען עליו, ולכן כל קריאה שמניחה אימון אחד ליום ולא
שונתה תיתן מעכשיו תוצאה שרירותית במקום שגיאה. רשימת הקריאות בטבלה למעלה היא
ממצה לפי חיפוש על `session_date` בכל `src`.
