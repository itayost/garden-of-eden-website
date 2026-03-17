"use client";

import { parseAsInteger, parseAsString, useQueryState, useQueryStates } from "nuqs";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  { value: "1", label: "ינואר" },
  { value: "2", label: "פברואר" },
  { value: "3", label: "מרץ" },
  { value: "4", label: "אפריל" },
  { value: "5", label: "מאי" },
  { value: "6", label: "יוני" },
  { value: "7", label: "יולי" },
  { value: "8", label: "אוגוסט" },
  { value: "9", label: "ספטמבר" },
  { value: "10", label: "אוקטובר" },
  { value: "11", label: "נובמבר" },
  { value: "12", label: "דצמבר" },
];

const YEAR_OPTIONS: { value: string; label: string }[] = (() => {
  const current = new Date().getFullYear();
  return [current + 1, current, current - 1, current - 2].map((y) => ({
    value: String(y),
    label: String(y),
  }));
})();

export function MonthPicker() {
  const [{ month, year }, setMonthYear] = useQueryStates({
    month: parseAsInteger,
    year: parseAsInteger,
  });
  const [, setAstatus] = useQueryState("astatus", parseAsString);

  const isActive = month !== null || year !== null;

  const handleMonthChange = (value: string) => {
    const newMonth = parseInt(value, 10);
    void setMonthYear({ month: newMonth, year: year ?? new Date().getFullYear() });
  };

  const handleYearChange = (value: string) => {
    void setMonthYear({ year: parseInt(value, 10) });
  };

  const handleClear = () => {
    void setMonthYear({ month: null, year: null });
    void setAstatus(null);
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={month !== null ? String(month) : ""}
        onValueChange={handleMonthChange}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="חודש" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={year !== null ? String(year) : ""}
        onValueChange={handleYearChange}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="שנה" />
        </SelectTrigger>
        <SelectContent>
          {YEAR_OPTIONS.map((y) => (
            <SelectItem key={y.value} value={y.value}>
              {y.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-9 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">נקה</span>
        </Button>
      )}
    </div>
  );
}
