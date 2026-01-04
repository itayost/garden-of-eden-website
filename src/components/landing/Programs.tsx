"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Zap, Activity, Target, ArrowLeft, X, Clock, Users, Calendar, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const programs = [
  {
    icon: Activity,
    title: "בניית אורח חיים ספורטיבי",
    description: "ליווי מקיף לבניית שגרה ספורטיבית מקצועית",
    featured: true,
    fullDescription: "תוכנית מקיפה לבניית אורח חיים ספורטיבי מקצועי. אנו מלווים את השחקן בכל היבט - מתזונה ועד מדידות גופניות, עם קשר אישי ועדכונים שוטפים.",
    duration: "מותאם אישית",
    groupSize: "אישי / קבוצתי",
    schedule: "לפי תיאום",
    level: "כל הרמות",
    image: "/landing/lifestyle.webp",
    benefits: [
      "מעקב תזונתי והכוונה שוטפת",
      "מבדקי אתלטיקה רבעוניים",
      "מדידות גופניות חודשיות",
      "קשר אישי ועדכונים שוטפים",
    ],
  },
  {
    icon: Zap,
    title: "שיפור יכולות האתלטיקה",
    description: "פיתוח כוח, מהירות, סיבולת וגמישות",
    featured: false,
    fullDescription: "תוכנית אימונים מקיפה לשיפור כל היכולות האתלטיות - מכוח פונקציונלי ועד גמישות מפרקית, עם דגש על טכניקה מדויקת והתאוששות ספורטיבית.",
    duration: "60-90 דקות",
    groupSize: "עד 8 משתתפים",
    schedule: "ראשון עד חמישי",
    level: "כל הרמות",
    image: "/landing/agility.webp",
    benefits: [
      "פיתוח כוח פונקציונלי ושרירי מפתח",
      "שיפור קואורדינציה ויציבות דינמית",
      "העלאת סיבולת לב־ריאה וכושר אירובי/אנאירובי",
      "שיפור מהירות תגובה וחדות",
      "הרחבת טווחי תנועה וגמישות",
      "פיתוח טכניקה וביצוע מדויק",
    ],
  },
  {
    icon: Target,
    title: "בניית חוסן מנטלי",
    description: "פיתוח גישה מנצחת וביטחון עצמי",
    featured: false,
    fullDescription: "תוכנית ייחודית לפיתוח החוסן המנטלי של השחקן. מיקוד במטרות, טכניקות הרפיה, ויחסי אמון עם אנשי המקצוע שלנו - הכל במסגרת מקצועית ותומכת.",
    duration: "45-60 דקות",
    groupSize: "אישי / קבוצתי קטן",
    schedule: "לפי תיאום",
    level: "כל הרמות",
    image: "/landing/focus-drill.webp",
    benefits: [
      "מיקוד במטרות קצרות וארוכות טווח",
      "תרגול טכניקות הרפיה",
      "פיתוח גישה חיובית",
      "יחסי אמון וקשר אישי יומי",
      "מסגרת מקצועית לביטחון השחקן",
    ],
  },
  {
    icon: Dumbbell,
    title: "ניתוח ושיפור טקטי-טכני",
    description: "ניתוח וידאו מקצועי ומשוב אישי",
    featured: false,
    fullDescription: "ניתוח מעמיק של פעולות השחקן באמצעות וידאו ואנליסט כדורגל מנוסה. קבלת קטעי וידאו בעריכה מקצועית, משוב מקצועי והצבת יעדים ממשחק למשחק.",
    duration: "60 דקות",
    groupSize: "אישי",
    schedule: "שני, חמישי",
    level: "בינוני-מתקדם",
    image: "/landing/hero.webp",
    benefits: [
      "ניתוח פעולות באמצעות וידאו מקצועי",
      "קטעי וידאו בעריכה מקצועית",
      "משוב לשיפור הבנה טקטית וטכנית",
      "הצבת יעדים לפי עמדת השחקן",
      "אימון ממוקד בנקודות חולשה וחוזקה",
    ],
  },
];

