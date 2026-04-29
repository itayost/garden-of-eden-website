import { getOwnNextGame } from "@/features/next-game/lib/actions/next-game";
import { NextGameForm } from "./NextGameForm";

export default async function NextGameFormPage() {
  const existing = await getOwnNextGame();
  return (
    <>
      <h1 className="sr-only">המשחק הבא שלי</h1>
      <NextGameForm
        initialValues={
          existing
            ? { game_date: existing.game_date, opponent: existing.opponent }
            : { game_date: "", opponent: "" }
        }
      />
    </>
  );
}
