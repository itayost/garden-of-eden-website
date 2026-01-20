"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";

interface ClickableTableRowProps {
  href: string;
  children: React.ReactNode;
}

export function ClickableTableRow({ href, children }: ClickableTableRowProps) {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer"
      tabIndex={0}
      role="link"
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </TableRow>
  );
}
