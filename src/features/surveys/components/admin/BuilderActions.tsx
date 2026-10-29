import type { ReactNode } from "react";
import { Eye, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BuilderPending } from "./useBuilderActions";

interface BuilderActionsProps {
  /** "header" is the labelled row from lg; "bar" is the row pinned to a phone's bottom edge. */
  variant: "header" | "bar";
  /** A published Survey keeps its state on save, so it offers "return to draft" instead of "publish". */
  published: boolean;
  pending: BuilderPending | null;
  canPreview: boolean;
  onPreview: () => void;
  onSave: () => void;
  onPublish: () => void;
  onBackToDraft: () => void;
}

interface ActionButtonProps {
  primary?: boolean;
  grow: boolean;
  disabled: boolean;
  spinning: boolean;
  icon?: ReactNode;
  onClick: () => void;
  children: string;
}

function ActionButton({ primary = false, grow, disabled, spinning, icon, onClick, children }: ActionButtonProps) {
  return (
    <Button
      type="button"
      variant={primary ? "default" : "outline"}
      className={grow ? "flex-1" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {spinning ? <Loader2 aria-hidden="true" className="animate-spin" /> : icon}
      {children}
    </Button>
  );
}

/** Preview, save, and publish (or return to draft). Both rows are this one set of buttons. */
export function BuilderActions({
  variant,
  published,
  pending,
  canPreview,
  onPreview,
  onSave,
  onPublish,
  onBackToDraft,
}: BuilderActionsProps) {
  const bar = variant === "bar";
  const busy = pending !== null;
  const saveLabel = published || bar ? "שמירה" : "שמירה כטיוטה";
  const common = { grow: bar, disabled: busy };

  return (
    <>
      <Button
        type="button"
        variant={bar ? "ghost" : "outline"}
        size={bar ? "icon" : "default"}
        disabled={!canPreview}
        aria-label="תצוגה מקדימה"
        onClick={onPreview}
      >
        <Eye aria-hidden="true" />
        {!bar && "תצוגה מקדימה"}
      </Button>
      {published ? (
        <>
          <ActionButton {...common} spinning={pending === "unpublish"} onClick={onBackToDraft}>
            החזרה לטיוטה
          </ActionButton>
          <ActionButton {...common} primary spinning={pending === "save"} onClick={onSave}>
            {saveLabel}
          </ActionButton>
        </>
      ) : (
        <>
          <ActionButton {...common} spinning={pending === "save"} onClick={onSave}>
            {saveLabel}
          </ActionButton>
          <ActionButton
            {...common}
            primary
            spinning={pending === "publish"}
            icon={<Send aria-hidden="true" />}
            onClick={onPublish}
          >
            פרסום
          </ActionButton>
        </>
      )}
    </>
  );
}
