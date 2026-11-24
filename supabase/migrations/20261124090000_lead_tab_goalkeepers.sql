-- A leads tab for the goalkeeper campaign. The leads sheet's "שוערים" tab is
-- sent to the leads webhook with tab_slug 'goalkeepers'; a fixed slug, since
-- a tab made on the leads page from a Hebrew name gets a numbered one (tab-N).
-- Placed last among the live tabs.

INSERT INTO lead_tabs (slug, name, color, position, is_default)
SELECT 'goalkeepers', 'שוערים', 'green',
       COALESCE((SELECT MAX(position) FROM lead_tabs WHERE deleted_at IS NULL), -1) + 1,
       false
WHERE NOT EXISTS (SELECT 1 FROM lead_tabs WHERE slug = 'goalkeepers');
