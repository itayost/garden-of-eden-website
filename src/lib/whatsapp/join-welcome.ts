import { callWhatsAppAPI, getConfig, type WhatsAppResult } from "./api";

/**
 * The welcome a new trainee gets after buying on the site, at any branch
 * (issue #162; Haifa too, owner 2026-11-09), word
 * for word from the client. The Meta template named in
 * WHATSAPP_JOIN_WELCOME_TEMPLATE_NAME must carry exactly this body, with no
 * variables; until it is approved, staff send these same words by hand.
 *
 * Not the Haifa welcome (WHATSAPP_WELCOME_TEMPLATE_NAME): that one sends
 * Arbox accounts to book in Arbox, while a site sale books on the site.
 */
export const JOIN_WELCOME_TEXT = [
  "שלום לכולם",
  "מוזמנים לקבוע אימונים דרך",
  "האתר המקצועי שלנו",
  "",
  "https://www.edengarden.co.il/",
  "",
  "בכניסה לאתר, צד שמאל למעלה יש 3 קווים",
  "-",
  "-",
  "-",
  "",
  "נא ללחוץ על הקווים",
  "להכנס לאיזור המתאמנים",
  "להזין מספר טלפון שנתת לנו",
  "אתם תקבלו קוד לווצאפ",
  "תזינו אותו באתר",
  "ואתם בתוך האתר מיידית",
  "",
  "באתר קיים לכם:",
  "* יומן לשיבוץ על פי שנתון וסוג אימון",
  "* קורס דיגיטלי לשחקן ופרק להורים",
  "* תרגילים למניעת פציעות",
  "* שאלון לפני האימון שקבעתם אלינו",
  "* שאלון אחרי האימון שהתאמנתם איתנו",
  "* צפיה מבדקים שהשחקנים עשו",
  "* תוכלו לשבץ סרטון לצפיה של השחקן",
  "ואז אנחנו המאמנים נוכל לצפות ולנתח",
  "* תוכלו לכתוב מתי המשחק ונגיע לצפות",
  "* קיים לכם ספר פיתוח לשחקן כדורגל",
  "",
  "בהמשך יהיו עוד עדכונים",
].join("\n");

export async function sendJoinWelcome(phone: string): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_JOIN_WELCOME_TEMPLATE_NAME?.trim();
  if (!templateName) {
    return { success: false, error: "WHATSAPP_JOIN_WELCOME_TEMPLATE_NAME not configured" };
  }
  const { token, phoneNumberId } = getConfig();
  return callWhatsAppAPI(phoneNumberId, token, {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: { name: templateName, language: { code: "he" } },
  });
}
