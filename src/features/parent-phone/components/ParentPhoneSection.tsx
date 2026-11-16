import { loadParentPrompt } from "../lib/queries";
import { ParentPhoneCard } from "./ParentPhoneCard";

/**
 * The dashboard's parent phone card, read on its own inside a Suspense of the
 * page so it never holds the rest of the dashboard back.
 */
export async function ParentPhoneSection({ userId }: { userId: string }) {
  const prompt = await loadParentPrompt(userId);
  if (!prompt.ask) return null;
  return <ParentPhoneCard birthdateKnown={prompt.birthdateKnown} />;
}
