"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const staffMembers = [
  { name: "עדן בן חמו", role: "מייסד גארדן אוף עדן", image: "", founder: true },
  { name: "עידו ברק", role: "מאמן כדורגל ואנליסט וידיאו", image: "" },
  { name: "לידור זנטי", role: "מאמן יכולות אתלטיות", image: "" },
  { name: "נדב דטנר", role: "מאמן יכולות אתלטיות", image: "" },
  { name: "דין לוי", role: "מאמן יכולות אתלטיות", image: "" },
  { name: "דניאל קמרט", role: "תזונאי קליני", image: "" },
  { name: "אביעד וכשטוק", role: "מאמן יכולות אתלטיות", image: "" },
  { name: "יוני דנינו", role: "ספורטרפיסט", image: "" },
  { name: "גבריאל פיזיסקי", role: "פיזוטרפיסט", image: "" },
  { name: "חוסין סקר", role: "דוקטור ספורט", image: "" },
  { name: "עמית סוארי", role: "מאמן שוערים", image: "" },
];

function getInitials(name: string) {
  const parts = name.split(" ");
  return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : parts[0][0];
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
          <div className="rounded-3xl p-6 md:p-8 bg-white border-2 border-[#CDEA68] shadow-lg flex flex-col md:flex-row items-center gap-6">
            {founder.image ? (
              <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={founder.image}
                  alt={founder.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-[#CDEA68]/15 flex items-center justify-center flex-shrink-0">
                <span className="text-[#CDEA68] text-3xl md:text-4xl font-bold">
                  {getInitials(founder.name)}
                </span>
              </div>
            )}
            <div className="text-center md:text-start">
              <h3 className="text-xl md:text-2xl font-bold text-black mb-1">
                {founder.name}
              </h3>
              <p className="text-black/50">{founder.role}</p>
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
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#CDEA68]/15 flex items-center justify-center mb-4">
                  <span className="text-[#CDEA68] text-xl md:text-2xl font-bold">
                    {getInitials(member.name)}
                  </span>
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
