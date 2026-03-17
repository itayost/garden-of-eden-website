"use client";

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
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

function getYearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear();
  return [current + 1, current, current - 1, current - 2].map((y) => ({
    value: String(y),
    label: String(y),
  }));
}

export function MonthPicker() {
  const [month, setMonth] = useQueryState("month", parseAsInteger);
  const [year, setYear] = useQueryState("year", parseAsInteger);
  const [, setAstatus] = useQueryState("astatus", parseAsString);

  const yearOptions = getYearOptions();
  const isActive = month !== null;

  const handleMonthChange = (value: string) => {
    const newMonth = parseInt(value, 10);
    const effectiveYear = year ?? new Date().getFullYear();
    void setMonth(newMonth);
    void setYear(effectiveYear);
  };

  const handleYearChange = (value: string) => {
    void setYear(parseInt(value, 10));
  };

  const handleClear = () => {
    void setMonth(null);
    void setYear(null);
    void setAstatus(null);
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-2 ${
        isActive ? "border-primary bg-primary/5" : "border-dashed"
      }`}
    >
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        סינון לפי חודש:
      </span>

      <Select
        value={month !== null ? String(month) : undefined}
        onValueChange={handleMonthChange}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="בחר חודש" />
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
        value={year !== null ? String(year) : undefined}
        onValueChange={handleYearChange}
        disabled={month === null}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="שנה" />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
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
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">נקה סינון</span>
        </Button>
      )}
    </div>
  );
}
