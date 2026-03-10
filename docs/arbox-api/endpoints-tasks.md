# Tasks — משימות

## Get Tasks

קבלת משימות.

- **Method**: `GET`
- **Path**: `/v3/tasks`

### Query Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `limit` | integer | לא | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | לא | מזהה מיקום |
| `page` | integer | לא | מספר עמוד (מינימום: 1) |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `TaskResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Create Task

יצירת משימה חדשה.

- **Method**: `POST`
- **Path**: `/v3/tasks`

### Request Body

Schema: [`CreateTaskRequest`](./schemas.md#createtaskrequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `TaskResource` |
| 422 | שגיאת ולידציה | `ValidationException` |

---

## Get Task Types

קבלת סוגי משימות.

- **Method**: `GET`
- **Path**: `/v3/tasks/types`

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `TaskTypeResource` |

---

## Mark Task as Completed

סימון משימה כהושלמה.

- **Method**: `POST`
- **Path**: `/v3/tasks/markAsCompleted/{task_id}`

### Path Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `task_id` | integer | כן | מזהה המשימה |

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `TaskResource` |
| 404 | לא נמצא | `ModelNotFoundException` |
