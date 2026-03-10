# Schemas — מבני נתונים

## Request Schemas

### BookForTrialClassRequest

הזמנת שיעור ניסיון.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `user_id` | number | כן | מזהה משתמש |
| `schedule_id` | number | כן | מזהה לוח זמנים |
| `force` | boolean | לא | כפיית הזמנה |

---

### BookSessionRequest

הזמנת שיעור/סשן.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `user_id` | number | כן | מזהה משתמש |
| `schedule_id` | number | כן | מזהה לוח זמנים |
| `membership_user_id` | number | כן | מזהה מנוי משתמש |

---

### CancelUserBookingRequest

ביטול הזמנה.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `user_id` | number | כן | מזהה משתמש |
| `schedule_id` | number | כן | מזהה לוח זמנים |

---

### CreateDigitalFormLinkRequest

יצירת קישור לטופס דיגיטלי.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `user_id` | number | כן | מזהה משתמש |
| `form_id` | number | כן | מזהה טופס |

---

### CreateLeadRequest

יצירת ליד חדש.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `first_name` | string | כן | שם פרטי |
| `last_name` | string | כן | שם משפחה |
| `email` | string | לא | אימייל |
| `phone` | string | כן | טלפון |
| `location_id` | number | כן | מזהה מיקום |
| `source_id` | number | לא | מזהה מקור |
| `status_id` | number | לא | מזהה סטטוס |
| `note` | string | לא | הערה |
| `birthdate` | string (date) | לא | תאריך לידה |
| `gender` | string | לא | מגדר. ערכים: `male`, `female` |
| `address` | string | לא | כתובת |
| `city` | string | לא | עיר |
| `personal_id` | string | לא | תעודת זהות |

---

### CreateNoteRequest

יצירת הערה (לליד או למשתמש).

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `lead_id` | number | לא | מזהה ליד (לשימוש בהערת ליד) |
| `user_id` | number | לא | מזהה משתמש (לשימוש בהערת משתמש) |
| `note` | string | כן | תוכן ההערה |

---

### CreateTaskRequest

יצירת משימה.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `lead_id` | number | לא | מזהה ליד |
| `user_id` | number | לא | מזהה משתמש |
| `task_type_id` | number | כן | מזהה סוג משימה |
| `assigned_to` | number | כן | מוקצה ל (מזהה עובד) |
| `date` | string (date) | כן | תאריך |
| `description` | string | לא | תיאור |
| `location_id` | number | לא | מזהה מיקום |

---

### CreateUserRequest

יצירת משתמש חדש.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `first_name` | string | כן | שם פרטי |
| `last_name` | string | כן | שם משפחה |
| `email` | string | לא | אימייל |
| `phone` | string | כן | טלפון |
| `location_id` | number | כן | מזהה מיקום |
| `birthdate` | string (date) | לא | תאריך לידה |
| `gender` | string | לא | מגדר. ערכים: `male`, `female` |
| `address` | string | לא | כתובת |
| `city` | string | לא | עיר |
| `personal_id` | string | לא | תעודת זהות |

---

### MarkLeadAsLostRequest

סימון ליד כאבוד.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `lead_id` | number | כן | מזהה ליד |
| `lost_reason_id` | number | כן | מזהה סיבת אובדן |

---

### MembershipUserRequest

שיוך מנוי למשתמש.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `user_id` | number | כן | מזהה משתמש |
| `membership_type_id` | number | כן | מזהה סוג מנוי |
| `start_date` | string (date) | כן | תאריך התחלה |
| `end_date` | string (date) | לא | תאריך סיום |
| `price` | number | לא | מחיר |
| `location_id` | number | לא | מזהה מיקום |

---

### PatchScheduleRequest

עדכון לוח זמנים.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `schedule_id` | number | כן | מזהה לוח זמנים |
| `coach_id` | number | לא | מזהה מאמן |
| `max_users` | number | לא | מקסימום משתתפים |

---

### PatchUserRequest

עדכון משתמש.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `user_id` | number | כן | מזהה משתמש |
| `first_name` | string | לא | שם פרטי |
| `last_name` | string | לא | שם משפחה |
| `email` | string | לא | אימייל |
| `phone` | string | לא | טלפון |
| `birthdate` | string (date) | לא | תאריך לידה |
| `gender` | string | לא | מגדר |
| `address` | string | לא | כתובת |
| `city` | string | לא | עיר |
| `personal_id` | string | לא | תעודת זהות |

---

### SendMessageRequest

שליחת הודעה.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `user_id` | number | כן | מזהה משתמש |
| `subject` | string | כן | נושא |
| `message` | string | כן | תוכן ההודעה |
| `type` | string | כן | סוג הודעה. ערכים: `sms`, `email`, `push` |

---

### UpdateLeadStatusRequest

עדכון סטטוס ליד.

| שדה | סוג | חובה | תיאור |
|-----|------|------|--------|
| `lead_id` | number | כן | מזהה ליד |
| `status_id` | number | כן | מזהה סטטוס חדש |

---

## Response Schemas

### PublicApiV3Resource

תגובה כללית של ה-API.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס (200 / 204) |
| `data` | object | נתוני התגובה |

