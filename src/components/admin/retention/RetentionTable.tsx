"use client";

import { useMemo } from "react";
import { useQueryState, parseAsString } from "nuqs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TableToolbar,
  ToolbarSelect,
} from "@/components/admin/TableToolbar";
import { RetentionNoteCell } from "./RetentionNoteCell";
import { MoveToChurnedButton } from "./MoveToChurnedButton";
import { TrainerAssignmentSelect } from "@/components/admin/leads/TrainerAssignmentSelect";
import { formatRelativeTime } from "@/lib/utils/date";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import type { RetentionEntry } from "@/lib/arbox/retention";
import type { RetentionViewEntry } from "@/lib/arbox/retention-branches";
import { Badge } from "@/components/ui/badge";
import type { RetentionNote } from "@/lib/actions/admin-retention";
import {
  NOTE_COLOR_BG,
  type NoteColor,
} from "@/lib/validations/churned-customers";
import { buildChurnedKey } from "@/lib/utils/churned-key";
import { HEBREW_MONTHS } from "@/lib/constants/hebrew-months";
import { Clock } from "lucide-react";
import { normalizePhoneIL } from "@/lib/validations/common";
import {
  positionFilterOptions,
  matchesPositionFilter,
  POSITION_FILTER_ALL,
} from "@/lib/admin/position-filter";

function getMonthName(monthKey: string): string {
  const [, monthStr] = monthKey.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  return HEBREW_MONTHS[monthIndex] ?? monthKey;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "\u2014";
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
}

/** Get a stable key for notes lookup: phone or "no-phone:<name>" */
function getNoteKey(entry: RetentionEntry): string {
  return entry.phone ?? `no-phone:${entry.name.trim().toLowerCase()}`;
}

/** A month's count for one branch: 0 is shown, null (not assigned, nothing there) is a dash. */
function formatCount(count: number | null | undefined): string | number {
  return count ?? "\u2014";
}

const BRANCH_COLUMNS = [
  { key: "haifa", label: "חיפה" },
  { key: "kiryat", label: "קריות" },
] as const;

interface RetentionTableProps {
  entries: readonly RetentionViewEntry[];
  monthKeys: readonly string[];
  notes: ReadonlyMap<string, RetentionNote>;
  onSaveNote: (
    traineePhone: string,
    traineeName: string,
    note: string,
    noteColor: NoteColor,
  ) => Promise<void>;
  traineePositions: Readonly<Record<string, string | null>>;
  trainers: TrainerOption[];
  onAssignTrainer: (
    traineePhone: string,
    traineeName: string,
    trainerId: string | null,
  ) => Promise<void>;
  movedKeys?: ReadonlySet<string>;
  onMoveToChurned?: (
    entry: RetentionEntry,
    note: string,
    noteColor: NoteColor,
    assignedTrainerId: string | null,
  ) => Promise<void>;
}

export function RetentionTable({
  entries,
  monthKeys,
  notes,
  onSaveNote,
  traineePositions,
  trainers,
  onAssignTrainer,
  movedKeys,
  onMoveToChurned,
}: RetentionTableProps) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [position, setPosition] = useQueryState(
    "position",
    parseAsString.withDefault(POSITION_FILTER_ALL),
  );

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (search && !e.name.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
        const normalizedPhone = normalizePhoneIL(e.phone);
        const entryPosition =
          normalizedPhone ? (traineePositions[normalizedPhone] ?? null) : null;
        if (!matchesPositionFilter(entryPosition, position)) return false;
        return true;
      }),
    [entries, search, position, traineePositions],
  );

  return (
    <div className="space-y-4">
      <TableToolbar
        searchValue={search}
        onSearchChange={(value) => setSearch(value || null)}
        searchPlaceholder="חיפוש לפי שם..."
        filters={
          <ToolbarSelect
            value={position || POSITION_FILTER_ALL}
            onValueChange={(value) =>
              setPosition(value === POSITION_FILTER_ALL ? null : value)
            }
            options={positionFilterOptions}
            placeholder="עמדה"
          />
        }
      />

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          אין נתונים לחודש זה
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="text-right">שם לקוח</TableHead>
                <TableHead rowSpan={2} className="text-right">תאריך סיום</TableHead>
                {monthKeys.map((mk, i) => (
                  <TableHead key={mk} colSpan={BRANCH_COLUMNS.length} className="text-center border-s">
                    <span className="inline-flex items-center gap-1">
                      {getMonthName(mk)}
                      {i === 0 && (
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </span>
                  </TableHead>
                ))}
                <TableHead rowSpan={2} className="text-right">הערות</TableHead>
                <TableHead rowSpan={2} className="text-right">מאמן משוייך</TableHead>
                <TableHead rowSpan={2} className="text-right">תאריך עדכון אחרון</TableHead>
                {onMoveToChurned && (
                  <TableHead rowSpan={2} className="text-right">פעולות</TableHead>
                )}
              </TableRow>
              <TableRow>
                {monthKeys.flatMap((mk) =>
                  BRANCH_COLUMNS.map((branch, bi) => (
                    <TableHead
                      key={`${mk}-${branch.key}`}
                      className={`h-8 text-center text-xs font-normal ${bi === 0 ? "border-s" : ""}`}
                    >
                      {branch.label}
                    </TableHead>
                  )),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry, i) => {
                const noteKey = getNoteKey(entry);
                const existingNoteRecord = notes.get(noteKey);
                const existingNote = existingNoteRecord?.note ?? "";
                const existingColor: NoteColor =
                  existingNoteRecord?.note_color ?? "none";

                return (
                  <TableRow key={`${entry.user_id ?? entry.name}-${i}`}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {entry.name}
                        {entry.source === "calendar" && (
                          <Badge variant="secondary" className="text-[10px]" title="מסלול בקריית אתא מהיומן, לא מ-Arbox">
                            יומן
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(entry.end_date)}</TableCell>
                    {monthKeys.flatMap((mk, mi) =>
                      BRANCH_COLUMNS.map((branch, bi) => (
                        <TableCell
                          key={`${mk}-${branch.key}`}
                          className={`text-center tabular-nums ${mi === 0 ? "bg-muted/30" : ""} ${bi === 0 ? "border-s" : ""}`}
                        >
                          {formatCount(entry.branch_attendance[branch.key][mi])}
                        </TableCell>
                      )),
                    )}
                    <TableCell className={NOTE_COLOR_BG[existingColor]}>
                      <RetentionNoteCell
                        note={existingNote}
                        noteColor={existingColor}
                        onSave={(note, noteColor) =>
                          onSaveNote(noteKey, entry.name, note, noteColor)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <TrainerAssignmentSelect
                        trainers={trainers}
                        value={existingNoteRecord?.assigned_trainer_id ?? null}
                        onChange={(trainerId) =>
                          onAssignTrainer(noteKey, entry.name, trainerId)
                        }
                        triggerClassName="w-40"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {existingNoteRecord?.updated_at
                        ? formatRelativeTime(existingNoteRecord.updated_at)
                        : "—"}
                    </TableCell>
                    {onMoveToChurned && (
                      <TableCell>
                        <MoveToChurnedButton
                          traineeName={entry.name}
                          endDate={entry.end_date}
                          alreadyMoved={
                            movedKeys?.has(
                              buildChurnedKey(entry.name, entry.end_date),
                            ) ?? false
                          }
                          onConfirm={() =>
                            onMoveToChurned(
                              entry,
                              existingNote,
                              existingColor,
                              existingNoteRecord?.assigned_trainer_id ?? null,
                            )
                          }
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
