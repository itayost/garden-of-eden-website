"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { branchNameFor, useCurrentBranch } from "./BranchContext";

/**
 * Switches the page's branch through ?branch=. A single-branch trainer sees
 * a label, not a control: there is nothing for them to switch to.
 */
export function BranchSwitcher() {
  const { branchId, branches, canSwitch } = useCurrentBranch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!canSwitch) {
    return (
      <Badge variant="secondary" className="gap-1">
        <MapPin className="h-3 w-3" />
        {branchNameFor(branches, branchId)}
      </Badge>
    );
  }

  const handleChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("branch", next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <Select value={branchId} onValueChange={handleChange}>
        <SelectTrigger className="w-40" aria-label="סניף">
          <SelectValue placeholder="סניף" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.nameHe}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
