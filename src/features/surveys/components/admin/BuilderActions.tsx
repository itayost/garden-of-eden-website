import type { ReactNode } from "react";
import { Eye, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BuilderActionsApi } from "./useBuilderActions";

interface BuilderActionsProps {
  /** "header" is the labelled row from lg; "bar" is the row pinned to a phone's bottom edge. */
  variant: "header" | "bar";
  /** A published Survey keeps its state on save, so it offers "return to draft" instead of "publish". */
  published: boolean;
  canPreview: boolean;
  onPreview: () => void;
  actions: Pick<BuilderActionsApi, "pending" | "save" | "publish" | "backToDraft">;
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

function PreviewButton({ bar, disabled, onClick }: { bar: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant={bar ? "ghost" : "outline"}
      size={bar ? "icon" : "default"}
      disabled={disabled}
      aria-label="תצוגה מקדימה"
      onClick={onClick}
    >
      <Eye aria-hidden="true" />
      {!bar && "תצוגה מקדימה"}
    </Button>
  );
}

/** Preview, save, and publish (or return to draft). Both rows are this one set of buttons. */
export function BuilderActions({ variant, published, canPreview, onPreview, actions }: BuilderActionsProps) {
  const bar = variant === "bar";
  const { pending } = actions;
  const common = { grow: bar, disabled: pending !== null };
  const saveLabel = published || bar ? "שמירה" : "שמירה כטיוטה";
  const save = (primary: boolean) => (
    <ActionButton {...common} primary={primary} spinning={pending === "save"} onClick={actions.save}>
      {saveLabel}
    </ActionButton>
  );

  return (
    <>
      <PreviewButton bar={bar} disabled={!canPreview} onClick={onPreview} />
      {published ? (
        <>
          <ActionButton {...common} spinning={pending === "unpublish"} onClick={actions.backToDraft}>
            החזרה לטיוטה
          </ActionButton>
          {save(true)}
        </>
      ) : (
        <>
          {save(false)}
          <ActionButton
            {...common}
            primary
            spinning={pending === "publish"}
            icon={<Send aria-hidden="true" />}
            onClick={actions.publish}
          >
            פרסום
          </ActionButton>
        </>
      )}
    </>
  );
}
