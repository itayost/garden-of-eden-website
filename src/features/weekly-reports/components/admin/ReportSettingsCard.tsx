"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveReportSettingsAction } from "../../lib/actions/settings";
import type { BranchReportSetting, CardMode } from "../../lib/actions/settings-load";

const MODES: readonly CardMode[] = ["off", "approval"];
const MODE_LABELS: Record<CardMode, string> = { off: "כבוי", approval: "באישור צוות" };

const CHANGED_AT = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const YEAR_MIN = 1950;
const YEAR_MAX = 2030;

function sameYears(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((year, index) => year === b[index]);
}

/** Birth years as chips, with an input to add one. Empty means every year. */
function BirthYears({ id, years, onChange }: { id: string; years: number[]; onChange: (years: number[]) => void }) {
  const [draft, setDraft] = useState("");
  const value = Number(draft);
  const valid = /^\d{4}$/.test(draft) && value >= YEAR_MIN && value <= YEAR_MAX && !years.includes(value);

  function add() {
    if (!valid) return;
    onChange([...years, value].sort((a, b) => a - b));
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>שנות לידה</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {years.length === 0 && <span className="text-sm text-muted-foreground">כל שנות הלידה</span>}
        {years.map((year) => (
          <span key={year} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pe-1 ps-2.5 text-sm tabular-nums">
            {year}
            <button
              type="button"
              onClick={() => onChange(years.filter((y) => y !== year))}
              className="rounded-full p-0.5 hover:bg-background"
              aria-label={`הסרת ${year}`}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="numeric"
          dir="ltr"
          value={draft}
          maxLength={4}
          placeholder="2014"
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          className="w-28"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!valid}>
          <Plus aria-hidden="true" />
          הוספה
        </Button>
      </div>
    </div>
  );
}

/** One branch: its mode, pilot birth years and "התגעגענו", saved on their own. */
function BranchSettingRow({ setting }: { setting: BranchReportSetting }) {
  const router = useRouter();
  const [mode, setMode] = useState<CardMode>(setting.mode);
  const [years, setYears] = useState<number[]>(setting.birthYears);
  const [missedYou, setMissedYou] = useState(setting.missedYou);
  const [saving, setSaving] = useState(false);
  const dirty = mode !== setting.mode || !sameYears(years, setting.birthYears) || missedYou !== setting.missedYou;
  const prefix = `settings-${setting.branchId}`;

  async function save() {
    setSaving(true);
    try {
      const result = await saveReportSettingsAction({ branchId: setting.branchId, mode, birthYears: years, missedYou });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`ההגדרות של ${setting.branchName} נשמרו`);
      router.refresh();
    } catch {
      toast.error("השמירה נכשלה, נסו שוב");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="space-y-4 py-4 first:pt-0 last:pb-0">
      <h3 className="font-bold">{setting.branchName}</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-mode`}>מצב</Label>
          <Select value={mode} onValueChange={(value) => setMode(value === "approval" ? "approval" : "off")}>
            <SelectTrigger id={`${prefix}-mode`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((key) => (
                <SelectItem key={key} value={key}>
                  {MODE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <BirthYears id={`${prefix}-years`} years={years} onChange={setYears} />
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`${prefix}-missed`}>שליחת התגעגענו</Label>
            <Switch id={`${prefix}-missed`} checked={missedYou} onCheckedChange={setMissedYou} />
          </div>
          <p className="text-xs text-muted-foreground">בחיפה רק אחרי שהפיילוט מראה שהנוכחות מארבוקס תואמת</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {setting.changedAt
            ? `עודכן ${CHANGED_AT.format(new Date(setting.changedAt))}${setting.changedByName ? ` על ידי ${setting.changedByName}` : ""}`
            : "עוד לא הוגדר (כבוי)"}
        </p>
        <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          שמירה
        </Button>
      </div>
    </li>
  );
}

/** Admins only: the weekly report setting of each active branch, folded under the queue. */
export function ReportSettingsCard({ settings }: { settings: readonly BranchReportSetting[] }) {
  return (
    <details className="group rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
        <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
        הגדרות
        <ChevronDown className="ms-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t px-4 py-4">
        {settings.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין סניפים פעילים</p>
        ) : (
          <ul className="divide-y">
            {settings.map((setting) => (
              <BranchSettingRow key={`${setting.branchId}:${setting.changedAt ?? ""}`} setting={setting} />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
