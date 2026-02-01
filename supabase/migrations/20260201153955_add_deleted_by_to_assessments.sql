-- Add deleted_by column to player_assessments for audit trail
-- This tracks which admin deleted the assessment
ALTER TABLE player_assessments
ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN player_assessments.deleted_by IS 'UUID of admin who soft-deleted this assessment';
