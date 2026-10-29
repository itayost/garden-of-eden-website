"use client";

import { parseAsInteger, useQueryState } from "nuqs";

import { SimpleTablePagination } from "@/components/admin/TablePagination";
import { lastPage } from "../../lib/results-view";
import { SURVEY_PAGE_SIZE } from "../../lib/types";

interface ResultsPagerProps {
  total: number;
  /** The 1-based page being shown, already held inside the last page by the server. */
  page: number;
}

/** The shared pager over a results list, kept in `?page=`; page 1 leaves the address bare. */
export function ResultsPager({ total, page }: ResultsPagerProps) {
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions({ shallow: false, scroll: true }),
  );
  if (lastPage(total) <= 1) return null;

  return (
    <div className="border-t">
      <SimpleTablePagination
        totalItems={total}
        pageSize={SURVEY_PAGE_SIZE}
        currentPage={page - 1}
        onPageChange={(index) => void setPage(index === 0 ? null : index + 1)}
        rangeSeparator=" עד "
      />
    </div>
  );
}
