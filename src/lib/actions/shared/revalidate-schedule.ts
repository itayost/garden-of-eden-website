import { revalidatePath } from "next/cache";

/**
 * Invalidates every surface that renders slots.
 *
 * Three pages: the booking calendar, the session-building list, and the weekly
 * page, whose bands and exceptions share these writes.
 * They used to be listed separately in three files, which is how the build
 * action came to revalidate one of them and not the other.
 *
 * Not a "use server" module — every export in one of those must be async, and
 * this is a plain synchronous helper. Import it directly rather than through
 * shared/index.ts.
 *
 * Both pages read cookies and are therefore dynamic, so this is about the
 * client Router Cache and about saying which surfaces exist. What refreshes the
 * screen for whoever pressed the button is the router.refresh() each dialog
 * already calls.
 */
export function revalidateScheduleSurfaces(): void {
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/weekly-schedule");
}
