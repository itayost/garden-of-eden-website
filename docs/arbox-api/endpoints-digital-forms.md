# Digital Forms — טפסים דיגיטליים

## Create Digital Form Link

יצירת קישור לטופס דיגיטלי.

- **Method**: `POST`
- **Path**: `/v3/digitalForms/createLink`

### Request Body

Schema: [`CreateDigitalFormLinkRequest`](./schemas.md#createdigitalformlinkrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `PublicApiV3Resource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get Digital Forms

קבלת טפסים דיגיטליים.

- **Method**: `GET`
- **Path**: `/v3/digitalForms`

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | מזהה מיקום |
| `page` | integer | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `DigitalFormResource` |
| 422 | שגיאת ולידציה | `ValidationException` |
