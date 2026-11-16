"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_METRIC_PARAMETERS } from "@/lib/validations/book-metric-map";
import { saveMetricParametersAction } from "../../lib/actions/admin-book-metrics";
import { byBookOrder, parameterWarnings, type MapParameter, type MetricMapRow } from "../../lib/metric-map";

interface CategoryGroup {
  name: string;
  parameters: MapParameter[];
}

/** The parameters by category, each category where its first parameter falls in the book. */
function groupByCategory(parameters: readonly MapParameter[]): CategoryGroup[] {
  const names = [...new Set(parameters.map((parameter) => parameter.categoryName))];
  return names.map((name) => ({
    name: name || "ללא קטגוריה",
    parameters: parameters.filter((parameter) => parameter.categoryName === name),
  }));
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  const set = new Set(a);
  return a.length === b.length && b.every((id) => set.has(id));
}

function drillCountText(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? "תרגיל אחד" : `${count} תרגילים`;
}

interface ParameterChipProps {
  parameter: MapParameter;
  disabled: boolean;
  onRemove: () => void;
}

function ParameterChip({ parameter, disabled, onRemove }: ParameterChipProps) {
  const details = [parameter.categoryName, drillCountText(parameter.drillCount)].filter(Boolean).join(" · ");
  return (
    <li className="flex min-w-0 max-w-full items-start gap-1 rounded-lg border bg-muted/40 py-1.5 ps-3 pe-1">
      <div className="min-w-0 flex-1 py-1">
        <p className="break-words text-sm font-medium">{parameter.nameHe}</p>
        {details && <p className="text-xs text-muted-foreground">{details}</p>}
        {parameterWarnings(parameter).map((warning) => (
          <p key={warning} className="text-xs text-warning-emphasis">
            {warning}
          </p>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`הסרת ${parameter.nameHe}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </li>
  );
}

interface MetricCardProps {
  row: MetricMapRow;
  byId: ReadonlyMap<string, MapParameter>;
  groups: readonly CategoryGroup[];
}

/** One Goal metric: its parameters, the list to add one, and its own save. */
function MetricCard({ row, byId, groups }: MetricCardProps) {
  const router = useRouter();
  const saved = useMemo(() => row.parameters.map((parameter) => parameter.id), [row.parameters]);
  const [ids, setIds] = useState<string[]>(saved);
  const [pending, startTransition] = useTransition();

  const chosen = ids
    .flatMap((id) => {
      const parameter = byId.get(id);
      return parameter ? [parameter] : [];
    })
    .sort(byBookOrder);
  const available = groups
    .map((group) => ({ ...group, parameters: group.parameters.filter((parameter) => !ids.includes(parameter.id)) }))
    .filter((group) => group.parameters.length > 0);
  const changed = !sameIds(ids, saved);
  const full = ids.length >= MAX_METRIC_PARAMETERS;

  const add = (id: string) => setIds((current) => (current.includes(id) ? current : [...current, id]));
  const remove = (id: string) => setIds((current) => current.filter((existing) => existing !== id));

  const save = () => {
    startTransition(async () => {
      const result = await saveMetricParametersAction({ metricKey: row.metricKey, parameterIds: ids });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`המיפוי של ${row.label} נשמר`);
      router.refresh();
    });
  };

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-snug">
          <span>{row.label}</span>
          <span className="text-xs font-normal text-muted-foreground">{row.unit}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 sm:px-6">
        {chosen.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין פרמטרים. בלי פרמטר אין תרגילים למדד הזה.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {chosen.map((parameter) => (
              <ParameterChip
                key={parameter.id}
                parameter={parameter}
                disabled={pending}
                onRemove={() => remove(parameter.id)}
              />
            ))}
          </ul>
        )}

        <Select value="" onValueChange={add} disabled={pending || full || available.length === 0}>
          <SelectTrigger className="w-full sm:w-80" aria-label={`הוספת פרמטר ל${row.label}`}>
            <SelectValue placeholder="הוספת פרמטר" />
          </SelectTrigger>
          <SelectContent>
            {available.map((group) => (
              <SelectGroup key={group.name}>
                <SelectLabel>{group.name}</SelectLabel>
                {group.parameters.map((parameter) => (
                  <SelectItem key={parameter.id} value={parameter.id}>
                    {parameter.nameHe}
                    {parameter.drillCount === 0 ? " (אין תרגילים)" : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {full && <p className="text-xs text-muted-foreground">אפשר לבחור עד {MAX_METRIC_PARAMETERS} פרמטרים למדד</p>}

        {changed && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button type="button" onClick={save} disabled={pending} className="min-h-10">
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              שמירה
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIds(saved)}
              disabled={pending}
              className="min-h-10"
            >
              ביטול
            </Button>
            <span className="text-xs text-muted-foreground">יש שינויים שלא נשמרו</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MetricMapClientProps {
  rows: readonly MetricMapRow[];
  parameters: readonly MapParameter[];
}

/**
 * The metric-to-book map editor: one card per Goal metric, each saved on its
 * own. A card remounts when its saved list changes, so the page's refresh
 * after a save never leaves a stale draft.
 */
export function MetricMapClient({ rows, parameters }: MetricMapClientProps) {
  const byId = useMemo(() => new Map(parameters.map((parameter) => [parameter.id, parameter])), [parameters]);
  const groups = useMemo(() => groupByCategory(parameters), [parameters]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {rows.map((row) => (
        <MetricCard
          key={`${row.metricKey}:${row.parameters.map((parameter) => parameter.id).join(",")}`}
          row={row}
          byId={byId}
          groups={groups}
        />
      ))}
    </div>
  );
}
