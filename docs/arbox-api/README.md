# Arbox API Documentation

## Overview

- **Version**: 0.0.1
- **Base URL**: `https://arboxserver.arboxapp.com/api/public`
- **API Spec**: OpenAPI 3.1.0
- **Auth**: API Key header (`api-key`)

## קבצי תיעוד

| קובץ | תוכן |
|------|-------|
| [authentication.md](./authentication.md) | אימות — API Key |
| [endpoints-leads.md](./endpoints-leads.md) | Leads — ניהול לידים |
| [endpoints-tasks.md](./endpoints-tasks.md) | Tasks — משימות |
| [endpoints-users.md](./endpoints-users.md) | Users — משתמשים |
| [endpoints-schedule.md](./endpoints-schedule.md) | Schedule — לוח זמנים והזמנות |
| [endpoints-membership-types.md](./endpoints-membership-types.md) | Membership Types — סוגי מנויים |
| [endpoints-locations.md](./endpoints-locations.md) | Locations — מיקומים |
| [endpoints-message.md](./endpoints-message.md) | Message — הודעות |
| [endpoints-reports.md](./endpoints-reports.md) | Reports — דוחות |
| [endpoints-custom-fields.md](./endpoints-custom-fields.md) | Custom Fields — שדות מותאמים |
| [endpoints-digital-forms.md](./endpoints-digital-forms.md) | Digital Forms — טפסים דיגיטליים |
| [schemas.md](./schemas.md) | Schemas — מבני נתונים (Request/Response) |
| [schemas-reports.md](./schemas-reports.md) | Report Schemas — מבני דוחות |
| [errors.md](./errors.md) | Error Responses — תגובות שגיאה |

## מבנה כללי

כל הנתיבים מתחילים ב-`/v3/` ודורשים אימות באמצעות API Key בהדר.

```
GET /v3/leads
Header: api-key: YOUR_API_KEY
Accept: application/json
```
