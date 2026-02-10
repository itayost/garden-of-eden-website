"use client";

import { motion } from "framer-motion";

const videos = [
  { id: "6GdTCLUmS6Q", title: "המלצת הורים" },
  { id: "tLs7ST6MQi8", title: "המלצת הורים" },
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

        {/* Videos grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {videos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="aspect-[9/16] rounded-3xl overflow-hidden bg-black shadow-lg">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${video.id}`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  className="border-0"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
