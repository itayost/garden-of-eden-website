"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryState, parseAsString } from "nuqs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableToolbar, ToolbarSelect } from "@/components/admin/TableToolbar";
import { TrainerAssignmentSelect } from "@/components/admin/leads/TrainerAssignmentSelect";
import { RetentionCallCell } from "@/features/call-reminders/components/RetentionCallCell";
import { endingCounts, filterEnding, ENDING_FILTERS, type EndingFilter } from "@/features/finance/lib/ending-soon";
import type { EndingRetention, EndingRetentionRow } from "@/lib/retention/ending-soon-load";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { NOTE_COLOR_BG, type NoteColor } from "@/lib/validations/churned-customers";
import { normalizePhoneIL } from "@/lib/validations/common";
import { buildChurnedKey } from "@/lib/utils/churned-key";
import { formatRelativeTime } from "@/lib/utils/date";
import { shortDate } from "@/lib/utils/iso-date";
import { matchesPositionFilter, positionFilterOptions, POSITION_FILTER_ALL } from "@/lib/admin/position-filter";
import { RetentionNoteCell } from "./RetentionNoteCell";
import { MoveToChurnedButton } from "./MoveToChurnedButton";
import {
  ContactCell,
  ENDING_FILTER_LABELS,
  ENDING_RULE_TEXT,
  FlagsCell,
  LeftCell,
  type EndingTabRow,
} from "./EndingSoonCells";

const COLUMNS = 10;

interface EndingSoonTabProps {
  readonly data: EndingRetention | null;
  readonly error: string | null;
  readonly trainers: TrainerOption[];
  readonly traineePositions: Readonly<Record<string, string | null>>;
  readonly movedKeys: ReadonlySet<string>;
  readonly onSaveNote: (row: EndingRetentionRow, note: string, noteColor: NoteColor) => Promise<void>;
  readonly onAssignTrainer: (row: EndingRetentionRow, trainerId: string | null) => Promise<void>;
  readonly onMoveToChurned: (
    row: EndingRetentionRow,
    note: string,
    noteColor: NoteColor,
    assignedTrainerId: string | null,
  ) => Promise<void>;
}

export function EndingSoonTab({ data, error, ...rowProps }: EndingSoonTabProps) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [position, setPosition] = useQueryState("position", parseAsString.withDefault(POSITION_FILTER_ALL));
  const [filter, setFilter] = useState<EndingFilter>("all");

  const counts = useMemo(() => (data ? endingCounts(data) : null), [data]);

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (row: EndingTabRow) => {
      if (needle && !row.traineeName.toLowerCase().includes(needle)) return false;
      const phone = normalizePhoneIL(row.ownPhone);
      return matchesPositionFilter(phone ? (rowProps.traineePositions[phone] ?? null) : null, position);
    };
  }, [search, position, rowProps.traineePositions]);

  if (error || !data || !counts) {
    return (
      <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-destructive">
        {error ?? "לא הצלחנו לטעון את המסתיימים בקרוב"}
      </div>
    );
  }

  const rows = filterEnding(data, filter).filter(matches);
  const expiredBelow = filter === "all" ? data.expired.filter(matches) : [];
  const filterOptions = ENDING_FILTERS.map((value) => ({
    value,
    label: `${ENDING_FILTER_LABELS[value]} (${counts[value]})`,
  }));

  return (
    <div className="space-y-4">
      <TableToolbar
        searchValue={search}
        onSearchChange={(value) => setSearch(value || null)}
        searchPlaceholder="חיפוש לפי שם..."
        filters={
          <>
            <ToolbarSelect
              value={filter}
              onValueChange={(value) => setFilter(ENDING_FILTERS.find((f) => f === value) ?? "all")}
              options={filterOptions}
              placeholder="סינון"
            />
            <ToolbarSelect
              value={position || POSITION_FILTER_ALL}
              onValueChange={(value) => setPosition(value === POSITION_FILTER_ALL ? null : value)}
              options={positionFilterOptions}
              placeholder="עמדה"
            />
          </>
        }
      />
      <p className="text-xs text-muted-foreground">{ENDING_RULE_TEXT}</p>

      {rows.length === 0 && expiredBelow.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">אין כרגע אף חניך ברשימה הזאת</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">שם לקוח</TableHead>
                <TableHead className="text-start">שיחה</TableHead>
                <TableHead className="text-start">איש קשר</TableHead>
                <TableHead className="text-start">תאריך סיום</TableHead>
                <TableHead className="text-start">נותר</TableHead>
                <TableHead className="text-start">סימונים</TableHead>
                <TableHead className="text-start">הערות</TableHead>
                <TableHead className="text-start">מאמן משוייך</TableHead>
                <TableHead className="text-start">תאריך עדכון אחרון</TableHead>
                <TableHead className="text-start">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <EndingSoonRow key={row.profileId} row={row} {...rowProps} />
              ))}
              {expiredBelow.length > 0 && (
                <Fragment>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={COLUMNS} className="py-2 text-sm font-semibold">
                      {ENDING_FILTER_LABELS.expired} ({expiredBelow.length})
                    </TableCell>
                  </TableRow>
                  {expiredBelow.map((row) => (
                    <EndingSoonRow key={row.profileId} row={row} {...rowProps} />
                  ))}
                </Fragment>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

type RowProps = Omit<EndingSoonTabProps, "data" | "error"> & { readonly row: EndingTabRow };

function EndingSoonRow({ row, trainers, movedKeys, onSaveNote, onAssignTrainer, onMoveToChurned }: RowProps) {
  const note = row.note?.note ?? "";
  const color: NoteColor = row.note?.note_color ?? "none";
  const trainerId = row.note?.assigned_trainer_id ?? null;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link href={`/admin/users/${row.profileId}`} className="hover:underline">
          {row.traineeName}
        </Link>
        <div className="text-xs font-normal text-muted-foreground">{row.planName}</div>
      </TableCell>
      <TableCell>
        <RetentionCallCell reportMonth={row.noteKey.reportMonth} phone={row.noteKey.phone} traineeName={row.traineeName} />
      </TableCell>
      <TableCell>
        <ContactCell row={row} />
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">{shortDate(row.endsOn)}</TableCell>
      <TableCell>
        <LeftCell row={row} />
      </TableCell>
      <TableCell>
        <FlagsCell row={row} />
      </TableCell>
      <TableCell className={NOTE_COLOR_BG[color]}>
        <RetentionNoteCell note={note} noteColor={color} onSave={(text, noteColor) => onSaveNote(row, text, noteColor)} />
      </TableCell>
      <TableCell>
        <TrainerAssignmentSelect
          trainers={trainers}
          value={trainerId}
          onChange={(id) => onAssignTrainer(row, id)}
          triggerClassName="w-40"
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {row.note?.updated_at ? formatRelativeTime(row.note.updated_at) : "—"}
      </TableCell>
      <TableCell>
        <MoveToChurnedButton
          traineeName={row.moveAs.name}
          endDate={row.moveAs.endDate}
          alreadyMoved={movedKeys.has(buildChurnedKey(row.moveAs.name, row.moveAs.endDate))}
          onConfirm={() => onMoveToChurned(row, note, color, trainerId)}
        />
      </TableCell>
    </TableRow>
  );
}
