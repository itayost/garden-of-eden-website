/**
 * Seed script: parse three HTML mockup files and populate book_* tables.
 *
 * Sources:
 *   features-to-implement/trainee-workouts-book/garden-of-eden-book.html
 *   features-to-implement/trainee-workouts-book/garden-of-eden-drills.html
 *   features-to-implement/trainee-workouts-book/drill-card-1v1-defense.html
 *
 * Usage:
 *   npx tsx scripts/seed-development-book.ts --dry-run   # parse only, no DB
 *   npx tsx scripts/seed-development-book.ts             # parse + write to DB
 *
 * CRITICAL: this script targets the PRODUCTION Supabase database.
 * Run against DB only when explicitly ready. --dry-run is the safe default.
 */

import { readFileSync } from "node:fs";
import * as path from "node:path";
import { parse as parseHtml, type HTMLElement } from "node-html-parser";
import { POSITION_GROUPS } from "../src/features/development-book/lib/positions";
import type { CanonicalPosition } from "../src/features/development-book/lib/types";

const DRY_RUN = process.argv.includes("--dry-run");

const DIR = path.join(
  process.cwd(),
  "features-to-implement",
  "trainee-workouts-book"
);

// ---------------------------------------------------------------------------
// Position mapping: labelHe -> group
// ---------------------------------------------------------------------------
const labelToGroup = new Map(POSITION_GROUPS.map((g) => [g.labelHe, g]));

// Labels that mean "this param applies to all positions"
const ALL_POSITION_LABELS = new Set(["כל עמדה", "קפטן", "לפי עמדה"]);

