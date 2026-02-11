"use client";

import { WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface ConnectionBannerProps {
  isOnline: boolean;
  isReachable: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onRetry: () => void;
}

export function ConnectionBanner({
  isOnline,
  isReachable,
  pendingCount,
  isSyncing,
  onRetry,
}: ConnectionBannerProps) {
  const isOffline = !isOnline || !isReachable;
  const hasPending = pendingCount > 0;
  const isVisible = isOffline || hasPending;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div
            className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm mb-4 ${
              isOffline
                ? "bg-red-50 border border-red-200 text-red-800"
                : "bg-amber-50 border border-amber-200 text-amber-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {isOffline ? (
                <>
                  <WifiOff className="h-4 w-4 flex-shrink-0" />
                  <span>
                    אין חיבור לאינטרנט
                    {hasPending && (
                      <span className="font-medium">
                        {" "}
                        &middot; {pendingCount}{" "}
                        {pendingCount === 1 ? "פעולה ממתינה" : "פעולות ממתינות"}{" "}
                        לסנכרון
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <>
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span>
                    {isSyncing
                      ? "מסנכרן פעולות משמרת..."
                      : `${pendingCount} ${pendingCount === 1 ? "פעולה ממתינה" : "פעולות ממתינות"} לסנכרון`}
                  </span>
                </>
              )}
            </div>

            {!isOffline && hasPending && !isSyncing && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                <RefreshCw className="h-3 w-3 ml-1" />
                סנכרן עכשיו
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
