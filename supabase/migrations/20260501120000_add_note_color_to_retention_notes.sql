-- Add note_color to retention_notes for highlighting important notes
ALTER TABLE retention_notes
  ADD COLUMN note_color text NOT NULL DEFAULT 'none'
  CHECK (note_color IN ('none', 'yellow', 'red', 'green'));
