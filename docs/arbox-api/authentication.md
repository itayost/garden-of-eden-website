# Authentication — אימות

## API Key

Arbox API משתמש באימות באמצעות API Key.

### שימוש

יש לשלוח את ה-API Key בהדר `api-key` בכל בקשה:

```
api-key: YOUR_API_KEY
```

### דוגמה עם cURL

```bash
curl --request GET \
  --url https://arboxserver.arboxapp.com/api/public/v3/leads \
  --header 'Accept: application/json' \
  --header 'api-key: YOUR_API_KEY'
```

### דוגמה עם fetch (JavaScript)

```javascript
const response = await fetch('https://arboxserver.arboxapp.com/api/public/v3/leads', {
  headers: {
    'Accept': 'application/json',
    'api-key': 'YOUR_API_KEY'
  }
});
const data = await response.json();
```

### הערות

- ה-API Key הוא טוקן שמתקבל מ-Arbox
- יש לכלול את הטוקן בכל קריאת API
- שם ההדר הוא `api-key` (עם מקף)
