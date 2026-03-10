# Membership Types — סוגי מנויים

## Get Membership Types

קבלת סוגי מנויים.

- **Method**: `GET`
- **Path**: `/v3/membershipTypes`

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | מזהה מיקום |
| `page` | integer | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `MembershipTypesResource` |
| 422 | שגיאת ולידציה | `ValidationException` |
