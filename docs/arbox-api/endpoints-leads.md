# Leads — לידים

## Get All Leads

קבלת כל הלידים.

- **Method**: `GET`
- **Path**: `/v3/leads`

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | מזהה מיקום |
| `page` | integer | מספר עמוד (מינימום: 1) |
| `sort` | string | סדר מיון. ערכים: `asc`, `desc` |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `LeadsResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Create New Lead

יצירת ליד חדש.

- **Method**: `POST`
- **Path**: `/v3/leads`

### Request Body

Schema: [`CreateLeadRequest`](./schemas.md#createleadrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `LeadsResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Update Lead Status

עדכון סטטוס ליד.

- **Method**: `POST`
- **Path**: `/v3/leads/updateStatus`

### Request Body

Schema: [`UpdateLeadStatusRequest`](./schemas.md#updateleadstatusrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `LeadsResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get Lead Statuses

קבלת סטטוסים של לידים.

- **Method**: `GET`
- **Path**: `/v3/statuses`

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | מזהה מיקום |
| `page` | integer | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור |
|-----|--------|
| 200 | הצלחה |

---

## Mark Lead as Lost

סימון ליד כאבוד.

- **Method**: `POST`
- **Path**: `/v3/leads/markAsLost`

### Request Body

Schema: [`MarkLeadAsLostRequest`](./schemas.md#markleadaslostrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `PublicApiV3Resource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get Converted Leads

קבלת לידים שהומרו.

- **Method**: `GET`
- **Path**: `/v3/leads/converted`

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | מזהה מיקום |
| `page` | integer | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `LeadsResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get Lost Leads

קבלת לידים אבודים.

- **Method**: `GET`
- **Path**: `/v3/leads/lost`

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | מזהה מיקום |
| `page` | integer | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `LeadsResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Add Note to Lead

הוספת הערה לליד.

- **Method**: `POST`
- **Path**: `/v3/leads/createNote`

### Request Body

Schema: [`CreateNoteRequest`](./schemas.md#createnoterequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `PublicApiV3Resource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get Lead Sources

קבלת מקורות לידים.

- **Method**: `GET`
- **Path**: `/v3/sources`

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | מזהה מיקום |
| `page` | integer | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור |
|-----|--------|
| 200 | הצלחה |

---

## Get Lead Lost Reasons

קבלת סיבות אובדן לידים.

- **Method**: `GET`
- **Path**: `/v3/lostReasons`

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | מזהה מיקום |
| `page` | integer | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור |
|-----|--------|
| 200 | הצלחה |
