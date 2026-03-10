# Reports — דוחות

## Get Report

קבלת דוח לפי שם.

- **Method**: `GET`
- **Path**: `/v3/reports/{reportName}`

### Path Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `reportName` | string | כן | שם הדוח (ראה רשימה למטה) |

### Query Parameters

| שם | סוג | חובה | תיאור |
|----|------|------|--------|
| `from` | string (date) | כן | תאריך התחלה. פורמט: `YYYY-MM-DD` |
| `to` | string (date) | כן | תאריך סיום. פורמט: `YYYY-MM-DD` |
| `page` | integer | לא | מספר עמוד (מינימום: 1) |
| `limit` | integer | לא | מספר פריטים לעמוד (מינימום: 1, מקסימום: 500) |
| `location_id` | integer | לא | מזהה מיקום |

### Responses

| קוד | תיאור |
|-----|--------|
| 200 | הצלחה — ה-Schema משתנה בהתאם ל-reportName |
| 404 | דוח לא נמצא |
| 422 | שגיאת ולידציה |

---

## שמות דוחות זמינים (ReportName)

| שם הדוח | תיאור | Schema |
|---------|--------|--------|
| `activeMembers` | חברים פעילים | `ActiveMembersReportResource` |
| `activeMemberships` | מנויים פעילים | `ActiveMembershipsReportResource` |
| `allClients` | כל הלקוחות | `AllClientsReportResource` |
| `allLeads` | כל הלידים | `AllLeadsReportResource` |
| `absence` | היעדרויות | `AbsenceReportResource` |
| `birthday` | ימי הולדת | `BirthdayReportResource` |
| `bookingCancellation` | ביטולי הזמנות | `BookingCancellationReportResource` |
| `canceledMemberships` | מנויים שבוטלו | `CanceledMembershipsReportResource` |
| `cancelledSessions` | שיעורים שבוטלו | `CancelledSessionsReportResource` |
| `classesSummary` | סיכום שיעורים | `ClassesSummaryReportResource` |
| `convertedLeads` | לידים שהומרו | `ConvertedLeadsReportResource` |
| `debt` | חובות | `DebtReportResource` |
| `employeeAttendance` | נוכחות עובדים | `EmployeeAttendanceReportResource` |
| `entrance` | כניסות | `EntranceReportResource` |
| `expiredMemberships` | מנויים שפגו | `ExpiredMembershipsReportResource` |
| `expiredSessions` | שיעורים שפגו | `ExpiredSessionsReportResource` |
| `expiringMemberships` | מנויים שעומדים לפוג | `ExpiringMembershipsReportResource` |
| `expiringSessions` | שיעורים שעומדים לפוג | `ExpiringSessionsReportResource` |
| `futureMemberships` | מנויים עתידיים | `FutureMembershipsReportResource` |
| `futureSessions` | שיעורים עתידיים | `FutureSessionsReportResource` |
| `groupMembersCoordinator` | רכז חברי קבוצה | `GroupMembersCoordinatorReportResource` |
| `hugimBooking` | הזמנות חוגים | `HugimBookingReportResource` |
| `inactiveMembers` | חברים לא פעילים | `InactiveMembersReportResource` |
| `lateCancellation` | ביטולים מאוחרים | `LateCancellationReportResource` |
| `leadsInProcess` | לידים בתהליך | `LeadsInProcessReportResource` |
| `lostLeads` | לידים אבודים | `LostLeadsReportResource` |
| `membersOnHold` | חברים בהקפאה | `MembersOnHoldReportResource` |
| `membersProperties` | מאפייני חברים | `MembersPropertiesReportSource` |
| `regulars` | מתאמנים קבועים | `RegularsReportResource` |
| `renewals` | חידושים | `RenewalsReportResource` |
| `restrictedMembers` | חברים מוגבלים | `RestrictedMembersReportResource` |
| `sales` | מכירות | `SalesReportResource` |
| `sessions` | שיעורים | `SessionsReportResource` |
| `shiftSummary` | סיכום משמרות | `ShiftSummaryReportResource` |
| `signedForms` | טפסים חתומים | `SignedFormsReportResource` |
| `staffActions` | פעולות צוות | `StaffActionsReportResource` |
| `transactions` | עסקאות | `TransactionsReportResource` |
| `transparentMemberships` | מנויים שקופים | `TransparentMembershipsReportResource` |
| `transparentSessions` | שיעורים שקופים | `TransparentSessionsReportResource` |
| `trialClasses` | שיעורי ניסיון | `TrialClassesReportResource` |
| `attendanceExternalMembers` | נוכחות חברים חיצוניים | `AttendanceExternalMembersReportResource` |

### דוגמה

```bash
curl --request GET \
  --url 'https://arboxserver.arboxapp.com/api/public/v3/reports/activeMembers?from=2024-01-01&to=2024-12-31' \
  --header 'api-key: YOUR_API_KEY'
```
