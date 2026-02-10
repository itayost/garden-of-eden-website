"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const faqItems = [
  {
    id: "faq-1",
    question: "מהן שעות הפעילות של המתחם?",
    answer: "המתחם פועל בימים א׳–ה׳ בשעות הבוקר והאחר הצהריים עד השעה 20:00 בערב, בהתאם ללוח האימונים.\nימי שישי 08:00-15:00",
  },
  {
    id: "faq-2",
    question: "כמה מתאמנים יש בכל אימון?",
    answer: "אנו עובדים בקבוצות קטנות ומבוקרות, כדי לשמור על יחס אישי ואיכות אימון גבוהה.\nמספר גדול של מאמנים בכל שעה במתחם בהתאמה לגיל ולסוג האימון.",
  },
  {
    id: "faq-3",
    question: "האם האימונים אישיים?",
    answer: "כן. האימונים הם בהתאמה אישית.\nכל מסלול מותאם למטרות השחקן.",
  },
  {
    id: "faq-4",
    question: "האם מתקיימים אימוני כדורגל במתחם?",
    answer: "כן. במתחם מתקיימים אימוני כדורגל מקצועיים, בדגש על:\n• טכניקה אישית\n• קבלת החלטות\n• פיתוח שחקן מודרני",
  },
  {
    id: "faq-5",
    question: "האם יש אימוני כושר ואתלטיקה?",
    answer: "בהחלט. אנו משלבים:\n• אימוני כוח\n• אתלטיקה ייעודית לספורטאים\n• חיזוק ומניעת פציעות",
  },
  {
    id: "faq-6",
    question: "האם עובדים על טכניקת ריצה?",
    answer: "כן. חלק מרכזי מהאימונים כולל:\n• טכניקת ריצה\n• שינויי כיוון\n• מהירות וזריזות\nבהתאמה לענף ולגיל המתאמן.",
  },
  {
    id: "faq-7",
    question: "האם יש תחבורה ציבורית למתחם?",
    answer: "כן. קיימת תחבורה ציבורית המגיעה בסמוך למתחם.",
  },
  {
    id: "faq-8",
    question: "האם עובדים בימי שישי?",
    answer: "כן, משעה 08:00-15:00",
  },
  {
    id: "faq-9",
    question: "איך ההורים יודעים מה קורה באימונים? יש מעקב?",
    answer: "כן. יש מעקב מקצועי שכולל:\n• עדכונים שוטפים\n• משוב על התקדמות\n• תקשורת פתוחה עם הצוות\nהמטרה היא שקיפות מלאה להורים ולשחקנים.",
  },
  {
    id: "faq-10",
    question: "האם יש תזונאי קליני?",
    answer: "כן. קיימת אפשרות לליווי תזונתי מקצועי ע״י תזונאי/ת קליני/ת, בהתאם למסלול.",
  },
  {
    id: "faq-11",
    question: "האם יש מאמן מנטלי?",
    answer: "כן. ניתן לשלב אימון מנטלי לפיתוח:\n• ביטחון עצמי\n• התמודדות עם לחץ\n• מיקוד ומוטיבציה",
  },
  {
    id: "faq-12",
    question: "האם יש צוות פיזיותרפיה?",
    answer: "כן. המתחם עובד בשיתוף עם אנשי מקצוע בתחום הפיזיותרפיה, לצורך שיקום, מניעה וליווי פציעות.",
  },
  {
    id: "faq-13",
    question: "כמה זמן תקפה כרטיסייה?",
    answer: "כרטיסייה תקפה לתקופה מוגדרת מראש (עד 3 חודשים), והיא מאפשרת גמישות בתיאום האימונים.",
  },
  {
    id: "faq-14",
    question: "איך קובעים את האימונים?",
    answer: "דרך האפליקציה שלנו.\nלאחר הרשמה לגארדן אוף עדן ניתן לשבץ בלו״ז האימונים.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 bg-[#F5F5F0]">
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm text-black/50 mb-2 block">שאלות נפוצות</span>
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-4">
            יש לכם שאלה?
          </h2>
          <p className="text-black/50 max-w-md mx-auto">
            ריכזנו עבורכם את השאלות הנפוצות ביותר
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto space-y-4">
          {faqItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-black/10 overflow-hidden"
            >
              <button
                id={`${item.id}-trigger`}
                onClick={() => toggleItem(index)}
                aria-expanded={openIndex === index}
                aria-controls={`${item.id}-content`}
                className="w-full px-6 py-5 flex items-center justify-between text-right hover:bg-black/[0.02] transition-colors"
              >
                <span className="font-medium text-black">{item.question}</span>
                <motion.span
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0 mr-4"
                >
                  <ChevronDown className="w-5 h-5 text-black/40" />
                </motion.span>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    id={`${item.id}-content`}
                    role="region"
                    aria-labelledby={`${item.id}-trigger`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-black/60 leading-relaxed border-t border-black/5 pt-4 whitespace-pre-line">
                      {item.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
