"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Play, X, Dumbbell, Target, Brain, Video, Apple } from "lucide-react";
import { useState } from "react";

// 4 Core Values - Updated content
const categories = [
  {
    label: "שפרו את אורח החיים הספורטיבי",
    description: "אנחנו מאמינים שמעטפת מקצועית טובה יכולה להוביל להצלחה בקריירה.",
  },
  {
    label: "הכוונה אישית",
    description: "תוכניות האימון שלנו מותאמות ספציפית לשחקן כדי ליצור שינוי אמיתי - פיזי, מנטלי וטקטי.",
  },
  {
    label: "מסע הכושר",
    description: "כל שחקן בכל גיל נמצא בנקודה אחרת במסע שלו עם המאפיינים הספורטיביים הנחוצים לו. אנחנו מתאימים את התוכנית לשלב שבו אתם נמצאים.",
  },
  {
    label: "שקיפות בתהליך",
    description: "תהליך ההתפתחות של השחקן מתועד בכל שלב וזמין לצפייה אצלנו במערכת.",
  },
];

// Full player support package - 5 areas
const supportPackage = [
  {
    icon: Dumbbell,
    title: "אימונים אתלטיים",
    description: "פיתוח יכולות גופניות מתקדמות",
  },
  {
    icon: Target,
    title: "אימוני כדורגל",
    description: "שיפור טכניקה וטקטיקה",
  },
  {
    icon: Apple,
    title: "תהליכי תזונה",
    description: "תפריט מותאם אישית לספורטאים",
  },
  {
    icon: Brain,
    title: "אימונים מנטליים",
    description: "חוסן נפשי והכנה לתחרויות",
  },
  {
    icon: Video,
    title: "ניתוחי וידאו",
    description: "ניתוח משחקים עם אנליסט מקצועי",
  },
];

export function About() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <>
      <section id="about" className="py-20 bg-[#F5F5F0]">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left side */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-sm text-black/50 mb-2 block">גלו עוד</span>
              <h2 className="text-4xl md:text-5xl font-bold text-black mb-8">
                אודותינו
              </h2>

              {/* Video card - clickable */}
              <button
                onClick={() => setIsVideoOpen(true)}
                className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden group cursor-pointer text-right"
                aria-label="לחצו לצפייה בסרטון אודות Garden of Eden"
              >
                {/* Video thumbnail/preview */}
                <video
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  autoPlay
                  poster="/landing/athletic.webp"
                  aria-hidden="true"
                >
                  <source src="/landing/promo-video.mp4" type="video/mp4" />
                </video>
                {/* Overlay for text readability */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-20 h-20 rounded-full bg-[#CDEA68] flex items-center justify-center shadow-lg"
                  >
                    <Play className="w-8 h-8 text-black fill-black mr-[-4px]" />
                  </motion.div>
                </div>

              </button>

              <p className="text-black/60 mt-6 leading-relaxed">
                צפו איך אנחנו משנים את עולם הכושר עם מאמנים מוסמכים, כלים מתקדמים ותוכניות מותאמות אישית עבורכם.
              </p>
            </motion.div>

            {/* Right side - Categories with content */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex flex-col gap-3"
            >
              {categories.map((cat, index) => (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(index)}
                  className={`px-6 py-4 rounded-2xl text-right font-medium transition-all duration-300 ${
                    activeCategory === index
                      ? "bg-[#CDEA68] text-black"
                      : "bg-transparent border border-black/20 text-black/60 hover:border-black/40"
                  }`}
                >
                  <span className="block font-bold">{cat.label}</span>
                  <AnimatePresence mode="wait">
                    {activeCategory === index && (
                      <motion.span
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="block text-sm font-normal mt-2 text-black/70"
                      >
                        {cat.description}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              ))}
            </motion.div>
          </div>

          {/* Why Choose Us - Full Player Support Package */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-24"
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-black">
                למה לבחור בנו?
              </h2>
              <p className="text-black/50 max-w-md mt-4 md:mt-0">
                מעטפת מלאה לשחקן - הכל מה שאתם צריכים להצלחה בקריירה
              </p>
            </div>

            {/* Support package cards - 5 items */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {supportPackage.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  className="bg-white rounded-3xl p-6 border border-black/10 hover:border-[#CDEA68]/50 hover:shadow-lg transition-all duration-300 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#CDEA68]/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-7 h-7 text-[#CDEA68]" />
                  </div>
                  <h3 className="text-black font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-black/50 text-sm">{item.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Video Modal */}
      <AnimatePresence>
        {isVideoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setIsVideoOpen(false)}
          >
            {/* Close button */}
            <button
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="סגור"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Video container */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl aspect-video bg-[#1a1a1a] rounded-2xl overflow-hidden"
            >
              <video
                className="w-full h-full object-cover"
                controls
                autoPlay
                playsInline
                poster="/landing/athletic.webp"
                aria-label="סרטון תדמית של Garden of Eden"
              >
                <source src="/landing/promo-video.mp4" type="video/mp4" />
                הדפדפן שלך אינו תומך בוידאו
              </video>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
