"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";

// Placeholder testimonials - to be replaced with content from Eden
const testimonials = [
  {
    id: 1,
    name: "שם ההורה",
    role: "הורה לשחקן",
    content: "המלצה מהורה - התוכן יסופק על ידי עדן. זהו טקסט זמני להדגמה בלבד.",
    image: null,
  },
  {
    id: 2,
    name: "שם ההורה",
    role: "הורה לשחקן",
    content: "המלצה מהורה - התוכן יסופק על ידי עדן. זהו טקסט זמני להדגמה בלבד.",
    image: null,
  },
  {
    id: 3,
    name: "שם ההורה",
    role: "הורה לשחקן",
    content: "המלצה מהורה - התוכן יסופק על ידי עדן. זהו טקסט זמני להדגמה בלבד.",
    image: null,
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-20 bg-[#F5F5F0]">
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm text-black/50 mb-2 block">המלצות</span>
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-4">
            מה ההורים אומרים
          </h2>
          <p className="text-black/50 max-w-md mx-auto">
            הורים משתפים את החוויה שלהם עם Garden of Eden
          </p>
        </motion.div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-3xl p-8 border border-black/10 hover:border-[#CDEA68]/50 hover:shadow-lg transition-all"
            >
              {/* Quote icon */}
              <div className="w-12 h-12 rounded-2xl bg-[#CDEA68]/10 flex items-center justify-center mb-6">
                <Quote className="w-6 h-6 text-[#CDEA68]" />
              </div>

              {/* Content */}
              <p className="text-black/60 mb-6 leading-relaxed">
                &ldquo;{testimonial.content}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-[#CDEA68]/20 flex items-center justify-center">
                  <span className="text-[#CDEA68] font-bold text-lg">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <span className="text-black font-medium block">{testimonial.name}</span>
                  <span className="text-black/40 text-sm">{testimonial.role}</span>
                </div>
              </div>
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
          * התוכן יעודכן עם המלצות אמיתיות מהורים
        </motion.p>
      </div>
    </section>
  );
}
