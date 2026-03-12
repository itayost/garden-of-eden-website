import fs from "fs";
import path from "path";
import type { PlayerAssessment } from "@/types/assessment";
import {
  ASSESSMENT_LABELS_HE,
  COORDINATION_OPTIONS,
  BODY_STRUCTURE_OPTIONS,
  LEG_POWER_OPTIONS,
} from "@/types/assessment";
import { compareMetric } from "@/features/player-report/lib/utils/metric-comparison";

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface StaticAssets {
  heeboRegularB64: string;
  heeboBoldB64: string;
  cardTemplateB64: string;
}

export interface PlayerReportHtmlProps {
  profile: {
    full_name: string | null;
    birthdate: string | null;
    position: string | null;
    club: string | null;
    created_at: string;
    processed_avatar_url: string | null;
  };
  assessments: PlayerAssessment[];
  stats: {
    overall_rating: number;
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
    card_type: string | null;
  } | null;
  attendance: { totalSessions: number; weeklyAverage: number } | null;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  socialSkills: string[];
  avatarDataUri: string | null;
}

// Spec-defined metric key lists
const NUMERIC_METRIC_KEYS: (keyof PlayerAssessment)[] = [
  "sprint_5m", "sprint_10m", "sprint_20m",
  "jump_2leg_height", "jump_2leg_distance", "jump_right_leg", "jump_left_leg",
  "blaze_spot_time", "kick_power_kaiser",
  "flexibility_ankle", "flexibility_knee", "flexibility_hip",
];

const CATEGORICAL_METRIC_KEYS: (keyof PlayerAssessment)[] = [
  "coordination", "body_structure", "leg_power_technique",
];

const ALL_METRIC_KEYS: (keyof PlayerAssessment)[] = [
  ...NUMERIC_METRIC_KEYS,
  ...CATEGORICAL_METRIC_KEYS,
];

export function loadStaticAssets(): StaticAssets {
  const pub = (rel: string) => path.join(process.cwd(), "public", rel);
  return {
    heeboRegularB64: fs.readFileSync(pub("fonts/Heebo-Regular.ttf")).toString("base64"),
    heeboBoldB64: fs.readFileSync(pub("fonts/Heebo-Bold.ttf")).toString("base64"),
    cardTemplateB64: fs.readFileSync(pub("card-template-gold.webp")).toString("base64"),
  };
}

