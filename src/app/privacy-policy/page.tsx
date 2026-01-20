import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "מדיניות פרטיות - Garden of Eden",
  description: "מדיניות הפרטיות של אקדמיית Garden of Eden",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-[#F5F5F0] min-h-screen">
      <Navbar />

      <div className="container mx-auto px-6 py-24 max-w-4xl">
        <h1 className="text-4xl font-bold mb-12 text-[#1a1a1a]">מדיניות פרטיות</h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <p className="text-lg">
            עודכן לאחרונה: ינואר 2025
          </p>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">כללי</h2>
            <p>
              Garden of Eden (&quot;האקדמיה&quot;, &quot;אנחנו&quot;) מכבדת את פרטיות המשתמשים
              באתר ובשירותים שלנו. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים
              ומגנים על המידע האישי שלכם.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">איסוף מידע</h2>
            <p className="mb-4">אנו אוספים את סוגי המידע הבאים:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>מידע אישי: שם, כתובת דוא&quot;ל, מספר טלפון</li>
              <li>מידע על ספורטאים: גיל, מיקום משחק, קבוצה</li>
              <li>נתוני ביצועים והערכות אימון</li>
              <li>מידע טכני: כתובת IP, סוג דפדפן, זמני גישה</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">שימוש במידע</h2>
            <p className="mb-4">אנו משתמשים במידע שנאסף למטרות הבאות:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>מתן שירותי אימון ומעקב התקדמות</li>
              <li>יצירת קשר ותמיכה</li>
              <li>שיפור השירותים שלנו</li>
              <li>שליחת עדכונים ומידע רלוונטי (בהסכמתכם)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">אבטחת מידע</h2>
            <p>
              אנו נוקטים באמצעי אבטחה מתקדמים להגנה על המידע שלכם, כולל הצפנה,
              גישה מוגבלת ואחסון מאובטח. עם זאת, אין אפשרות להבטיח אבטחה מוחלטת
              בהעברת מידע באינטרנט.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">שיתוף מידע עם צדדים שלישיים</h2>
            <p>
              איננו מוכרים או משתפים את המידע האישי שלכם עם צדדים שלישיים למטרות
              שיווקיות. ייתכן שנשתף מידע עם ספקי שירות הפועלים מטעמנו, תוך הקפדה
              על סודיות ואבטחת המידע.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">זכויותיכם</h2>
            <p className="mb-4">יש לכם את הזכויות הבאות בנוגע למידע האישי שלכם:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>גישה למידע שנאסף עליכם</li>
              <li>תיקון מידע שגוי</li>
              <li>מחיקת המידע (בכפוף למגבלות חוקיות)</li>
              <li>התנגדות לעיבוד המידע</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">עוגיות (Cookies)</h2>
            <p>
              האתר שלנו משתמש בעוגיות לשיפור חווית המשתמש ולצורכי ניתוח. ניתן
              לשנות את הגדרות הדפדפן כדי לחסום עוגיות, אך הדבר עלול להשפיע על
              פונקציונליות האתר.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">יצירת קשר</h2>
            <p>
              לשאלות או בקשות בנוגע לפרטיות, ניתן לפנות אלינו בטלפון{" "}
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
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">שינויים במדיניות</h2>
            <p>
              אנו עשויים לעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו באתר
              ויכנסו לתוקף מיד עם פרסומם.
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
