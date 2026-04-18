"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const staffMembers = [
  { name: "עדן בן חמו", role: "מייסד גארדן אוף עדן", image: "/landing/staff/eden-ben-hamo.webp", founder: true },
  { name: "עידו ברק", role: "מאמן כדורגל ואנליסט וידיאו", image: "" },
  { name: "לידור זנטי", role: "מאמן יכולות אתלטיות", image: "/landing/staff/lidor-hay-zinti.webp" },
  { name: "נדב דטנר", role: "מאמן יכולות אתלטיות", image: "/landing/staff/nadav-datner.webp" },
  { name: "דין לוי", role: "מאמן יכולות אתלטיות", image: "/landing/staff/dean-levi.webp" },
  { name: "דניאל קמרט", role: "תזונאי קליני", image: "/landing/staff/daniel-kamrat.webp" },
  { name: "אביעד וכשטוק", role: "מאמן יכולות אתלטיות", image: "/landing/staff/aviad-vachshtok.webp" },
  { name: "יוני דנינו", role: "ספורטרפיסט", image: "/landing/staff/yoni-danino.webp" },
  { name: "גבריאל פיזיסקי", role: "פיזוטרפיסט", image: "" },
  { name: "חוסין סקר", role: "דוקטור ספורט", image: "" },
  { name: "עמית סוארי", role: "מאמן שוערים", image: "/landing/staff/amit-suari.webp" },
  { name: "רן אטיאס", role: "מאמן יכולות אתלטיות", image: "/landing/staff/ran-atias.webp" },
  { name: "עומר לוינגר", role: "מאמן מנטלי", image: "/landing/staff/omer-levinger.webp" },
];

function getInitials(name: string) {
  const parts = name.split(" ");
  return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : parts[0][0];
}

function LeafMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
    </svg>
  );
}

function InitialsAvatar({ name, size }: { name: string; size: "sm" | "lg" }) {
  const dimensions =
    size === "lg"
      ? "w-24 h-24 md:w-32 md:h-32"
      : "w-20 h-20 md:w-24 md:h-24";
  const textSize =
    size === "lg" ? "text-3xl md:text-4xl" : "text-xl md:text-2xl";

  return (
    <div
      className={`relative ${dimensions} rounded-full bg-[#CDEA68] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-[inset_0_-10px_18px_rgba(0,0,0,0.06)]`}
    >
      <LeafMark className="absolute -top-1 -end-1 w-10 h-10 text-black/10 rotate-12" />
      <span
        className={`relative font-black text-black/80 tracking-tight ${textSize}`}
      >
        {getInitials(name)}
      </span>
    </div>
  );
}

export function Staff() {
  const founder = staffMembers[0];
  const rest = staffMembers.slice(1);

  return (
    <section id="staff" className="py-20 bg-[#F5F5F0]">
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#CDEA68]/20 text-black/70 text-sm font-medium mb-4">
            הצוות שלנו
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-4">
            הכירו את המומחים
          </h2>
          <p className="text-black/50 max-w-md mx-auto">
            צוות מקצועי ומנוסה שמלווה את השחקנים בכל שלב במסע להצלחה
          </p>
        </motion.div>

        {/* Founder card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-4 md:mb-6"
        >
          <div className="relative overflow-hidden rounded-3xl p-6 md:p-10 bg-white border-2 border-[#CDEA68] shadow-lg flex flex-col md:flex-row items-center gap-6 md:gap-10 md:justify-between">
            {/* decorative brand leaves on the empty side */}
            <LeafMark
              className="hidden md:block absolute start-6 top-6 w-24 h-24 text-[#CDEA68]/40 -rotate-12 pointer-events-none"
            />
            <LeafMark
              className="hidden md:block absolute start-24 bottom-4 w-16 h-16 text-[#CDEA68]/20 rotate-45 pointer-events-none"
            />

            {founder.image ? (
              <div className="relative w-28 h-28 md:w-40 md:h-40 rounded-full overflow-hidden flex-shrink-0 ring-4 ring-[#CDEA68]/30">
                <Image
                  src={founder.image}
                  alt={founder.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <InitialsAvatar name={founder.name} size="lg" />
            )}

            <div className="relative text-center md:text-start md:flex-1 md:ps-2">
              <span className="inline-block px-3 py-1 rounded-full bg-[#CDEA68] text-black/80 text-xs font-bold tracking-widest mb-3">
                מייסד
              </span>
              <h3 className="text-2xl md:text-3xl font-bold text-black mb-1">
                {founder.name}
              </h3>
              <p className="text-black/50 md:text-lg">{founder.role}</p>
            </div>
          </div>
        </motion.div>

        {/* Staff grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {rest.map((member, index) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="rounded-3xl p-6 bg-white border border-black/10 hover:border-black/20 hover:shadow-md transition-all duration-300 flex flex-col items-center text-center"
            >
              {member.image ? (
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden mb-4">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="mb-4">
                  <InitialsAvatar name={member.name} size="sm" />
                </div>
              )}
              <h3 className="font-bold text-black mb-1">{member.name}</h3>
              <p className="text-black/50 text-sm">{member.role}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
