# Locations — מיקומים

## Get Locations

קבלת רשימת מיקומים.

- **Method**: `GET`
- **Path**: `/v3/locations`

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `page` | integer | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `LocationResource` |
| 422 | שגיאת ולידציה | `ValidationException` |
