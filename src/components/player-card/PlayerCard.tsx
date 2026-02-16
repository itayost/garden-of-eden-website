"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  STAT_LABELS_SHORT,
  type CardType,
  type PlayerPosition,
  type MainStatKey,
} from "@/types/player-stats";

interface MainStats {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

interface PlayerCardProps {
  playerName: string;
  position: PlayerPosition;
  cardType: CardType;
  overallRating: number;
  stats: MainStats;
  avatarUrl?: string;
  className?: string;
  linkToStats?: boolean;
  size?: "sm" | "md" | "lg";
}

// Card template images and text colors for each type
const CARD_CONFIG: Record<
  CardType,
  {
    templateImage: string;
    textColor: string;
    statLabelColor: string;
    glowColor: string;
  }
> = {
  gold: {
    templateImage: "/card-template-gold.webp",
    textColor: "#3d2a0f",
    statLabelColor: "#5c4317",
    glowColor: "rgba(212, 169, 60, 0.6)",
  },
  silver: {
    templateImage: "/card-template-gold.webp",
    textColor: "#2a2a2a",
    statLabelColor: "#4a4a4a",
    glowColor: "rgba(168, 168, 168, 0.6)",
  },
  bronze: {
    templateImage: "/card-template-gold.webp",
    textColor: "#3d1f0f",
    statLabelColor: "#5c3517",
    glowColor: "rgba(168, 103, 50, 0.6)",
  },
  standard: {
    templateImage: "/card-template-gold.webp",
    textColor: "#2a2a2a",
    statLabelColor: "#4a4a4a",
    glowColor: "rgba(102, 102, 102, 0.6)",
  },
  special: {
    templateImage: "/card-template-gold.webp",
    textColor: "#3d0f3d",
    statLabelColor: "#5c175c",
    glowColor: "rgba(147, 51, 234, 0.6)",
  },
};

export function PlayerCard({
  playerName,
  position,
  cardType,
  overallRating,
  stats,
  avatarUrl,
  className,
  linkToStats = true,
  size = "md",
}: PlayerCardProps) {
  const config = CARD_CONFIG[cardType] || CARD_CONFIG.gold;

  const sizeConfig = {
    sm: {
      width: 140,
      height: 196,
      ratingSize: 32,
      positionSize: 12,
      nameSize: 11,
      statLabelSize: 7,
      statValueSize: 9,
      avatarSize: 65,
    },
    md: {
      width: 180,
      height: 252,
      ratingSize: 40,
      positionSize: 14,
      nameSize: 13,
      statLabelSize: 8,
      statValueSize: 11,
      avatarSize: 85,
    },
    lg: {
      width: 240,
      height: 336,
      ratingSize: 52,
      positionSize: 18,
      nameSize: 16,
      statLabelSize: 10,
      statValueSize: 14,
      avatarSize: 115,
    },
  };

  const s = sizeConfig[size];

  // EA FC stats order: PAC, SHO, PAS, DRI, DEF, PHY
  const statOrder: MainStatKey[] = ["pace", "shooting", "passing", "dribbling", "defending", "physical"];

  const cardContent = (
    <motion.div
      dir="ltr"
      whileHover={{ scale: 1.03, y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn("relative cursor-pointer select-none", className)}
      style={{
        width: s.width,
        height: s.height,
        filter: `drop-shadow(0 8px 20px ${config.glowColor})`,
      }}
    >
      {/* Card template background */}
      <Image
        src={config.templateImage}
        alt="Card background"
        fill
        className="object-contain"
        priority
      />

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col">
        {/* Top section - Rating and Position (top-left) */}
        <div
          className="absolute flex flex-col items-center"
          style={{
            top: s.height * 0.1,
            left: s.width * 0.12,
          }}
        >
          {/* Overall rating */}
          <span
            className="font-black leading-none"
            style={{
              fontSize: s.ratingSize,
              color: config.textColor,
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            {overallRating}
          </span>
          {/* Position */}
          <span
            className="font-bold"
            style={{
              fontSize: s.positionSize,
              color: config.textColor,
              marginTop: 2,
            }}
          >
            {position}
          </span>
        </div>

        {/* Player avatar section - centered in card */}
        <div
          className="absolute flex items-center justify-center overflow-hidden"
          style={{
            top: s.height * 0.22,
            left: s.width * 0.2,
            right: s.width * 0.2,
            height: s.height * 0.42,
          }}
        >
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt={playerName}
              className="object-contain"
              style={{
                width: "100%",
                height: "100%",
              }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: s.avatarSize,
                height: s.avatarSize,
                background: "rgba(61, 42, 15, 0.12)",
                border: "2px solid rgba(61, 42, 15, 0.25)",
              }}
            >
              <span
                className="font-bold"
                style={{
                  fontSize: s.avatarSize * 0.45,
                  color: config.textColor,
                }}
              >
                {playerName.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Player name - in banner area */}
        <div
          className="absolute text-center font-bold uppercase truncate"
          style={{
            bottom: s.height * 0.28,
            left: s.width * 0.08,
            right: s.width * 0.08,
            fontSize: s.nameSize,
            color: config.textColor,
            letterSpacing: "0.05em",
          }}
        >
          {playerName}
        </div>

        {/* Stats row - 6 stats at bottom */}
        <div
          dir="ltr"
          className="absolute flex justify-center items-center"
          style={{
            bottom: s.height * 0.17,
            left: s.width * 0.06,
            right: s.width * 0.06,
            gap: s.width * 0.02,
          }}
        >
          {statOrder.map((key) => (
            <div
              key={key}
              className="flex flex-col items-center"
              style={{ minWidth: s.width * 0.12 }}
            >
              {/* Stat label */}
              <span
                className="font-semibold uppercase"
                style={{
                  fontSize: s.statLabelSize,
                  color: config.statLabelColor,
                  lineHeight: 1.2,
                }}
              >
                {STAT_LABELS_SHORT[key]}
              </span>
              {/* Stat value */}
              <span
                className="font-black"
                style={{
                  fontSize: s.statValueSize,
                  color: config.textColor,
                  lineHeight: 1.2,
                }}
              >
                {stats[key]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );

  if (linkToStats) {
    return (
      <Link href="/dashboard/stats" className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
