# Schedule — לוח זמנים והזמנות

## Get Schedule

קבלת לוח זמנים.

- **Method**: `GET`
- **Path**: `/v3/schedule`

### Query Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `date` | string (date) | כן | תאריך. פורמט: `YYYY-MM-DD` |
| `locationId` | integer | לא | מזהה מיקום |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `ScheduleResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Update Schedule

עדכון לוח זמנים.

- **Method**: `PATCH`
- **Path**: `/v3/schedule`

### Request Body

Schema: [`PatchScheduleRequest`](./schemas.md#patchschedulerequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `ScheduleResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Book Trial Class

הזמנת שיעור ניסיון.

- **Method**: `POST`
- **Path**: `/v3/schedule/booking/trial`

### Request Body

Schema: [`BookForTrialClassRequest`](./schemas.md#bookfortrialclassrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `ScheduleUserResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Entry From Waiting List

כניסה מרשימת המתנה.

- **Method**: `POST`
- **Path**: `/v3/schedule/entryFromWaitingList`

### Request Body

Schema: [`BookForTrialClassRequest`](./schemas.md#bookfortrialclassrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `ScheduleStandByResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Book Session

הזמנת שיעור/סשן.

- **Method**: `POST`
- **Path**: `/v3/schedule/bookSession`

### Request Body

Schema: [`BookSessionRequest`](./schemas.md#booksessionrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `ScheduleUserResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Cancel User Booking

ביטול הזמנה של משתמש.

- **Method**: `POST`
- **Path**: `/v3/schedule/cancelUserBooking`

### Request Body

Schema: [`CancelUserBookingRequest`](./schemas.md#canceluserbookingrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `PublicApiV3Resource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get Box Categories

קבלת קטגוריות.

- **Method**: `GET`
- **Path**: `/v3/schedule/boxCategories`

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `BoxCategoriesResource` |

---

## Get Box Schedule Settings

קבלת הגדרות לוח זמנים.

- **Method**: `GET`
- **Path**: `/v3/schedule/boxScheduleSettings`

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `BoxScheduleSettingsResource` |

---

## Get Staff Availability

קבלת זמינות צוות.

- **Method**: `GET`
- **Path**: `/v3/schedule/staffAvailability`

### Query Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `date` | string (date) | כן | תאריך. פורמט: `YYYY-MM-DD` |
| `locationId` | integer | לא | מזהה מיקום |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `StaffAvailabilityResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get Spaces Availability

קבלת זמינות חללים/מתקנים.

- **Method**: `GET`
- **Path**: `/v3/schedule/spacesAvailability`

### Query Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `date` | string (date) | כן | תאריך. פורמט: `YYYY-MM-DD` |
| `locationId` | integer | לא | מזהה מיקום |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `SpacesAvailabilityResource` |
| 422 | שגיאת ולידציה | `ValidationException` |
