# Message — הודעות

## Send Message

שליחת הודעה.

- **Method**: `POST`
- **Path**: `/v3/message`

### Request Body

Schema: [`SendMessageRequest`](./schemas.md#sendmessagerequest)

### Responses

| קוד | תיאור | Schema |
|-----|--------|--------|
| 200 | הצלחה | `PublicApiV3Resource` |
| 422 | שגיאת ולידציה | `ValidationException` |
