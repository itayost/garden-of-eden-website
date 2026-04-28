import { getOwnNextGame } from "@/features/next-game/lib/actions/next-game";
import { NextGameForm } from "./NextGameForm";

export default async function NextGameFormPage() {
  const existing = await getOwnNextGame();
  return (
    <NextGameForm
      initialValues={
        existing
          ? { game_date: existing.game_date, opponent: existing.opponent }
          : { game_date: "", opponent: "" }
      }
    />
  );
}
