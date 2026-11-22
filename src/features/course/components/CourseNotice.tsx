interface CourseNoticeProps {
  message: string;
}

/** Shown in place of course content: not published, empty, not for this viewer, or an admin empty state. */
export function CourseNotice({ message }: CourseNoticeProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
