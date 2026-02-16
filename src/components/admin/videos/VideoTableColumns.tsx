"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getYouTubeId, getYouTubeThumbnail } from "@/lib/utils/youtube";
import type { WorkoutVideo } from "@/types/database";

/**
 * Column definitions for the video data table
 * Follows the same pattern as UserTableColumns.tsx
 */
export const columns: ColumnDef<WorkoutVideo>[] = [
  {
    id: "thumbnail",
    header: "",
    cell: ({ row }) => {
      const videoId = getYouTubeId(row.original.youtube_url);
      if (!videoId) {
        return (
          <div className="w-24 h-14 bg-muted rounded flex items-center justify-center">
            <span className="text-xs text-muted-foreground">אין תמונה</span>
          </div>
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getYouTubeThumbnail(videoId, "mqdefault")}
          alt={row.original.title}
          className="w-24 h-14 object-cover rounded"
        />
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        כותרת
        <ArrowUpDown className="mr-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("title")}</span>
    ),
  },
  {
    accessorKey: "day_number",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        יום
        <ArrowUpDown className="mr-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Badge variant="outline">יום {row.getValue("day_number")}</Badge>
    ),
  },
  {
    accessorKey: "day_topic",
    header: "נושא",
    cell: ({ row }) => (
      <span className="truncate max-w-[150px] block">
        {row.getValue("day_topic")}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "duration_minutes",
    header: "משך",
    cell: ({ row }) => (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Clock className="h-4 w-4" />
        {row.getValue("duration_minutes")} דקות
      </span>
    ),
    enableSorting: false,
  },
  {
    id: "actions",
    header: "",
    cell: () => null, // Actions will be rendered by parent via renderActions prop
    enableSorting: false,
  },
];
