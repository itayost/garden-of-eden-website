"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

// Placeholder FAQ - to be replaced with content from Eden
const faqItems = [
  {
    id: "faq-1",
    question: "שאלה לדוגמה - מה כוללת התוכנית?",
    answer: "תשובה לדוגמה - התוכן יסופק על ידי עדן. זהו טקסט זמני להדגמה בלבד.",
  },
  {
    id: "faq-2",
    question: "שאלה לדוגמה - מתי מתקיימים האימונים?",
    answer: "תשובה לדוגמה - התוכן יסופק על ידי עדן. זהו טקסט זמני להדגמה בלבד.",
  },
  {
    id: "faq-3",
    question: "שאלה לדוגמה - האם יש אימון התנסות?",
    answer: "תשובה לדוגמה - התוכן יסופק על ידי עדן. זהו טקסט זמני להדגמה בלבד.",
  },
  {
    id: "faq-4",
    question: "שאלה לדוגמה - מהי מדיניות הביטולים?",
    answer: "תשובה לדוגמה - התוכן יסופק על ידי עדן. זהו טקסט זמני להדגמה בלבד.",
  },
  {
    id: "faq-5",
    question: "שאלה לדוגמה - לאילו גילאים מתאים?",
    answer: "תשובה לדוגמה - התוכן יסופק על ידי עדן. זהו טקסט זמני להדגמה בלבד.",
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
                onClick={() => toggleItem(index)}
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
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-black/60 leading-relaxed border-t border-black/5 pt-4">
                      {item.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Placeholder note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-black/30 text-sm mt-8"
        >
          * השאלות והתשובות יעודכנו בקרוב
        </motion.p>
      </div>
    </section>
  );
}