// SVG helpers

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function buildRadarSvg(stats: NonNullable<PlayerReportHtmlProps["stats"]>): string {
  const cx = 100, cy = 110, maxR = 75;
  const axes = [
    { key: "pace" as const,      label: "קצב",    angle: 90 },
    { key: "shooting" as const,  label: "קליעה",  angle: 30 },
    { key: "physical" as const,  label: "פיזי",   angle: -30 },
    { key: "defending" as const, label: "הגנה",   angle: -90 },
    { key: "dribbling" as const, label: "כדרור",  angle: -150 },
    { key: "passing" as const,   label: "מסירה",  angle: 150 },
  ];

  const rings = [25, 50, 75, 100].map((pct) => {
    const r = (maxR * pct) / 100;
    const pts = axes.map(({ angle }) => {
      const { x, y } = polarToCartesian(cx, cy, r, angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>`;
  }).join("");

  const axisLines = axes.map(({ angle }) => {
    const { x, y } = polarToCartesian(cx, cy, maxR, angle);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>`;
  }).join("");

  const dataPts = axes.map(({ key, angle }) => {
    const val = Math.max(0, Math.min(100, stats[key]));
    const r = (maxR * val) / 100;
    const { x, y } = polarToCartesian(cx, cy, r, angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const labels = axes.map(({ label, angle }) => {
    const { x, y } = polarToCartesian(cx, cy, maxR + 14, angle);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#9ca3af">${label}</text>`;
  }).join("");

  return `<svg width="200" height="220" xmlns="http://www.w3.org/2000/svg">
${rings}${axisLines}
<polygon points="${dataPts}" fill="rgba(34,197,94,0.2)" stroke="#22c55e" stroke-width="1.5"/>
${labels}
</svg>`;
}

function buildMiniChartSvg(
  key: keyof PlayerAssessment,
  assessments: PlayerAssessment[],
  color: string,
): string {
  // Reverse: assessments are newest-first; chart needs oldest-first
  const values = [...assessments]
    .reverse()
    .map((a) => a[key])
    .filter((v) => v !== null && v !== undefined)
    .map(Number);

  if (values.length < 2) return "";

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const W = 120, H = 60, pad = 6;
  const cW = W - 2 * pad, cH = H - 2 * pad;

  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * cW,
    y: pad + (1 - (v - minVal) / range) * cH,
  }));

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const dots = pts.map((p, i) => {
    const r = i === pts.length - 1 ? 3 : 2;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${color}"/>`;
  }).join("");

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
}

// Helpers

function computeAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  return Math.floor((Date.now() - new Date(birthdate).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function formatISODate(isoStr: string): string {
  return isoStr.split("T")[0];
}

function getCategoricalLabel(key: keyof PlayerAssessment, value: string): string {
  if (key === "coordination") return COORDINATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
  if (key === "body_structure") return BODY_STRUCTURE_OPTIONS.find((o) => o.value === value)?.label ?? value;
  if (key === "leg_power_technique") return LEG_POWER_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return value;
}

function chip(text: string, green = false): string {
  const bg = green ? "#166534" : "#1f2937";
  const fg = green ? "#86efac" : "#d1d5db";
  return `<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:9999px;font-size:10px;font-weight:600;background:${bg};color:${fg};margin:2px;">${text}</span>`;
}

// Main export

export function buildPlayerReportHtml(
  props: PlayerReportHtmlProps,
  assets: StaticAssets,
): string {
  const { profile, assessments, stats, attendance, summary, strengths, weaknesses, socialSkills, avatarDataUri } = props;
  const { heeboRegularB64, heeboBoldB64, cardTemplateB64 } = assets;

  // Escape all user-supplied strings before HTML interpolation
  const eName = escapeHtml(profile.full_name) || "שחקן";
  const ePos = escapeHtml(profile.position);
  const eClub = escapeHtml(profile.club);
  const eSummary = escapeHtml(summary);

  const today = new Date().toISOString().split("T")[0];
  const age = computeAge(profile.birthdate);
  const joinDate = formatISODate(profile.created_at);

  const latest = assessments[0] ?? null;
  const previous = assessments[1] ?? null;

  // FIFA card (140x196, mirrors PlayerCard size="sm")
  const W = 140, H = 196;
  const fifaCardHtml = stats
    ? `<div style="position:relative;width:${W}px;height:${H}px;flex-shrink:0;">
<img src="data:image/webp;base64,${cardTemplateB64}" style="position:absolute;top:0;left:0;width:${W}px;height:${H}px;object-fit:contain;" alt=""/>
<div style="position:absolute;top:${Math.round(H * 0.1)}px;left:${Math.round(W * 0.12)}px;display:flex;flex-direction:column;align-items:center;">
<span style="font-size:32px;font-weight:900;color:#3d2a0f;line-height:1;letter-spacing:-0.02em;">${stats.overall_rating}</span>
<span style="font-size:12px;font-weight:700;color:#3d2a0f;margin-top:2px;">${ePos}</span>
</div>
<div style="position:absolute;top:${Math.round(H * 0.22)}px;left:${Math.round(W * 0.2)}px;right:${Math.round(W * 0.2)}px;height:${Math.round(H * 0.42)}px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
${avatarDataUri
  ? `<img src="${avatarDataUri}" style="width:100%;height:100%;object-fit:contain;" alt=""/>`
  : `<div style="width:65px;height:65px;border-radius:50%;background:rgba(61,42,15,0.12);border:2px solid rgba(61,42,15,0.25);display:flex;align-items:center;justify-content:center;"><span style="font-size:29px;font-weight:700;color:#3d2a0f;">${escapeHtml(eName.charAt(0)) || "?"}</span></div>`
}
</div>
<div style="position:absolute;bottom:${Math.round(H * 0.28)}px;left:${Math.round(W * 0.08)}px;right:${Math.round(W * 0.08)}px;text-align:center;font-size:11px;font-weight:700;color:#3d2a0f;letter-spacing:0.05em;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${eName}</div>
<div style="position:absolute;bottom:${Math.round(H * 0.17)}px;left:${Math.round(W * 0.06)}px;right:${Math.round(W * 0.06)}px;display:flex;justify-content:space-around;align-items:center;" dir="ltr">
${(["PAC","SHO","PAS","DRI","DEF","PHY"] as const).map((label, i) => {
  const vals = [stats.pace, stats.shooting, stats.passing, stats.dribbling, stats.defending, stats.physical];
  return `<div style="display:flex;flex-direction:column;align-items:center;"><span style="font-size:7px;font-weight:600;color:#5c4317;line-height:1.2;">${label}</span><span style="font-size:9px;font-weight:900;color:#3d2a0f;line-height:1.2;">${vals[i]}</span></div>`;
}).join("")}
</div>
</div>`
    : "";

  // Assessment table rows
  const tableRows = assessments.length === 0
    ? ""
    : ALL_METRIC_KEYS.map((key) => {
        const latestVal = latest ? latest[key] : null;
        const prevVal = previous ? previous[key] : null;
        const isCategorical = (CATEGORICAL_METRIC_KEYS as (keyof PlayerAssessment)[]).includes(key);

        const comparison = !isCategorical && latestVal !== null && prevVal !== null
          ? compareMetric(String(key), latestVal, prevVal)
          : null;

        const color = comparison === "improved" ? "#22c55e"
          : comparison === "declined" ? "#d97706"
          : "inherit";

        const displayLatest = isCategorical && latestVal
          ? getCategoricalLabel(key, String(latestVal))
          : latestVal !== null && latestVal !== undefined ? String(latestVal) : "—";

        const displayPrev = isCategorical && prevVal
          ? getCategoricalLabel(key, String(prevVal))
          : prevVal !== null && prevVal !== undefined ? String(prevVal) : "—";

        return `<tr style="border-bottom:1px solid #1f2937;">
<td style="padding:4px 8px;color:#9ca3af;font-size:10px;">${ASSESSMENT_LABELS_HE[String(key)] ?? String(key)}</td>
<td style="padding:4px 8px;text-align:center;font-size:10px;color:${isCategorical ? "inherit" : color};font-weight:${comparison ? "700" : "400"};">${displayLatest}</td>
${previous ? `<td style="padding:4px 8px;text-align:center;font-size:10px;color:#6b7280;">${displayPrev}</td>` : ""}
</tr>`;
      }).join("");

  // Page 2: Highlights
  let improvementsHtml = "";
  if (assessments.length >= 2) {
    const improved = NUMERIC_METRIC_KEYS.filter((key) => {
      return compareMetric(String(key), latest?.[key] ?? null, previous?.[key] ?? null) === "improved";
    }).slice(0, 2);

    if (improved.length > 0) {
      improvementsHtml = improved.map((key) => {
        const lv = Number(latest?.[key]);
        const pv = Number(previous?.[key]);
        const delta = Math.abs(lv - pv).toFixed(2);
        return `<div style="margin-bottom:6px;"><span style="color:#22c55e;font-size:11px;">↑ ${ASSESSMENT_LABELS_HE[String(key)] ?? String(key)}</span><span style="color:#6b7280;font-size:10px;margin-right:4px;">Δ${delta}</span></div>`;
      }).join("");
    } else {
      improvementsHtml = `<div style="color:#6b7280;font-size:11px;">אין שיפורים מדידים</div>`;
    }
  }

  // Page 2: Mini metric charts
  const miniChartsHtml = NUMERIC_METRIC_KEYS.map((key) => {
    const nonNull = assessments.filter((a) => a[key] !== null && a[key] !== undefined);
    if (nonNull.length < 2) return "";

    const comparison = compareMetric(String(key), assessments[0]?.[key] ?? null, assessments[1]?.[key] ?? null);
    const color = comparison === "improved" ? "#22c55e"
      : comparison === "declined" ? "#d97706"
      : "#6b7280";

    const lv = Number(assessments[0]?.[key]);
    const pv = Number(assessments[1]?.[key]);
    const delta = Math.abs(lv - pv).toFixed(2);
    const changeLabel = comparison === "improved" ? `↑ Δ${delta} (שיפור)`
      : comparison === "declined" ? `↓ Δ${delta} (ירידה)`
      : "→ ללא שינוי";

    const svg = buildMiniChartSvg(key, assessments, color);
    if (!svg) return "";

    return `<div style="background:#1f2937;border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:4px;">
<div style="font-size:9px;color:#9ca3af;">${ASSESSMENT_LABELS_HE[String(key)] ?? String(key)}</div>
<div style="font-size:9px;color:${color};">${changeLabel}</div>
${svg}
</div>`;
  }).filter(Boolean).join("");

  // Radar SVG
  const radarSvg = stats ? buildRadarSvg(stats) : "";

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"/>
<style>
@font-face{font-family:"Heebo";src:url("data:font/truetype;base64,${heeboRegularB64}") format("truetype");font-weight:400;}
@font-face{font-family:"Heebo";src:url("data:font/truetype;base64,${heeboBoldB64}") format("truetype");font-weight:700;}
@font-face{font-family:"Heebo";src:url("data:font/truetype;base64,${heeboBoldB64}") format("truetype");font-weight:900;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"Heebo",system-ui,sans-serif;background:#0f172a;color:#f9fafb;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{width:794px;min-height:1123px;padding:28px 32px;background:#111827;display:flex;flex-direction:column;position:relative;}
.page-2{page-break-before:always;}
.footer{margin-top:auto;padding-top:12px;border-top:1px solid #1f2937;display:flex;justify-content:space-between;font-size:9px;color:#6b7280;}
table{width:100%;border-collapse:collapse;margin-top:12px;}
th{font-size:10px;color:#6b7280;padding:4px 8px;text-align:right;border-bottom:1px solid #374151;background:#1f2937;}
</style>
</head>
<body>
<!-- PAGE 1 -->
<div class="page">
<div style="border-top:3px solid #22c55e;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
<div>
<div style="font-size:40px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#f9fafb;">${eName}</div>
<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">
${chip("Garden of Eden Football Academy", true)}
${ePos ? chip(ePos) : ""}
${eClub ? chip(eClub) : ""}
${age !== null ? chip(`גיל ${age}`) : ""}
${chip(`הצטרפות ${joinDate}`)}
${attendance ? chip(`נוכחות ${attendance.weeklyAverage.toFixed(1)}/שבוע`) : chip("לא זמין")}
</div>
</div>
${fifaCardHtml}
</div>

<div style="display:flex;gap:24px;flex:1;">
<!-- Stats column -->
<div style="width:140px;border-left:1px solid #1f2937;padding-left:16px;flex-shrink:0;">
${stats ? `<div style="margin-bottom:12px;"><div style="font-size:9px;color:#6b7280;">דירוג כולל</div><div style="font-size:44px;font-weight:900;color:#22c55e;line-height:1;">${stats.overall_rating}</div></div>
${([{label:"ספרינט 5מ",key:"sprint_5m"as const},{label:"ספרינט 10מ",key:"sprint_10m"as const},{label:"ניתור לגובה",key:"jump_2leg_height"as const},{label:"קייזר",key:"kick_power_kaiser"as const}] as const).map(({label,key})=>{const v=latest?.[key];return `<div style="margin-bottom:8px;"><div style="font-size:9px;color:#6b7280;">${label}</div><div style="font-size:24px;font-weight:700;color:#f9fafb;">${v!==null&&v!==undefined?v:"—"}</div></div>`;}).join("")}`
: `<div style="color:#6b7280;font-size:11px;">אין נתוני FIFA</div>`}
${attendance ? `<div style="margin-top:8px;"><div style="font-size:9px;color:#6b7280;">סה"כ אימונים</div><div style="font-size:24px;font-weight:700;color:#f9fafb;">${attendance.totalSessions}</div></div>` : `<div style="color:#6b7280;font-size:10px;margin-top:8px;">נוכחות: לא זמין</div>`}
</div>

<!-- Content column -->
<div style="flex:1;">
${eSummary ? `<div style="margin-bottom:12px;"><div style="font-size:14px;font-weight:700;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #1f2937;">סיכום</div><div style="font-size:11.5px;color:#d1d5db;line-height:1.6;white-space:pre-wrap;">${eSummary}</div></div>` : ""}
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px;">
<div><div style="font-size:10px;font-weight:700;color:#22c55e;margin-bottom:4px;">נקודות חוזקה</div>${strengths.length?strengths.map(s=>`<div style="font-size:10px;color:#d1d5db;margin-bottom:2px;">• ${escapeHtml(s)}</div>`).join(""):`<div style="font-size:10px;color:#4b5563;">—</div>`}</div>
<div><div style="font-size:10px;font-weight:700;color:#d97706;margin-bottom:4px;">מיקוד לשיפור</div>${weaknesses.length?weaknesses.map(w=>`<div style="font-size:10px;color:#d1d5db;margin-bottom:2px;">• ${escapeHtml(w)}</div>`).join(""):``}</div>
<div><div style="font-size:10px;font-weight:700;color:#818cf8;margin-bottom:4px;">כישורים חברתיים</div>${socialSkills.length?socialSkills.map(s=>`<div style="font-size:10px;color:#d1d5db;margin-bottom:2px;">• ${escapeHtml(s)}</div>`).join(""):``}</div>
</div>
</div>
</div>

${assessments.length > 0 ? `<div style="margin-top:16px;"><div style="font-size:14px;font-weight:700;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #1f2937;">מבדקים</div><table><thead><tr><th>מדד</th><th style="text-align:center;">עדכני</th>${previous?`<th style="text-align:center;">קודם</th>`:""}</tr></thead><tbody>${tableRows}</tbody></table></div>` : ""}

<div class="footer">
<span>Garden of Eden Football Academy</span><span>דף 1 מתוך 2</span><span>${today}</span>
</div>
</div>

<!-- PAGE 2 -->
<div class="page page-2">
<div style="border-top:3px solid #22c55e;padding-top:16px;margin-bottom:16px;">
<div style="font-size:18px;font-weight:700;">${eName} — ניתוח מפורט</div>
</div>

<div style="display:flex;gap:24px;margin-bottom:20px;">
${stats && radarSvg ? `<div style="flex-shrink:0;"><div style="font-size:14px;font-weight:700;margin-bottom:8px;">מפת מיומנויות</div>${radarSvg}</div>` : ""}
<div style="flex:1;">
<div style="font-size:14px;font-weight:700;margin-bottom:8px;">הדגשים</div>
<div style="margin-bottom:12px;"><div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">דירוג כולל</div><div style="font-size:48px;font-weight:900;color:#22c55e;line-height:1;">${stats?.overall_rating ?? "—"}</div><div style="font-size:11px;color:#6b7280;margin-top:4px;">${assessments.length} מבדקים</div></div>
${assessments.length >= 2 ? `<div><div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">שיפורים מדידים</div>${improvementsHtml}</div>` : ""}
</div>
</div>

<div style="font-size:14px;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #1f2937;">מגמות התפתחות</div>
${assessments.length < 2
  ? `<div style="color:#6b7280;font-size:12px;padding:16px 0;">אין מספיק מבדקים להצגת מגמות</div>`
  : `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px;">${miniChartsHtml}</div>`}

<div class="footer">
<span>Garden of Eden Football Academy</span><span>דף 2 מתוך 2</span><span>${today}</span>
</div>
</div>
</body>
</html>`;
}
