# Report Schemas — מבני דוחות

כל הדוחות מחזירים מבנה אחיד:

```json
{
  "statusCode": 200,
  "data": [ ... ],
  "extra": []
}
```

להלן השדות של `data[]` בכל דוח:

---

## AbsenceReportResource — היעדרויות

| שדה | סוג |
|-----|------|
| `name` | string |
| `phone` | string &#124; null |
| `email` | string &#124; null |
| `last_seen` | string &#124; null |
| `future_registration` | string &#124; null |
| `latest_registration` | string &#124; null |
| `memberships` | string &#124; null |
| `membership_name` | string &#124; null |
| `debt` | string &#124; null |
| `task_status` | string &#124; null |
| `location_name` | string &#124; null |
| `allow_sms` | string &#124; null |
| `allow_email` | string &#124; null |

---

## ActiveMembersReportResource — חברים פעילים

| שדה | סוג |
|-----|------|
| `user_id` | string &#124; null |
| `name` | string |
| `gender` | string &#124; null |
| `user_type` | string &#124; null |
| `age` | string &#124; null |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `additional_phone` | string &#124; null |
| `personal_id` | integer &#124; null |
| `active_memberships_count` | string &#124; null |
| `future_memberships_count` | string &#124; null |
| `created_at` | string (date) |
| `union_name` | string &#124; null |
| `union_id` | string &#124; null |
| `location_name` | string &#124; null |
| `address` | string &#124; null |
| `city` | string &#124; null |
| `country` | string &#124; null |
| `zip_code` | string &#124; null |
| `state` | string &#124; null |
| `lead_owner` | string &#124; null |

---

## ActiveMembershipsReportResource — מנויים פעילים

| שדה | סוג |
|-----|------|
| `user_id` | integer &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `membership_type_name` | string &#124; null |
| `purchase_date` | string (date) |
| `start_date` | string &#124; null |
| `end_date` | string &#124; null |
| `sessions_left` | string &#124; null |
| `price` | string &#124; null |
| `debt` | string &#124; null |
| `sale_person_name` | string &#124; null |
| `active` | string &#124; null |
| `location_name` | string &#124; null |
| `allow_sms` | string &#124; null |
| `allow_email` | string &#124; null |
| `personal_id` | integer &#124; null |
| `lead_owner` | string &#124; null |

---

## AllClientsReportResource — כל הלקוחות

| שדה | סוג |
|-----|------|
| `user_id` | string &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `user_type` | string &#124; null |
| `gender` | string &#124; null |
| `age` | string &#124; null |
| `memberships` | string &#124; null |
| `last_seen` | string &#124; null |
| `debt` | string &#124; null |
| `created_at` | string (date) |
| `location_name` | string &#124; null |
| `personal_id` | integer &#124; null |
| `lead_owner` | string &#124; null |

---

## AllLeadsReportResource — כל הלידים

| שדה | סוג |
|-----|------|
| `lead_id` | integer &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `source` | string &#124; null |
| `status` | string &#124; null |
| `created_at` | string (date) |
| `lead_owner` | string &#124; null |
| `location_name` | string &#124; null |
| `personal_id` | integer &#124; null |

---

## BirthdayReportResource — ימי הולדת

| שדה | סוג |
|-----|------|
| `user_id` | integer &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `birthday` | string &#124; null |
| `age` | string &#124; null |
| `location_name` | string &#124; null |

---

## BookingCancellationReportResource — ביטולי הזמנות

| שדה | סוג |
|-----|------|
| `user_id` | integer &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `class_name` | string &#124; null |
| `date` | string (date) |
| `start_time` | string (datetime) |
| `cancelled_at` | string (datetime) |
| `location_name` | string &#124; null |

---

## CanceledMembershipsReportResource — מנויים שבוטלו

| שדה | סוג |
|-----|------|
| `user_id` | integer &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `membership_type_name` | string &#124; null |
| `purchase_date` | string (date) |
| `end_date` | string &#124; null |
| `cancelled_time` | string (date) |
| `cancel_reason` | string &#124; null |
| `cancelled_by` | string &#124; null |
| `comment` | string &#124; null |
| `refund` | string |
| `sale_person_name` | string &#124; null |
| `active` | string &#124; null |
| `task_status` | string &#124; null |
| `location_name` | string &#124; null |
| `lead_owner` | string &#124; null |

---

## CancelledSessionsReportResource — שיעורים שבוטלו

| שדה | סוג |
|-----|------|
| `schedule_id` | integer &#124; null |
| `date` | string (date) |
| `day_of_week` | string &#124; null |
| `start_time` | string (datetime) |
| `end_time` | string (datetime) |
| `class_name` | string &#124; null |
| `coach_name` | string &#124; null |
| `location_name` | string &#124; null |

---

## ClassesSummaryReportResource — סיכום שיעורים

| שדה | סוג |
|-----|------|
| `schedule_id` | integer &#124; null |
| `date` | string (date) |
| `day_of_week` | string &#124; null |
| `start_time` | string (datetime) |
| `end_time` | string (datetime) |
| `class_name` | string &#124; null |
| `coach_name` | string &#124; null |
| `max_users` | integer &#124; null |
| `registered_users` | integer &#124; null |
| `attended` | integer &#124; null |
| `location_name` | string &#124; null |

---

## ConvertedLeadsReportResource — לידים שהומרו

| שדה | סוג |
|-----|------|
| `lead_id` | integer &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `source` | string &#124; null |
| `created_at` | string (date) |
| `converted_at` | string (date) |
| `lead_owner` | string &#124; null |
| `location_name` | string &#124; null |

---

## DebtReportResource — חובות

| שדה | סוג |
|-----|------|
| `user_id` | integer &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `debt` | string &#124; null |
| `membership_type_name` | string &#124; null |
| `location_name` | string &#124; null |

---

## EmployeeAttendanceReportResource — נוכחות עובדים

| שדה | סוג |
|-----|------|
| `name` | string |
| `date` | string (date) |
| `start_time` | string (datetime) |
| `end_time` | string (datetime) |
| `location_name` | string &#124; null |

---

## EntranceReportResource — כניסות

| שדה | סוג |
|-----|------|
| `user_id` | integer &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `class_name` | string &#124; null |
| `date` | string (date) |
| `start_time` | string (datetime) |
| `location_name` | string &#124; null |

---

## SalesReportResource — מכירות

| שדה | סוג |
|-----|------|
| `user_id` | integer &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `membership_type_name` | string &#124; null |
| `purchase_date` | string (date) |
| `price` | string &#124; null |
| `sale_person_name` | string &#124; null |
| `location_name` | string &#124; null |

---

## TransactionsReportResource — עסקאות

| שדה | סוג |
|-----|------|
| `user_id` | integer &#124; null |
| `name` | string |
| `email` | string &#124; null |
| `phone` | string &#124; null |
| `amount` | string &#124; null |
| `payment_method` | string &#124; null |
| `date` | string (date) |
| `description` | string &#124; null |
| `location_name` | string &#124; null |

---

## הערות

- כל הדוחות תומכים ב-pagination עם `page` ו-`limit`
- ניתן לסנן לפי `location_id`
- שדות `from` ו-`to` (תאריכים) הם חובה
- עיין ב-[endpoints-reports.md](./endpoints-reports.md) לרשימה המלאה של שמות דוחות
- עיין ב-[errors.md](./errors.md) למבנה שגיאות
