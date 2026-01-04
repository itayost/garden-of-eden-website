"use client";

import { motion } from "framer-motion";
import { Heart, Brain, Activity, BarChart3, Play } from "lucide-react";
import { useState } from "react";

const pillars = [
  {
    icon: Heart,
    title: "אורח חיים ספורטיבי",
    description:
      "אנחנו מלמדים יותר מכדורגל - אנחנו בונים אורח חיים בריא שמלווה את השחקנים לכל החיים. תזונה נכונה, שינה איכותית ואיזון בין אימונים למנוחה.",
    number: "01",
    color: "#F43F5E",
  },
  {
    icon: Activity,
    title: "יכולות אתלטיות",
    description:
      "פיתוח כוח, מהירות, זריזות וסיבולת באמצעות שיטות אימון מתקדמות. כל שחקן מקבל תוכנית מותאמת אישית לגילו וליכולותיו.",
    number: "02",
    color: "#22C55E",
  },
  {
    icon: Brain,
    title: "חוסן מנטלי",
    description:
      "כדורגל הוא משחק של ראש. אנחנו מפתחים יכולות מנטליות כמו התמודדות עם לחץ, ריכוז, ביטחון עצמי והתאוששות מטעויות.",
    number: "03",
    color: "#8B5CF6",
  },
  {
    icon: BarChart3,
    title: "ניתוח טכני-טקטי",
    description:
      "באמצעות צילומי וידאו וניתוח מעמיק אנחנו עוזרים לכל שחקן להבין את נקודות החוזק והחולשה שלו ולשפר את המשחק שלו.",
    number: "04",
    color: "#F59E0B",
  },
];

export function Philosophy() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section id="philosophy" className="relative py-32 bg-[#FFFDF5] overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-1/2 h-full bg-[#0A1F0A] clip-diagonal" />

      {/* Floating shapes */}
      <motion.div
        className="absolute top-20 right-20 w-32 h-32 border-4 border-[#22C55E]/20 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute bottom-40 left-1/3 w-24 h-24 border-4 border-[#F59E0B]/20"
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="grid lg:grid-cols-2 gap-16 mb-20">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-2 rounded-full bg-[#22C55E] text-[#0A1F0A] text-sm font-bold mb-6">
              הפילוסופיה שלנו
            </span>
            <h2 className="text-4xl md:text-6xl font-bold text-[#FFFDF5] leading-tight">
              ארבעת עמודי
              <br />
              <span className="gradient-text-gold">התווך</span>
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-end"
          >
            <p className="text-xl text-[#0A1F0A]/70 leading-relaxed">
              הגישה המקיפה שלנו לפיתוח שחקנים מבוססת על ארבעה עמודי תווך שמייצרים יחד שחקן שלם - פיזית, מנטלית וטקטית.
            </p>
          </motion.div>
        </div>

        {/* Pillars grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="group relative"
            >
              <div
                className="relative bg-[#0A1F0A] rounded-3xl p-8 h-full overflow-hidden transition-all duration-500"
                style={{
                  boxShadow:
                    hoveredIndex === index
                      ? `0 0 60px ${pillar.color}30, 0 25px 50px -12px rgba(0, 0, 0, 0.5)`
                      : "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                }}
              >
                {/* Number watermark */}
                <span
                  className="absolute -top-4 -right-4 text-[8rem] font-display leading-none opacity-5 select-none"
                  style={{ color: pillar.color }}
                >
                  {pillar.number}
                </span>

                {/* Hover gradient overlay */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `linear-gradient(135deg, ${pillar.color}10 0%, transparent 50%)`,
                  }}
                />

                <div className="relative z-10 flex gap-6">
                  {/* Icon */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${pillar.color}20` }}
                  >
                    <pillar.icon className="h-8 w-8" style={{ color: pillar.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-[#FFFDF5] mb-3 group-hover:translate-x-2 transition-transform duration-300">
                      {pillar.title}
                    </h3>
                    <p className="text-[#FFFDF5]/60 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>

                {/* Bottom accent line */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"
                  style={{ backgroundColor: pillar.color }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Video CTA section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-20"
        >
          <div className="relative rounded-3xl overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0A1F0A] via-[#142814] to-[#0A1F0A]" />

            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#22C55E]/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#F59E0B]/10 rounded-full blur-3xl" />

            <div className="relative z-10 grid lg:grid-cols-2 gap-8 p-12">
              {/* Text content */}
              <div className="flex flex-col justify-center">
                <h3 className="text-3xl md:text-4xl font-bold text-[#FFFDF5] mb-4">
                  רוצים לראות אותנו
                  <br />
                  <span className="gradient-text-green">בפעולה?</span>
                </h3>
                <p className="text-[#FFFDF5]/60 text-lg mb-6">
                  צפו בסרטון ותראו איך נראה אימון אצלנו - האווירה, השיטות והתוצאות
                </p>
                <div className="flex items-center gap-4 text-[#22C55E]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                    <span className="font-medium">30-40 דקות</span>
                  </div>
                  <span className="text-[#FFFDF5]/30">|</span>
                  <span className="font-medium">5 ימי אימון שונים</span>
                </div>
              </div>

              {/* Video placeholder */}
              <div className="relative">
                <div className="aspect-video bg-[#1C1917] rounded-2xl flex items-center justify-center group cursor-pointer overflow-hidden border border-[#22C55E]/20">
                  {/* Play button */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-20 h-20 rounded-full bg-[#22C55E] flex items-center justify-center glow-green"
                  >
                    <Play className="h-8 w-8 text-[#0A1F0A] mr-[-4px]" fill="currentColor" />
                  </motion.div>

                  {/* Overlay text */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-[#0A1F0A]/80 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                      <span className="text-[#FFFDF5]/60 text-sm">סרטון בקרוב...</span>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-3 -right-3 px-4 py-2 bg-[#F59E0B] rounded-full text-[#0A1F0A] font-bold text-sm shadow-lg">
                  חדש!
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
