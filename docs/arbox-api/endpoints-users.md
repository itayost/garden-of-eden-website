# Users — משתמשים

## Get Users

קבלת רשימת משתמשים.

- **Method**: `GET`
- **Path**: `/v3/users`

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
| 200 | הצלחה | `UsersResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Create New User

יצירת משתמש חדש.

- **Method**: `POST`
- **Path**: `/v3/users`

### Request Body

Schema: [`CreateUserRequest`](./schemas.md#createuserrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `UsersResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Update User

עדכון משתמש.

- **Method**: `PATCH`
- **Path**: `/v3/users`

### Request Body

Schema: [`PatchUserRequest`](./schemas.md#patchuserrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `UsersResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Create User Note

הוספת הערה למשתמש.

- **Method**: `POST`
- **Path**: `/v3/users/createNote`

### Request Body

Schema: [`CreateNoteRequest`](./schemas.md#createnoterequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `PublicApiV3Resource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Search Users

חיפוש משתמשים.

- **Method**: `GET`
- **Path**: `/v3/users/searchUser`

### Query Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `query` | string | כן | מחרוזת חיפוש |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `SearchUsersResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get User Waiver

קבלת ויתור/הסכם של משתמש.

- **Method**: `GET`
- **Path**: `/v3/users/waiver/{type}/{value}`

### Path Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `type` | string | כן | סוג הזיהוי. ערכים: `userId`, `email`, `phone` |
| `value` | string | כן | ערך הזיהוי |

### Responses

| קוד | תיאור |
|-----|--------|
| 200 | הצלחה |
| 422 | שגיאת ולידציה |

---

## Get User by ID

קבלת משתמש לפי מזהה.

- **Method**: `GET`
- **Path**: `/v3/users/{userId}`

### Path Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `userId` | integer | כן | מזהה המשתמש |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `UsersResource` |
| 404 | לא נמצא | `ModelNotFoundException` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get User Logs

קבלת לוגים של משתמש.

- **Method**: `GET`
- **Path**: `/v3/users/{userId}/logs`

### Path Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `userId` | integer | כן | מזהה המשתמש |

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `page` | integer | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `UserLogsResource` |
| 404 | לא נמצא | `ModelNotFoundException` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get User Memberships

קבלת מנויים של משתמשים.

- **Method**: `GET`
- **Path**: `/v3/users/memberships`

### Query Parameters

| שם | סוג | תיאור |
|----|------|--------|
| `limit` | integer | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | מזהה מיקום |
| `page` | integer | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `MembershipUserResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Assign Membership to User

שיוך מנוי למשתמש.

- **Method**: `POST`
- **Path**: `/v3/users/memberships`

### Request Body

Schema: [`MembershipUserRequest`](./schemas.md#membershipuserrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `MembershipUserResource` |
| 422 | שגיאת ולידציה | `ValidationException` |
