-- Fix: Kaiser/Jump data swap from CSV migration
-- The CSV migration script stored jump height values (100-300+ cm) into
-- kick_power_kaiser (a percentage field) instead of jump_2leg_height.
-- This migration moves those misplaced values to the correct column.
--
-- The > 20 threshold safely distinguishes heights (100-300 cm) from
-- legitimate kick power percentages (3-7%).

UPDATE player_assessments
SET jump_2leg_height = kick_power_kaiser,
    kick_power_kaiser = NULL
WHERE jump_2leg_height IS NULL
  AND kick_power_kaiser IS NOT NULL
  AND kick_power_kaiser > 20;
