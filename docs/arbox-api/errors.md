# Error Responses — תגובות שגיאה

## ValidationException (422)

שגיאת ולידציה — מוחזרת כאשר הנתונים שנשלחו אינם תקינים.

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "field_name": [
      "The field_name is required.",
      "The field_name must be a number."
    ]
  }
}
```

| שדה | סוג | תיאור |
|-----|------|--------|
| `message` | string | **חובה** — סקירה כללית של השגיאה |
| `errors` | object | **חובה** — אובייקט עם תיאור מפורט לכל שדה שנכשל בולידציה. כל מפתח הוא שם השדה, והערך הוא מערך מחרוזות עם הודעות שגיאה |

---

## ModelNotFoundException (404)

לא נמצא — מוחזר כאשר המשאב המבוקש לא קיים.

```json
{
  "message": "Resource not found."
}
```

| שדה | סוג | תיאור |
|-----|------|--------|
| `message` | string | **חובה** — הודעת שגיאה |

---

## HTTP Status Codes

| קוד | משמעות |
|-----|---------|
| `200` | הצלחה |
| `204` | הצלחה — ללא תוכן |
| `404` | לא נמצא |
| `422` | שגיאת ולידציה |