function slugify(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "item"}-${index}`;
}

/** Collapse whitespace (including newlines) from extracted innerHTML text. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Domain types for the parsed content (in-memory, schema-aligned)
// ---------------------------------------------------------------------------

interface ParsedDrill {
  name_en: string;
  name_he?: string;
  muscle_he?: string;
  sets_he?: string;
  how_he?: string;
  why_he?: string;
  connect_he?: string;
  order_index: number;
  slug: string;
}

interface ParsedAgeRow {
  age_group: string;
  what_he?: string;
  metric_value_he?: string;
  recovery_he?: string;
  order_index: number;
}

interface ParsedParameter {
  number: number | null;
  name_he: string;
  order_index: number;
  slug: string;
  is_all_positions: boolean;
  positions: CanonicalPosition[];
  drills: ParsedDrill[];
  age_rows: ParsedAgeRow[];
  report_text_he?: string;
  report_highlight_he?: string;
  verbal_text_he?: string;
  verbal_tip_he?: string;
}

interface ParsedCategory {
  name_he: string;
  icon?: string;
  order_index: number;
  slug: string;
  parameters: ParsedParameter[];
}

interface ParsedDrillCard {
  // The English name of the drill this card belongs to
  drill_name_en: string;
  situation_label_he?: string;
  subtitle_he?: string;
  age_min_label?: string;
  level_label?: string;
  golden_rule_he?: string;
  failure_steps: Array<{ text_he: string; is_final: boolean; order_index: number }>;
  phases: Array<{
    number: number;
    name_he: string;
    subtitle_he?: string;
    drill_note_he?: string;
    order_index: number;
    points: Array<{ text_he: string; order_index: number }>;
  }>;
  metrics: Array<{
    label_he: string;
    before_he?: string;
    target_he?: string;
    order_index: number;
  }>;
}

// ---------------------------------------------------------------------------
// Parse garden-of-eden-book.html
// ---------------------------------------------------------------------------

function parseBookHtml(): ParsedCategory[] {
  const raw = readFileSync(path.join(DIR, "garden-of-eden-book.html"), "utf8");
  const doc = parseHtml(raw);

  const categories: ParsedCategory[] = [];

  let catIndex = 0;
  let globalParamIndex = 0;

  // Each .cat-divider is followed by a .params-grid containing .param-card
  const catDividers = doc.querySelectorAll(".cat-divider");

  for (const catDiv of catDividers) {
    const iconEl = catDiv.querySelector(".cat-icon");
    const labelEl = catDiv.querySelector(".cat-label");
    if (!labelEl) continue;

    const catNameHe = labelEl.textContent.trim();
    const catIcon = iconEl ? iconEl.textContent.trim() : undefined;

    const catSlug = slugify(catNameHe, catIndex);
    const category: ParsedCategory = {
      name_he: catNameHe,
      icon: catIcon,
      order_index: catIndex,
      slug: catSlug,
      parameters: [],
    };

    // The params-grid immediately follows the cat-divider in the DOM.
    // Find the next sibling that is a .params-grid
    const paramsGrid = findNextSibling(catDiv, ".params-grid");
    if (!paramsGrid) {
      categories.push(category);
      catIndex++;
      continue;
    }

    const paramCards = paramsGrid.querySelectorAll(".param-card");

    for (const card of paramCards) {
      const numEl = card.querySelector(".param-num");
      const nameEl = card.querySelector(".param-name");
      if (!nameEl) continue;

      const rawNum = numEl ? numEl.textContent.trim() : "";
      // Numbers may be "01", "12–15", etc. — take first integer
      const numMatch = rawNum.match(/\d+/);
      const paramNumber = numMatch ? parseInt(numMatch[0], 10) : null;

      const paramNameHe = nameEl.textContent.trim();
      const paramSlug = slugify(paramNameHe, globalParamIndex);

      // Position tags
      const posTags = card.querySelectorAll(".pos-tag");
      let isAllPositions = false;
      const positions: CanonicalPosition[] = [];

      for (const tag of posTags) {
        const tagText = tag.textContent.trim();
        if (ALL_POSITION_LABELS.has(tagText)) {
          isAllPositions = true;
          break;
        }
        const group = labelToGroup.get(tagText);
        if (group && !group.isAll) {
          for (const pos of group.positions) {
            if (!positions.includes(pos)) positions.push(pos);
          }
        }
      }

      // Tab panels
      const drills = parseExercisesPanel(card, globalParamIndex);
      const ageRows = parseAgePanel(card);
      const { reportText, reportHighlight } = parseReportPanel(card);
      const { verbalText, verbalTip } = parseVerbalPanel(card);

      const param: ParsedParameter = {
        number: paramNumber,
        name_he: paramNameHe,
        order_index: globalParamIndex,
        slug: paramSlug,
        is_all_positions: isAllPositions,
        positions,
        drills,
        age_rows: ageRows,
        report_text_he: reportText,
        report_highlight_he: reportHighlight,
        verbal_text_he: verbalText,
        verbal_tip_he: verbalTip,
      };

      category.parameters.push(param);
      globalParamIndex++;
    }

    categories.push(category);
    catIndex++;
  }

  return categories;
}

/** Walk sibling nodes (as HTMLElement.nextElementSibling) until we find one matching selector. */
function findNextSibling(el: HTMLElement, selector: string): HTMLElement | null {
  let current = el.nextElementSibling as HTMLElement | null;
  while (current) {
    if (current.classNames && current.matches(selector)) return current;
    current = current.nextElementSibling as HTMLElement | null;
  }
  return null;
}

function parseExercisesPanel(card: HTMLElement, baseIndex: number): ParsedDrill[] {
  const panel = card.querySelector('[data-panel="t"]');
  if (!panel) return [];

  const items = panel.querySelectorAll(".ex-item");
  const drills: ParsedDrill[] = [];

  let i = 0;
  for (const item of items) {
    const nameEl = item.querySelector(".ex-name");
    if (!nameEl) continue;

    const nameRaw = nameEl.textContent.trim();
    const muscleEl = item.querySelector(".ex-muscle");
    const setsEl = item.querySelector(".ex-sets");
    const howEl = item.querySelector(".ex-how");
    const whyEl = item.querySelector(".ex-why");

    // Treat the full .ex-name text as the English name (these are typically English)
    const drillSlug = slugify(nameRaw, baseIndex * 100 + i);

    drills.push({
      name_en: nameRaw,
      muscle_he: muscleEl ? muscleEl.textContent.trim() : undefined,
      sets_he: setsEl ? setsEl.textContent.trim() : undefined,
      how_he: howEl ? howEl.textContent.trim() : undefined,
      why_he: whyEl ? whyEl.textContent.trim() : undefined,
      order_index: i,
      slug: drillSlug,
    });
    i++;
  }

  return drills;
}

function parseAgePanel(card: HTMLElement): ParsedAgeRow[] {
  const panel = card.querySelector('[data-panel="a"]');
  if (!panel) return [];

  const table = panel.querySelector(".age-table");
  if (!table) return [];

  // Collect recovery text per age-group from .recovery-grid if present
  const recoveryGrid = panel.querySelector(".recovery-grid");
  const recoveryMap = new Map<string, string>();
  if (recoveryGrid) {
    const items = recoveryGrid.querySelectorAll(".recovery-item");
    for (const item of items) {
      const strong = item.querySelector("strong");
      if (strong) {
        const label = strong.textContent.trim();
        const rest = item.textContent.replace(strong.textContent, "").trim();
        recoveryMap.set(label, rest);
      }
    }
  }

  const rows = table.querySelectorAll("tr");
  const ageRows: ParsedAgeRow[] = [];
  let rowIndex = 0;

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) continue; // header row

    const ageBadge = cells[0].querySelector(".age-badge");
    const ageGroup = ageBadge ? ageBadge.textContent.trim() : cells[0].textContent.trim();

    const whatText = cells[1].textContent.trim();
    const metricText = cells.length > 2 ? cells[2].textContent.trim() : undefined;

    // Match recovery by age group key
    let recoveryText: string | undefined;
    for (const [key, val] of recoveryMap.entries()) {
      if (ageGroup.includes(key) || key.includes(ageGroup)) {
        recoveryText = val;
        break;
      }
    }

    ageRows.push({
      age_group: ageGroup,
      what_he: whatText || undefined,
      metric_value_he: metricText || undefined,
      recovery_he: recoveryText,
      order_index: rowIndex,
    });
    rowIndex++;
  }

  return ageRows;
}

function parseReportPanel(card: HTMLElement): { reportText?: string; reportHighlight?: string } {
  const panel = card.querySelector('[data-panel="r"]');
  if (!panel) return {};

  const textEl = panel.querySelector(".report-text");
  const highlightEl = panel.querySelector(".report-highlight");

  return {
    reportText: textEl ? textEl.textContent.trim() : undefined,
    reportHighlight: highlightEl ? highlightEl.textContent.trim() : undefined,
  };
}

function parseVerbalPanel(card: HTMLElement): { verbalText?: string; verbalTip?: string } {
  const panel = card.querySelector('[data-panel="v"]');
  if (!panel) return {};

  const textEl = panel.querySelector(".verbal-text");
  const tipEl = panel.querySelector(".verbal-tip");

  return {
    verbalText: textEl ? textEl.textContent.trim() : undefined,
    verbalTip: tipEl ? tipEl.textContent.trim() : undefined,
  };
}

// ---------------------------------------------------------------------------
// Parse garden-of-eden-drills.html
// Merge drill.connect_he into existing drills by English name match.
// ---------------------------------------------------------------------------

interface DrillsHtmlDrill {
  name_en: string;
  connect_he?: string;
}

function parseDrillsHtml(): Map<string, string> {
  const raw = readFileSync(path.join(DIR, "garden-of-eden-drills.html"), "utf8");
  const doc = parseHtml(raw);

  // name_en (normalized) -> connect_he
  const connectMap = new Map<string, string>();

  const items = doc.querySelectorAll(".drill-item");
  for (const item of items) {
    const nameEl = item.querySelector(".drill-name");
    const connectEl = item.querySelector(".drill-connect");
    if (!nameEl) continue;

    const name = nameEl.textContent.trim();
    if (!connectEl) continue;

    // Strip the "החיבור:" prefix and the <strong> tag text
    const connectText = connectEl.textContent.replace(/^[^:]+:/, "").trim();
    connectMap.set(normalizeEnName(name), connectText);
  }

  return connectMap;
}

function normalizeEnName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9֐-׿]+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Parse drill-card-1v1-defense.html
// ---------------------------------------------------------------------------

function parseDrillCard(): ParsedDrillCard | null {
  const raw = readFileSync(
    path.join(DIR, "drill-card-1v1-defense.html"),
    "utf8"
  );
  const doc = parseHtml(raw);

  // Identify drill name from footer meta "פרמטר #07" and title
  // The card title is the <div class="drill-title">
  const titleEl = doc.querySelector(".drill-title");
  const subtitleEl = doc.querySelector(".drill-subtitle");
  const tagsEls = doc.querySelectorAll(".tag");

  // Drill name for matching: "Defensive Stance Drill" or "1v1 Defense" — use a fixed key
  // The card is for "אחד על אחד הגנתי" (param 02), matching drill "Defensive Stance Drill"
  // Use a specific identifier string to match back
  const CARD_DRILL_NAME_EN = "Defensive Stance Drill";

  const situationLabel = titleEl ? collapseWhitespace(titleEl.textContent) : undefined;
  const subtitle = subtitleEl ? collapseWhitespace(subtitleEl.textContent) : undefined;

  let ageMinLabel: string | undefined;
  let levelLabel: string | undefined;
  for (const tag of tagsEls) {
    const text = tag.textContent.trim();
    if (tag.classNames.includes("tag-age")) ageMinLabel = text;
    if (tag.classNames.includes("tag-level")) levelLabel = text;
  }

  // Failure chain steps
  const chainItems = doc.querySelectorAll(".chain-section .chain-item");
  const failureSteps = chainItems.map((item, i) => ({
    text_he: item.querySelector(".chain-text")?.textContent.trim() ?? item.textContent.trim(),
    is_final: i === chainItems.length - 1,
    order_index: i,
  }));

  // Training phases
  const phaseCards = doc.querySelectorAll(".phase-card");
  const phases = phaseCards.map((phase, phaseIdx) => {
    const numEl = phase.querySelector(".phase-num");
    const nameEl = phase.querySelector(".phase-name");
    const cueEl = phase.querySelector(".phase-cue");
    const drillBoxEl = phase.querySelector(".drill-box p");

    const numText = numEl ? numEl.textContent.trim() : "";
    const phaseNum = parseInt(numText, 10) || phaseIdx + 1;

    // .phase-name has a <small> child — extract the main name without <small>
    let phaseName = "";
    let phaseSubtitle: string | undefined;
    if (nameEl) {
      const smallEl = nameEl.querySelector("small");
      phaseSubtitle = smallEl ? smallEl.textContent.trim() : undefined;
      phaseName = nameEl.textContent
        .replace(smallEl?.textContent ?? "", "")
        .trim();
    }

    const drillNote = drillBoxEl ? drillBoxEl.textContent.trim() : undefined;

    // Key points for this phase
    const keyPoints = phase.querySelectorAll(".key-point span");
    const points = keyPoints.map((kp, kpIdx) => ({
      text_he: kp.textContent.trim(),
      order_index: kpIdx,
    }));

    return {
      number: phaseNum,
      name_he: phaseName,
      subtitle_he: phaseSubtitle,
      drill_note_he: drillNote,
      order_index: phaseIdx,
      points,
    };
  });

  // Golden rule
  const goldenRuleEl = doc.querySelector(".golden-rule-text");
  const goldenRule = goldenRuleEl ? goldenRuleEl.textContent.trim() : undefined;

  // KPI / metrics table
  const kpiTable = doc.querySelector(".kpi-table");
  const metrics: ParsedDrillCard["metrics"] = [];
  if (kpiTable) {
    const rows = kpiTable.querySelectorAll("tr");
    let metricIdx = 0;
    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) continue; // header or empty
      const label = cells[0].textContent.trim();
      const before = cells[1].textContent.trim();
      const target = cells[2].textContent.trim();
      metrics.push({
        label_he: label,
        before_he: before || undefined,
        target_he: target || undefined,
        order_index: metricIdx,
      });
      metricIdx++;
    }
  }

  return {
    drill_name_en: CARD_DRILL_NAME_EN,
    situation_label_he: situationLabel,
    subtitle_he: subtitle,
    age_min_label: ageMinLabel,
    level_label: levelLabel,
    golden_rule_he: goldenRule,
    failure_steps: failureSteps,
    phases,
    metrics,
  };
}

// ---------------------------------------------------------------------------
// Merge connect_he from drills HTML into book parameters
// ---------------------------------------------------------------------------

function mergeConnectHe(
  categories: ParsedCategory[],
  connectMap: Map<string, string>
): void {
  for (const cat of categories) {
    for (const param of cat.parameters) {
      for (const drill of param.drills) {
        const key = normalizeEnName(drill.name_en);
        const connect = connectMap.get(key);
        if (connect && !drill.connect_he) {
          drill.connect_he = connect;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Dry-run output
// ---------------------------------------------------------------------------

function dryRun(
  categories: ParsedCategory[],
  drillCard: ParsedDrillCard | null
): void {
  let totalDrills = 0;
  let totalAgeRows = 0;
  let totalParams = 0;

  for (const cat of categories) {
    totalParams += cat.parameters.length;
    for (const param of cat.parameters) {
      totalDrills += param.drills.length;
      totalAgeRows += param.age_rows.length;
    }
  }

  console.log("=== seed-development-book --dry-run ===\n");
  console.log(`categories:     ${categories.length}`);
  console.log(`parameters:     ${totalParams}`);
  console.log(`drills:         ${totalDrills}`);
  console.log(`age rows:       ${totalAgeRows}`);
  console.log(`drill cards:    ${drillCard ? 1 : 0}`);
  console.log("");

  // Sample: first parameter of first category
  if (categories.length > 0 && categories[0].parameters.length > 0) {
    const sampleCat = categories[0];
    const sampleParam = sampleCat.parameters[0];
    console.log("--- Sample parameter ---");
    console.log(`category:       ${sampleCat.name_he}`);
    console.log(`param:          [${sampleParam.number}] ${sampleParam.name_he}`);
    console.log(`slug:           ${sampleParam.slug}`);
    console.log(`is_all_pos:     ${sampleParam.is_all_positions}`);
    console.log(
      `positions:      ${sampleParam.positions.length > 0 ? sampleParam.positions.join(", ") : "(none — all)"}`
    );
    console.log(`drills count:   ${sampleParam.drills.length}`);
    console.log(`age rows count: ${sampleParam.age_rows.length}`);
    if (sampleParam.drills.length > 0) {
      const d = sampleParam.drills[0];
      console.log(`\n  drill[0]: ${d.name_en}`);
      console.log(`    muscle:  ${d.muscle_he ?? "(none)"}`);
      console.log(`    sets:    ${d.sets_he ?? "(none)"}`);
      console.log(`    connect: ${d.connect_he ?? "(none)"}`);
    }
    console.log("");
  }

  if (drillCard) {
    console.log("--- Drill card (1v1 defense) ---");
    console.log(`drill match key:   ${drillCard.drill_name_en}`);
    console.log(`situation:         ${drillCard.situation_label_he ?? "(none)"}`);
    console.log(`failure steps:     ${drillCard.failure_steps.length}`);
    console.log(`phases:            ${drillCard.phases.length}`);
    console.log(`metrics:           ${drillCard.metrics.length}`);
    console.log("");
  }

  // Per-category breakdown
  console.log("--- Category breakdown ---");
  for (const cat of categories) {
    console.log(`  ${cat.name_he} (${cat.parameters.length} params)`);
  }
  console.log("\nDry run complete. To seed the DB, run without --dry-run.");
}

// ---------------------------------------------------------------------------
// DB seeding
// ---------------------------------------------------------------------------

async function seedDb(
  categories: ParsedCategory[],
  drillCard: ParsedDrillCard | null
): Promise<void> {
  // Only import DB utilities inside the non-dry-run branch
  const { loadEnvLocal, getAdminClient } = await import("./import-utils");
  loadEnvLocal();
  const supabase = getAdminClient();

  console.log("=== seed-development-book (LIVE DB) ===\n");
  console.log("Wiping existing book_categories (cascades to all children)...");

  const { error: wipeErr } = await supabase
    .from("book_categories")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (wipeErr) {
    console.error("Failed to wipe:", wipeErr);
    process.exit(1);
  }
  console.log("Wipe complete.\n");

  // Track all inserted drill rows for the card lookup
  const drillIdByEnName = new Map<string, string>();

  for (const cat of categories) {
    // Insert category
    const { data: catRow, error: catErr } = await supabase
      .from("book_categories")
      .insert({
        slug: cat.slug,
        name_he: cat.name_he,
        icon: cat.icon ?? null,
        order_index: cat.order_index,
      })
      .select("id")
      .single();

    if (catErr || !catRow) {
      console.error(`Failed to insert category "${cat.name_he}":`, catErr);
      process.exit(1);
    }

    const catId = catRow.id as string;
    console.log(`Inserted category: ${cat.name_he} (${cat.parameters.length} params)`);

    for (const param of cat.parameters) {
      // Insert parameter
      const { data: paramRow, error: paramErr } = await supabase
        .from("book_parameters")
        .insert({
          category_id: catId,
          number: param.number ?? null,
          slug: param.slug,
          name_he: param.name_he,
          order_index: param.order_index,
          is_all_positions: param.is_all_positions,
          report_text_he: param.report_text_he ?? null,
          report_highlight_he: param.report_highlight_he ?? null,
          verbal_text_he: param.verbal_text_he ?? null,
          verbal_tip_he: param.verbal_tip_he ?? null,
        })
        .select("id")
        .single();

      if (paramErr || !paramRow) {
        console.error(`Failed to insert parameter "${param.name_he}":`, paramErr);
        process.exit(1);
      }

      const paramId = paramRow.id as string;

      // Insert positions
      if (!param.is_all_positions && param.positions.length > 0) {
        const { error: posErr } = await supabase
          .from("book_parameter_positions")
          .insert(
            param.positions.map((pos) => ({
              parameter_id: paramId,
              position: pos,
            }))
          );
        if (posErr) {
          console.error(`Failed to insert positions for "${param.name_he}":`, posErr);
        }
      }

      // Insert drills
      for (const drill of param.drills) {
        const { data: drillRow, error: drillErr } = await supabase
          .from("book_drills")
          .insert({
            parameter_id: paramId,
            slug: drill.slug,
            name_en: drill.name_en,
            name_he: drill.name_he ?? null,
            muscle_he: drill.muscle_he ?? null,
            sets_he: drill.sets_he ?? null,
            how_he: drill.how_he ?? null,
            why_he: drill.why_he ?? null,
            connect_he: drill.connect_he ?? null,
            order_index: drill.order_index,
          })
          .select("id")
          .single();

        if (drillErr || !drillRow) {
          console.error(`Failed to insert drill "${drill.name_en}":`, drillErr);
          continue;
        }

        drillIdByEnName.set(normalizeEnName(drill.name_en), drillRow.id as string);
      }

      // Insert age rows
      if (param.age_rows.length > 0) {
        const { error: ageErr } = await supabase.from("book_age_rows").insert(
          param.age_rows.map((row) => ({
            parameter_id: paramId,
            age_group: row.age_group,
            what_he: row.what_he ?? null,
            metric_value_he: row.metric_value_he ?? null,
            recovery_he: row.recovery_he ?? null,
            order_index: row.order_index,
          }))
        );
        if (ageErr) {
          console.error(`Failed to insert age rows for "${param.name_he}":`, ageErr);
        }
      }
    }
  }

  // Insert drill card
  if (drillCard) {
    const drillId = drillIdByEnName.get(normalizeEnName(drillCard.drill_name_en));
    if (!drillId) {
      console.warn(
        `Warning: could not find drill "${drillCard.drill_name_en}" to attach card — skipping card.`
      );
    } else {
      const { data: cardRow, error: cardErr } = await supabase
        .from("book_drill_cards")
        .insert({
          drill_id: drillId,
          situation_label_he: drillCard.situation_label_he ?? null,
          subtitle_he: drillCard.subtitle_he ?? null,
          age_min_label: drillCard.age_min_label ?? null,
          level_label: drillCard.level_label ?? null,
          golden_rule_he: drillCard.golden_rule_he ?? null,
        })
        .select("id")
        .single();

      if (cardErr || !cardRow) {
        console.error("Failed to insert drill card:", cardErr);
      } else {
        const cardId = cardRow.id as string;

        // Failure steps
        if (drillCard.failure_steps.length > 0) {
          const { error: fsErr } = await supabase
            .from("book_drill_card_failure_steps")
            .insert(
              drillCard.failure_steps.map((fs) => ({
                card_id: cardId,
                text_he: fs.text_he,
                is_final: fs.is_final,
                order_index: fs.order_index,
              }))
            );
          if (fsErr) console.error("Failed to insert failure steps:", fsErr);
        }

        // Phases
        for (const phase of drillCard.phases) {
          const { data: phaseRow, error: phaseErr } = await supabase
            .from("book_drill_card_phases")
            .insert({
              card_id: cardId,
              number: phase.number,
              name_he: phase.name_he,
              subtitle_he: phase.subtitle_he ?? null,
              drill_note_he: phase.drill_note_he ?? null,
              order_index: phase.order_index,
            })
            .select("id")
            .single();

          if (phaseErr || !phaseRow) {
            console.error(`Failed to insert phase "${phase.name_he}":`, phaseErr);
            continue;
          }

          if (phase.points.length > 0) {
            const { error: ppErr } = await supabase
              .from("book_drill_card_phase_points")
              .insert(
                phase.points.map((pt) => ({
                  phase_id: phaseRow.id as string,
                  text_he: pt.text_he,
                  order_index: pt.order_index,
                }))
              );
            if (ppErr) console.error(`Failed to insert phase points:`, ppErr);
          }
        }

        // Metrics
        if (drillCard.metrics.length > 0) {
          const { error: metricsErr } = await supabase
            .from("book_drill_card_metrics")
            .insert(
              drillCard.metrics.map((m) => ({
                card_id: cardId,
                label_he: m.label_he,
                before_he: m.before_he ?? null,
                target_he: m.target_he ?? null,
                order_index: m.order_index,
              }))
            );
          if (metricsErr) console.error("Failed to insert metrics:", metricsErr);
        }

        console.log("\nInserted drill card for:", drillCard.drill_name_en);
      }
    }
  }

  console.log("\nSeed complete.");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const categories = parseBookHtml();
  const connectMap = parseDrillsHtml();
  mergeConnectHe(categories, connectMap);
  const drillCard = parseDrillCard();

  if (DRY_RUN) {
    dryRun(categories, drillCard);
    return;
  }

  await seedDb(categories, drillCard);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