---

### LeadsResource

משאב לידים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך לידים |

**שדות בכל ליד (`data[]`):**

| שדה | סוג |
|-----|------|
| `id` | integer |
| `first_name` | string |
| `last_name` | string |
| `full_name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `created_at` | string (datetime) |
| `birthdate` | string &#124; null |
| `gender` | string &#124; null |
| `source` | string &#124; null |
| `status` | string &#124; null |
| `location_name` | string &#124; null |
| `address` | string &#124; null |
| `city` | string &#124; null |
| `personal_id` | string &#124; null |
| `lead_owner` | string &#124; null |

---

### UsersResource

משאב משתמשים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך משתמשים |

**שדות בכל משתמש (`data[]`):**

| שדה | סוג |
|-----|------|
| `user_id` | integer |
| `first_name` | string |
| `last_name` | string |
| `full_name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `gender` | string &#124; null |
| `birthday` | string &#124; null |
| `created_at` | string (date) |
| `address` | string &#124; null |
| `city` | string &#124; null |
| `personal_id` | integer &#124; null |
| `active_membership` | string &#124; null |
| `last_entrance` | string &#124; null |
| `location_name` | string &#124; null |

---

### SearchUsersResource

תוצאות חיפוש משתמשים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך תוצאות |

**שדות בכל תוצאה (`data[]`):**

| שדה | סוג |
|-----|------|
| `user_id` | integer |
| `first_name` | string |
| `last_name` | string |
| `full_name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `image` | string &#124; null |

---

### TaskResource

משאב משימות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך משימות |

**שדות בכל משימה (`data[]`):**

| שדה | סוג |
|-----|------|
| `task_id` | integer |
| `task_type` | string &#124; null |
| `date` | string (date) |
| `description` | string &#124; null |
| `status` | string |
| `assigned_to` | string &#124; null |
| `lead_name` | string &#124; null |
| `user_name` | string &#124; null |
| `location_name` | string &#124; null |
| `created_at` | string (datetime) |

---

### TaskTypeResource

סוגי משימות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך סוגי משימות |

---

### ScheduleResource

משאב לוח זמנים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך שיעורים/אירועים |

**שדות בכל אירוע (`data[]`):**

| שדה | סוג |
|-----|------|
| `schedule_id` | integer |
| `box_category_id` | integer &#124; null |
| `box_category_name` | string &#124; null |
| `date` | string (date) |
| `start_time` | string (datetime) |
| `end_time` | string (datetime) |
| `coach_name` | string &#124; null |
| `location_name` | string &#124; null |
| `max_users` | integer &#124; null |
| `registered_users` | integer &#124; null |
| `available_spots` | integer &#124; null |

---

### ScheduleUserResource

משאב הזמנה של משתמש.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | object | פרטי ההזמנה |

---

### ScheduleStandByResource

משאב רשימת המתנה.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | object | פרטי מקום ברשימת המתנה |

---

### MembershipTypesResource

סוגי מנויים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך סוגי מנויים |

**שדות בכל סוג מנוי (`data[]`):**

| שדה | סוג |
|-----|------|
| `membership_type_id` | integer |
| `name` | string |
| `type` | string &#124; null |
| `sessions` | integer &#124; null |
| `time_unit_type` | string &#124; null |
| `time_unit_number` | integer &#124; null |
| `price` | string &#124; null |
| `location_name` | string &#124; null |
| `active` | boolean |

---

### MembershipUserResource

משאב מנוי-משתמש.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך מנויי משתמשים |

**שדות בכל מנוי (`data[]`):**

| שדה | סוג |
|-----|------|
| `membership_user_id` | integer |
| `user_id` | integer |
| `membership_type_id` | integer |
| `membership_type_name` | string |
| `start_date` | string (date) |
| `end_date` | string &#124; null |
| `price` | string &#124; null |
| `sessions_left` | integer &#124; null |
| `status` | string |
| `location_name` | string &#124; null |

---

### LocationResource

משאב מיקומים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך מיקומים |

**שדות בכל מיקום (`data[]`):**

| שדה | סוג |
|-----|------|
| `location_id` | integer |
| `name` | string |
| `address` | string &#124; null |
| `city` | string &#124; null |
| `phone` | string &#124; null |

---

### DigitalFormResource

משאב טפסים דיגיטליים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך טפסים |

---

### UserLogsResource

לוגים של משתמש.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך לוגים |

---

### BoxCategoriesResource

קטגוריות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך קטגוריות |

**שדות בכל קטגוריה (`data[]`):**

| שדה | סוג |
|-----|------|
| `box_category_id` | string &#124; null |
| `name` | string &#124; null |
| `type` | string &#124; null |
| `color` | string &#124; null |

---

### BoxScheduleSettingsResource

הגדרות לוח זמנים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | object | אובייקט הגדרות |

---

### StaffAvailabilityResource

זמינות צוות.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך זמינות |

---

### SpacesAvailabilityResource

זמינות חללים/מתקנים.

| שדה | סוג | תיאור |
|-----|------|--------|
| `statusCode` | integer | קוד סטטוס |
| `data` | array | מערך זמינות |
