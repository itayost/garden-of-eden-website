-- A rating snapshot follows its assessment's soft delete (and restore).
--
-- The trainee card and rating history read the latest snapshot with
-- deleted_at IS NULL, but nothing ever set player_rating_snapshots.deleted_at:
-- a deleted assessment kept driving the card. Assessments are soft-deleted in
-- two places (softDeleteAssessmentAction and soft_delete_user()), so the sync
-- lives on the table rather than in either caller.
--
-- SECURITY DEFINER: staff clients may update player_assessments but have no
-- write policy on player_rating_snapshots, and a refused snapshot write would
-- roll back the delete itself.

CREATE OR REPLACE FUNCTION sync_rating_snapshot_deleted_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE player_rating_snapshots
  SET deleted_at = NEW.deleted_at
  WHERE assessment_id = NEW.id;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_rating_snapshot_deleted_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_rating_snapshot_deleted_at_trg ON player_assessments;
CREATE TRIGGER sync_rating_snapshot_deleted_at_trg
  AFTER UPDATE OF deleted_at ON player_assessments
  FOR EACH ROW
  WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
  EXECUTE FUNCTION sync_rating_snapshot_deleted_at();

-- Bring existing rows in line. Checked on 2026-09-29: no snapshot belonged to a
-- deleted assessment, so this updates nothing today; it stays for other
-- environments and is safe to rerun.
UPDATE player_rating_snapshots s
SET deleted_at = a.deleted_at
FROM player_assessments a
WHERE a.id = s.assessment_id
  AND a.deleted_at IS NOT NULL
  AND s.deleted_at IS NULL;
