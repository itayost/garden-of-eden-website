"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getLeadColumns } from "./LeadTableColumns";
import { LeadTableToolbar } from "./LeadTableToolbar";
import { LeadStatsPanel } from "./LeadStatsPanel";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { LeadTabBadge } from "./LeadTabBadge";
import { LeadDetailSheet } from "./LeadDetailSheet";
import { LeadCreateDialog } from "./LeadCreateDialog";
import { TablePagination } from "@/components/admin/TablePagination";
import { LEAD_UNASSIGNED_VALUE, type Lead, type LeadStatus } from "@/types/leads";
import type { LeadTab } from "@/types/lead-tabs";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";

interface LeadDataTableProps {
  data: Lead[];
  activeTab: LeadTab;
  tabs: LeadTab[];
  trainers: TrainerOption[];
  initialSearch?: string;
  initialStatus?: string | null;
  initialHaifa?: boolean;
  initialAssignedTrainerId?: string | null;
}

function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  if (phone.startsWith("972")) {
    const local = "0" + phone.slice(3);
    return local.slice(0, 3) + "-" + local.slice(3);
  }
  return phone;
}

export function LeadDataTable({
  data,
  activeTab,
  tabs,
  trainers,
  initialSearch = "",
  initialStatus = null,
  initialHaifa = false,
  initialAssignedTrainerId = null,
}: LeadDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string | null>(initialStatus);
  const [haifaFilter, setHaifaFilter] = useState(initialHaifa);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [flowFilter, setFlowFilter] = useState<string | null>(null);
  const [assignedTrainerFilter, setAssignedTrainerFilter] = useState<string | null>(
    initialAssignedTrainerId
  );
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const columns = useMemo(
    () => getLeadColumns({ showPaidIndicator: activeTab.slug === "paid" }),
    [activeTab.slug]
  );

  const filteredData = useMemo(() => {
    return data.filter((lead) => {
      if (globalFilter) {
        const s = globalFilter.toLowerCase();
        if (
          !lead.name.toLowerCase().includes(s) &&
          !(lead.phone ?? "").includes(globalFilter)
        )
          return false;
      }
      if (statusFilter && lead.status !== statusFilter) return false;
      if (haifaFilter && !lead.is_from_haifa) return false;
      if (teamFilter && lead.flow_team !== teamFilter) return false;
      if (flowFilter) {
        if (flowFilter === "complete" && lead.flow_age_group === null)
          return false;
        if (flowFilter === "pending" && lead.flow_age_group !== null)
          return false;
      }
      if (assignedTrainerFilter) {
        if (assignedTrainerFilter === LEAD_UNASSIGNED_VALUE) {
          if (lead.assigned_trainer_id) return false;
        } else if (lead.assigned_trainer_id !== assignedTrainerFilter) {
          return false;
        }
      }
      return true;
    });
  }, [data, globalFilter, statusFilter, haifaFilter, teamFilter, flowFilter, assignedTrainerFilter]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const handleRowClick = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setSheetOpen(true);
  }, []);

  const handleSearchChange = useCallback((v: string) => setGlobalFilter(v), []);
  const handleStatusChange = useCallback(
    (v: string | null) => setStatusFilter(v),
    []
  );
  const handleHaifaChange = useCallback((v: boolean) => setHaifaFilter(v), []);
  const handleTeamChange = useCallback(
    (v: string | null) => setTeamFilter(v),
    []
  );
  const handleFlowChange = useCallback(
    (v: string | null) => setFlowFilter(v),
    []
  );
  const handleAssignedTrainerChange = useCallback(
    (v: string | null) => setAssignedTrainerFilter(v),
    []
  );
  const handleCreateClick = useCallback(() => setCreateOpen(true), []);

  const handleStatStatusFilter = useCallback(
    (status: LeadStatus | null) => {
      setStatusFilter(status);
    },
    []
  );

  return (
    <div className="space-y-4">
      <LeadStatsPanel
        leads={data}
        onStatusFilter={handleStatStatusFilter}
        activeStatus={statusFilter}
      />

      <LeadTableToolbar
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
        onHaifaChange={handleHaifaChange}
        onTeamChange={handleTeamChange}
        onFlowChange={handleFlowChange}
        onAssignedTrainerChange={handleAssignedTrainerChange}
        onCreateClick={handleCreateClick}
        statusValue={statusFilter}
        trainers={trainers}
      />

      {/* Mobile: Card list */}
      <div className="space-y-2 sm:hidden">
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => {
            const lead = row.original;
            return (
              <div
                key={row.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(lead)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {lead.name}
                    </span>
                    <LeadStatusBadge status={lead.status} />
                    <LeadTabBadge tab={lead.tab ?? null} className="shrink-0" />
                    {lead.flow_age_group !== null ? (
                      <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-gray-300 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {formatPhone(lead.phone)}
                    </p>
                    {lead.total_payment && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {lead.total_payment.toLocaleString()}₪
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString("he-IL")}
                </span>
              </div>
            );
          })
        ) : (
          <div className="h-24 flex items-center justify-center text-muted-foreground">
            לא נמצאו לידים
          </div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  לא נמצאו לידים
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination table={table} showPageSize />

      {/* Detail Sheet */}
      <LeadDetailSheet
        lead={selectedLead}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        trainers={trainers}
        tabs={tabs}
      />

      {/* Create Dialog */}
      <LeadCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultTabId={activeTab.id}
        tabs={tabs}
        trainers={trainers}
      />
    </div>
  );
}
