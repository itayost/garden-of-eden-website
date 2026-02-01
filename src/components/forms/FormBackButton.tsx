"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface FormBackButtonProps {
  href?: string;
  label?: string;
}

/**
 * Back navigation button for forms
 * Defaults to returning to /dashboard/forms
 */
export function FormBackButton({
  href = "/dashboard/forms",
  label = "חזרה לשאלונים",
}: FormBackButtonProps) {
  return (
    <div className="mb-6">
      <Link
        href={href}
        className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
      >
        <ArrowRight className="h-4 w-4" />
        {label}
      </Link>
    </div>
  );
}
