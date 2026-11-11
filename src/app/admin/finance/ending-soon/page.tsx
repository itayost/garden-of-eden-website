import { redirect } from "next/navigation";

/** Ending soon is a tab of שימור לקוחות now; old links and bookmarks land there. */
export default function EndingSoonPage() {
  redirect("/admin/retention?tab=ending");
}
