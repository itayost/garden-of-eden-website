import { CalendarDays, Footprints, Infinity as InfinityIcon, Ticket, Users } from "lucide-react";
import { PosterPlanCard, type PosterPlan } from "./poster/PosterPlanCard";
import { PosterSection } from "./poster/PosterSection";

const WHATSAPP_PHONE = "972525779446";

function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

function whatsapp(label: string, message: string): PosterPlan["cta"] {
  return { kind: "whatsapp", label, href: buildWhatsAppUrl(message) };
}

/** The Haifa price list, in the order and wording of the branch's published poster. */
const plans: PosterPlan[] = [
  {
    icon: Users,
    name: "2 אימונים בשבוע",
    description: "מנוי חודשי",
    price: "1,450",
    period: "לחודש",
    features: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית", "מנטלית וטקטית"],
    cta: whatsapp("שליחת הודעה על המסלול", "היי, אשמח לשמוע פרטים נוספים על מסלול 2 אימונים בשבוע. תודה!"),
  },
  {
    icon: Footprints,
    name: "אימון אחד בשבוע",
    description: "מנוי חודשי",
    price: "850",
    period: "לחודש",
    features: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית", "מנטלית וטקטית"],
    cta: whatsapp("שליחת הודעה על המסלול", "היי, אשמח לשמוע פרטים נוספים על מסלול אימון אחד בשבוע. תודה!"),
  },
  {
    icon: CalendarDays,
    name: "מסלול היכרות",
    description: "2 אימונים",
    price: "200",
    period: "להכיר את השיטה לפני שמצטרפים",
    features: ["2 אימונים", "היכרות עם השיטה ועם המאמנים"],
    cta: whatsapp("קביעת אימון היכרות", "היי, אשמח לקבוע מסלול היכרות (2 אימונים). תודה!"),
  },
  {
    icon: InfinityIcon,
    name: "ללא הגבלה",
    description: "מנוי חודשי",
    price: "1,650",
    period: "לחודש",
    features: ["אימונים ללא הגבלה", "כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית ומנטלית"],
    highlighted: true,
    cta: whatsapp("שליחת הודעה על המסלול", "היי, אשמח לשמוע פרטים נוספים על המסלול ללא הגבלה. תודה!"),
  },
  {
    icon: Ticket,
    name: "כרטיסיית 10 אימונים",
    description: "מנצלים בקצב שלכם",
    price: "2,100",
    period: "10 אימונים",
    note: "₪210 לאימון",
    features: ["הגבלת זמן רחבה"],
    cta: whatsapp("שליחת הודעה על המסלול", "היי, אשמח לשמוע פרטים נוספים על כרטיסיית 10 אימונים. תודה!"),
  },
];

export function Services() {
  return (
    <PosterSection
      branchLabel="סניף חיפה"
      address="רחוב המלך שלמה 57, חיפה"
      phoneE164={WHATSAPP_PHONE}
      phoneDisplay="052-5779446"
      secondaryAction={{
        label: "להרשמה ולפרטים נוספים",
        href: buildWhatsAppUrl("היי, אשמח להירשם ולשמוע פרטים נוספים על מסלולי האימונים בחיפה. תודה!"),
        external: true,
      }}
      notes={<p>* כל האימונים משולבים עם כדור</p>}
    >
      {plans.map((plan) => (
        <PosterPlanCard key={plan.name} plan={plan} />
      ))}
    </PosterSection>
  );
}
