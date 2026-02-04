"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X } from "lucide-react";

export interface TraineeOption {
  id: string;
  full_name: string | null;
}

interface TraineeMultiSelectProps {
  trainees: TraineeOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function TraineeMultiSelect({
  trainees,
  selected,
  onChange,
}: TraineeMultiSelectProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return trainees;
    const lower = search.toLowerCase();
    return trainees.filter((t) =>
      t.full_name?.toLowerCase().includes(lower)
    );
  }, [trainees, search]);

  const selectedTrainees = useMemo(
    () => trainees.filter((t) => selected.includes(t.id)),
    [trainees, selected]
  );

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const remove = (id: string) => {
    onChange(selected.filter((s) => s !== id));
  };

  return (
    <div className="space-y-2">
      {/* Selected badges */}
      {selectedTrainees.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTrainees.map((t) => (
            <Badge
              key={t.id}
              variant="secondary"
              className="gap-1 cursor-pointer"
              onClick={() => remove(t.id)}
            >
              {t.full_name || "ללא שם"}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש מתאמנים..."
          className="pr-9"
        />
      </div>

      {/* Checkbox list */}
      <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            לא נמצאו מתאמנים
          </p>
        ) : (
          filtered.map((trainee) => (
            <label
              key={trainee.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
            >
              <Checkbox
                checked={selected.includes(trainee.id)}
                onCheckedChange={() => toggle(trainee.id)}
              />
              {trainee.full_name || "ללא שם"}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
