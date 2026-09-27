"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncArboxNowAction } from "@/features/plans/lib/actions/arbox-sync-now";

/** Runs the daytime part of the Arbox sync; can take about a minute. */
export function ArboxSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await syncArboxNowAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    } catch {
      toast.error("הסנכרון עם Arbox נכשל. נסו שוב מאוחר יותר.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleSync} disabled={loading}>
      {loading ? (
        <Loader2 className="me-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="me-2 h-4 w-4" />
      )}
      {loading ? "מסנכרן עם Arbox..." : "סנכרון עם Arbox"}
    </Button>
  );
}
