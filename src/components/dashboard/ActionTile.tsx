"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Salad,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Icons resolve here, inside the client boundary — server pages pass a name.
// Component functions are not serializable across the Server→Client boundary.
const ICONS = {
  activity: Activity,
  brain: Brain,
  "clipboard-check": ClipboardCheck,
  salad: Salad,
  video: Video,
} satisfies Record<string, LucideIcon>;

export type ActionTileIcon = keyof typeof ICONS;

interface ActionTileProps {
  href: string;
  icon: ActionTileIcon;
  title: string;
  /** One short status line: "מולא היום", "שבת מול הפועל", a count, etc. */
  subtitle?: string;
  /** Marks the action as already done today — chip flips to grass. */
  completed?: boolean;
  /** Optional data-tour anchor passthrough for driver.js. */
  tourId?: string;
}

/**
 * The app's one action tile — replaces the two near-duplicate hand-rolled
 * grids (home Quick Actions and the forms index) that each used a different
 * random stock color per tile. Forest chip, gold icon, grass when done.
 */
export function ActionTile({
  href,
  icon,
  title,
  subtitle,
  completed = false,
  tourId,
}: ActionTileProps) {
  const Icon = ICONS[icon];

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
      data-tour={tourId}
    >
      <Link href={href} className="block h-full">
        <Card className="h-full rounded-2xl py-0 transition-shadow hover:shadow-md">
          <CardContent className="flex h-full flex-col gap-2 px-4 py-3.5">
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-xl",
                  completed ? "bg-grass" : "bg-forest",
                )}
              >
                {completed ? (
                  <Check className="h-5 w-5 text-white" strokeWidth={3} />
                ) : (
                  <Icon className="h-5 w-5 text-gold-light" />
                )}
              </span>
              {completed && (
                <Badge className="bg-grass/15 text-green-700 hover:bg-grass/15">
                  הושלם
                </Badge>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">{title}</p>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            <span className="mt-auto flex items-center gap-0.5 text-xs font-medium text-forest">
              כניסה
              <ChevronLeft className="h-3.5 w-3.5" />
            </span>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
