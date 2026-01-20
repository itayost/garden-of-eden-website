import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "תנאי שימוש - Garden of Eden",
  description: "תנאי השימוש של אקדמיית Garden of Eden",
};

export default function TermsOfServicePage() {
  return (
    <main className="bg-[#F5F5F0] min-h-screen">
      <Navbar />

      <div className="container mx-auto px-6 py-24 max-w-4xl">
        <h1 className="text-4xl font-bold mb-12 text-[#1a1a1a]">תנאי שימוש</h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <p className="text-lg">
            עודכן לאחרונה: ינואר 2025
          </p>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">הסכמה לתנאים</h2>
            <p>
              השימוש באתר ובשירותים של Garden of Eden (&quot;האקדמיה&quot;) מהווה הסכמה
              לתנאי שימוש אלה. אם אינכם מסכימים לתנאים, אנא הימנעו משימוש בשירותים.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">תיאור השירותים</h2>
            <p>
              האקדמיה מספקת שירותי אימון כדורגל, מעקב ביצועים והערכות לשחקנים.
              השירותים כוללים אימונים פרונטליים, תוכניות אימון מותאמות אישית,
              וגישה לפלטפורמה הדיגיטלית שלנו.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">הרשמה וחשבון משתמש</h2>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>עליכם לספק מידע מדויק ועדכני בעת ההרשמה</li>
              <li>אתם אחראים לשמירה על סודיות פרטי הכניסה שלכם</li>
              <li>יש להודיע לנו מיד על כל שימוש לא מורשה בחשבונכם</li>
              <li>רישום קטינים מחייב הסכמת הורה או אפוטרופוס</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">תשלום ומחירים</h2>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>המחירים מפורסמים באתר ועשויים להשתנות מעת לעת</li>
              <li>התשלום נדרש מראש לפי תנאי התוכנית הנבחרת</li>
              <li>החזרים יינתנו בהתאם למדיניות הביטולים שלנו</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">מדיניות ביטולים</h2>
            <p className="mb-4">
              ניתן לבטל השתתפות בתוכנית בכפוף לתנאים הבאים:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>ביטול עד 14 יום לפני תחילת התוכנית - החזר מלא</li>
              <li>ביטול עד 7 ימים לפני תחילת התוכנית - החזר של 50%</li>
              <li>ביטול פחות מ-7 ימים לפני תחילת התוכנית - ללא החזר</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">התנהגות נאותה</h2>
            <p className="mb-4">בעת השימוש בשירותים שלנו, עליכם:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>לנהוג בכבוד כלפי מאמנים, צוות ומשתתפים אחרים</li>
              <li>להקפיד על בטיחות בזמן האימונים</li>
              <li>לא להעתיק או להפיץ תכנים מהפלטפורמה ללא אישור</li>
              <li>לא לעשות שימוש לרעה בשירותים או בפלטפורמה</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">קניין רוחני</h2>
            <p>
              כל התכנים באתר ובפלטפורמה, כולל סרטונים, תוכניות אימון, לוגו ועיצובים,
              הם קניינה הבלעדי של האקדמיה ומוגנים בזכויות יוצרים. אין להעתיק,
              להפיץ או לעשות שימוש מסחרי בתכנים ללא אישור בכתב.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">הגבלת אחריות</h2>
            <p>
              האקדמיה לא תהיה אחראית לנזקים ישירים או עקיפים הנובעים מהשתתפות
              באימונים או משימוש בפלטפורמה. ההשתתפות באימונים היא על אחריותכם
              הבלעדית, ומומלץ להתייעץ עם רופא לפני תחילת פעילות גופנית.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">שינויים בתנאים</h2>
            <p>
              אנו שומרים על הזכות לעדכן תנאים אלה בכל עת. שינויים יפורסמו באתר
              והמשך השימוש בשירותים לאחר העדכון מהווה הסכמה לתנאים החדשים.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">יצירת קשר</h2>
            <p>
              לשאלות בנוגע לתנאי השימוש, ניתן לפנות אלינו בטלפון{" "}
              <a href="tel:+972525779446" className="text-[#CDEA68] hover:underline">
                052-577-9446
              </a>{" "}
              או דרך{" "}
              <a
                href="https://wa.me/972525779446"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#CDEA68] hover:underline"
              >
                וואטסאפ
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">דין חל וסמכות שיפוט</h2>
            <p>
              תנאי שימוש אלה כפופים לדיני מדינת ישראל. כל סכסוך יתברר בבתי המשפט
              המוסמכים במחוז חיפה.
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