export function Programs() {
  const [selectedProgram, setSelectedProgram] = useState<number | null>(null);
  const [hoveredProgram, setHoveredProgram] = useState<number | null>(null);

  const getWhatsAppMessage = (programTitle: string) => {
    const message = encodeURIComponent(`היי, אני מעוניין/ת בתוכנית ${programTitle}. אשמח לקבל פרטים נוספים!`);
    return `https://wa.me/972525779446?text=${message}`;
  };

  const currentProgram = selectedProgram !== null ? programs[selectedProgram] : null;

  return (
    <>
      <section id="programs" className="py-20 bg-[#F5F5F0]">
        <div className="container mx-auto px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row md:items-end md:justify-between mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-black">
              תוכניות מותאמות
              <br />
              לכל רמת כושר
            </h2>
            <p className="text-black/50 max-w-sm mt-4 md:mt-0">
              לחצו על כרטיס התוכנית לפרטים נוספים
            </p>
          </motion.div>

          {/* Programs grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {programs.map((program, index) => (
              <motion.div
                key={program.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative rounded-3xl overflow-hidden group cursor-pointer"
                onClick={() => setSelectedProgram(index)}
                onMouseEnter={() => setHoveredProgram(index)}
                onMouseLeave={() => setHoveredProgram(null)}
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  className="h-full p-6 flex flex-col relative min-h-[450px]"
                  style={{
                    backgroundImage: `url(${program.image})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {/* Dark overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40" />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-[#CDEA68]/0 group-hover:bg-[#CDEA68]/10 transition-colors duration-300" />

                  {/* Icon badge */}
                  <motion.div
                    animate={{
                      scale: hoveredProgram === index ? 1.1 : 1,
                      backgroundColor: hoveredProgram === index ? "rgba(205, 234, 104, 0.2)" : "rgba(255, 255, 255, 0.1)",
                    }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-auto relative z-10"
                  >
                    <program.icon className="w-5 h-5 text-[#CDEA68]" />
                  </motion.div>

                  {/* Content */}
                  <div className="mt-auto relative z-10">
                    <h3 className="text-white font-bold text-xl mb-2">{program.title}</h3>

                    <AnimatePresence mode="wait">
                      {hoveredProgram === index ? (
                        <motion.div
                          key="hover"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                        >
                          <div className="flex items-center gap-4 text-white/60 text-xs mb-3">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {program.duration}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {program.groupSize}
                            </span>
                          </div>
                          <span className="flex items-center gap-2 text-[#CDEA68] text-sm font-medium">
                            לחצו לפרטים
                            <ArrowLeft className="w-4 h-4" />
                          </span>
                        </motion.div>
                      ) : (
                        <motion.p
                          key="default"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="text-white/50 text-sm mb-4"
                        >
                          {program.description}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {hoveredProgram !== index && (
                      <button className="flex items-center gap-2 text-[#CDEA68] text-sm font-medium group-hover:gap-3 transition-all">
                        למידע נוסף
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Level badge */}
                  <div className="absolute top-4 left-4 px-2 py-1 rounded-full bg-white/10 text-white/60 text-xs">
                    {program.level}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Program Detail Modal */}
      <AnimatePresence>
        {currentProgram && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setSelectedProgram(null)}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedProgram(null)}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="סגור"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Modal content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] rounded-3xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-8 border-b border-white/10">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#CDEA68]/20 flex items-center justify-center flex-shrink-0">
                    <currentProgram.icon className="w-7 h-7 text-[#CDEA68]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-2xl mb-2">{currentProgram.title}</h3>
                    <p className="text-white/60">{currentProgram.fullDescription}</p>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="p-8">
                {/* Info grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white/5 rounded-2xl p-4 text-center">
                    <Clock className="w-5 h-5 text-[#CDEA68] mx-auto mb-2" />
                    <span className="text-white/40 text-xs block mb-1">משך אימון</span>
                    <span className="text-white font-medium text-sm">{currentProgram.duration}</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 text-center">
                    <Users className="w-5 h-5 text-[#CDEA68] mx-auto mb-2" />
                    <span className="text-white/40 text-xs block mb-1">גודל קבוצה</span>
                    <span className="text-white font-medium text-sm">{currentProgram.groupSize}</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 text-center">
                    <Calendar className="w-5 h-5 text-[#CDEA68] mx-auto mb-2" />
                    <span className="text-white/40 text-xs block mb-1">ימים</span>
                    <span className="text-white font-medium text-sm">{currentProgram.schedule}</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 text-center">
                    <Target className="w-5 h-5 text-[#CDEA68] mx-auto mb-2" />
                    <span className="text-white/40 text-xs block mb-1">רמה</span>
                    <span className="text-white font-medium text-sm">{currentProgram.level}</span>
                  </div>
                </div>

                {/* Benefits */}
                <div className="mb-8">
                  <h4 className="text-white font-bold mb-4">מה תרוויחו מהתוכנית?</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {currentProgram.benefits.map((benefit, index) => (
                      <motion.div
                        key={benefit}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3"
                      >
                        <div className="w-2 h-2 rounded-full bg-[#CDEA68]" />
                        <span className="text-white/70 text-sm">{benefit}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <Button
                  className="w-full py-6 rounded-full bg-[#CDEA68] hover:bg-[#bdd85c] text-black font-medium text-lg"
                  asChild
                >
                  <a
                    href={getWhatsAppMessage(currentProgram.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="w-5 h-5 ml-2" />
                    להרשמה לתוכנית
                  </a>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
