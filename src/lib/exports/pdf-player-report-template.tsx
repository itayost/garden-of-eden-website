import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { PlayerAssessment } from "@/types/assessment";
import { ASSESSMENT_LABELS_HE } from "@/types/assessment";
import { compareMetric } from "@/features/player-report/lib/utils/metric-comparison";
import type { ReportData } from "@/features/player-report/types";

// Register Hebrew font
Font.register({
  family: "Heebo",
  fonts: [
    { src: "/fonts/Heebo-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/Heebo-Bold.ttf", fontWeight: 700 },
  ],
});

const C = {
  pageBg: "#111827",
  cardBg: "#1F2937",
  accent: "#22c55e",
  accentAmber: "#f59e0b",
  accentIndigo: "#6366f1",
  white: "#F9FAFB",
  muted: "#9CA3AF",
  border: "#374151",
};

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: C.pageBg,
    padding: 28,
    fontFamily: "Heebo",
  },
  // Header
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottom: 1,
    borderBottomColor: C.border,
  },
  headerLeft: {
    flex: 1,
  },
  playerName: {
    fontSize: 24,
    fontWeight: 700,
    color: C.white,
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 8,
  },
  chip: {
    backgroundColor: C.cardBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 7,
    color: C.muted,
  },
  chipAccent: {
    backgroundColor: C.accent,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 7,
    fontWeight: 700,
    color: "#052e16",
  },
  fifaCardImage: {
    width: 110,
    height: 154,
    marginLeft: 12,
  },
  // Body
  body: {
    flexDirection: "row-reverse",
    gap: 10,
    marginBottom: 12,
  },
  leftColumn: {
    width: 118,
    backgroundColor: C.cardBg,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  rightColumn: {
    flex: 1,
  },
  statBlock: {
    alignItems: "center",
    marginBottom: 8,
    width: "100%",
  },
  statNumber: {
    fontSize: 30,
    fontWeight: 700,
    color: C.accent,
    textAlign: "center",
    lineHeight: 1,
  },
  statSmallNumber: {
    fontSize: 18,
    fontWeight: 700,
    color: C.white,
    textAlign: "center",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 6,
    color: C.muted,
    textAlign: "center",
    marginTop: 2,
  },
  statDivider: {
    height: 1,
    backgroundColor: C.border,
    width: "100%",
    marginVertical: 5,
  },
  // Right column narrative
  summaryText: {
    fontSize: 9,
    color: C.white,
    textAlign: "right",
    lineHeight: 1.55,
    marginBottom: 8,
  },
  bulletSection: {
    marginTop: 5,
  },
  bulletSectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textAlign: "right",
    marginBottom: 3,
  },
  bulletItem: {
    flexDirection: "row-reverse",
    marginBottom: 2,
  },
  bulletDot: {
    fontSize: 7,
    marginLeft: 4,
    marginTop: 1,
  },
  bulletText: {
    fontSize: 8,
    textAlign: "right",
    flex: 1,
    color: C.white,
  },
  // Assessment table
  tableTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: C.accent,
    textAlign: "right",
    marginBottom: 5,
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: C.cardBg,
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 3,
    marginBottom: 1,
  },
  tableRow: {
    flexDirection: "row-reverse",
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottom: 1,
    borderBottomColor: C.border,
  },
  tableRowAlt: {
    backgroundColor: "#161D2B",
  },
  tableCell: {
    flex: 1,
    textAlign: "right",
    fontSize: 7,
    color: C.white,
  },
  tableCellHeader: {
    flex: 1,
    textAlign: "right",
    fontSize: 7,
    fontWeight: 700,
    color: C.muted,
  },
  tableCellImproved: {
    flex: 1,
    textAlign: "right",
    fontSize: 7,
    color: C.accent,
    fontWeight: 700,
  },
  tableCellDeclined: {
    flex: 1,
    textAlign: "right",
    fontSize: 7,
    color: C.accentAmber,
    fontWeight: 700,
  },
  // Page 2
  page2Header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: 1,
    borderBottomColor: C.border,
  },
  page2Title: {
    fontSize: 16,
    fontWeight: 700,
    color: C.white,
    textAlign: "right",
  },
  page2Date: {
    fontSize: 8,
    color: C.muted,
    textAlign: "left",
  },
  chartImage: {
    width: "100%",
    marginVertical: 6,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: 1,
    borderTopColor: C.border,
    paddingTop: 5,
  },
  footerText: {
    fontSize: 6,
    color: C.muted,
  },
  footerAccent: {
    fontSize: 6,
    color: C.accent,
    fontWeight: 700,
  },
});

const METRIC_KEYS: (keyof PlayerAssessment)[] = [
  "sprint_5m", "sprint_10m", "sprint_20m",
  "jump_2leg_height", "jump_2leg_distance", "jump_right_leg", "jump_left_leg",
  "blaze_spot_time",
  "kick_power_right_foot", "kick_power_left_foot", "kick_power_machine_pct",
  "flexibility_ankle", "flexibility_knee", "flexibility_hip",
  "coordination", "body_structure", "leg_power_technique",
];

function BulletSection({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.bulletSection}>
      <Text style={[styles.bulletSectionTitle, { color }]}>{title}</Text>
      {items.slice(0, 4).map((item, i) => (
        <View key={i} style={styles.bulletItem}>
          <Text style={[styles.bulletDot, { color }]}>{"•"}</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function PageFooter({
  playerName,
  generatedAt,
  pageNum,
}: {
  playerName: string;
  generatedAt: string;
  pageNum: number;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerAccent}>Garden of Eden</Text>
      <Text style={styles.footerText}>עמוד {pageNum}</Text>
      <Text style={styles.footerText}>{playerName} | {generatedAt}</Text>
    </View>
  );
}

export interface PlayerReportPdfDocumentProps {
  playerName: string;
  details: {
    age: string | null;
    position: string | null;
    club: string | null;
    registrationDate: string;
    weeklyAttendance: string;
  };
  stats: ReportData["stats"];
  assessments: readonly PlayerAssessment[];
  radarChartImage: string | null;
  trendsChartImage: string | null;
  fifaCardImage: string | null;
  strengths: string[];
  weaknesses: string[];
  socialSkills: string[];
  summary: string;
  generatedAt: string;
}

export function PlayerReportPdfDocument({
  playerName,
  details,
  stats,
  assessments,
  radarChartImage,
  trendsChartImage,
  fifaCardImage,
  strengths,
  weaknesses,
  socialSkills,
  summary,
  generatedAt,
}: PlayerReportPdfDocumentProps) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString("he-IL");

  const ageStr = details.age;

  const recent = assessments.slice(0, 2);
  const latestAssessment = assessments[0] ?? null;

  return (
    <Document>
      {/* ===== PAGE 1: Profile + Summary + Assessments ===== */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.playerName}>{playerName.toUpperCase()}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.chipAccent}>Garden of Eden</Text>
              {details.position && <Text style={styles.chip}>{details.position}</Text>}
              {details.club && <Text style={styles.chip}>{details.club}</Text>}
              {ageStr && <Text style={styles.chip}>{"גיל " + ageStr}</Text>}
              <Text style={styles.chip}>{"הצטרפות: " + formatDate(details.registrationDate)}</Text>
              <Text style={styles.chip}>{"נוכחות: " + details.weeklyAttendance}</Text>
            </View>
          </View>
          {fifaCardImage && (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={fifaCardImage} style={styles.fifaCardImage} />
          )}
        </View>

        {/* Body: two columns */}
        <View style={styles.body}>
          {/* Left column: key stats */}
          {stats && (
            <View style={styles.leftColumn}>
              <View style={styles.statBlock}>
                <Text style={styles.statNumber}>{stats.overall_rating}</Text>
                <Text style={styles.statLabel}>{"דירוג כללי"}</Text>
              </View>
              <View style={styles.statDivider} />
              {(latestAssessment?.sprint_10m ?? latestAssessment?.sprint_5m) != null && (
                <View style={styles.statBlock}>
                  <Text style={styles.statSmallNumber}>
                    {String(latestAssessment?.sprint_10m ?? latestAssessment?.sprint_5m)}
                  </Text>
                  <Text style={styles.statLabel}>{"ספרינט (שנ')"}</Text>
                </View>
              )}
              {latestAssessment?.jump_2leg_height != null && (
                <View style={styles.statBlock}>
                  <Text style={styles.statSmallNumber}>{String(latestAssessment.jump_2leg_height)}</Text>
                  <Text style={styles.statLabel}>{"קפיצה (ס\"מ)"}</Text>
                </View>
              )}
              {latestAssessment?.kick_power_right_foot != null && (
                <View style={styles.statBlock}>
                  <Text style={styles.statSmallNumber}>{String(latestAssessment.kick_power_right_foot)}</Text>
                  <Text style={styles.statLabel}>{"בעיטה ימין (W)"}</Text>
                </View>
              )}
              {latestAssessment?.kick_power_left_foot != null && (
                <View style={styles.statBlock}>
                  <Text style={styles.statSmallNumber}>{String(latestAssessment.kick_power_left_foot)}</Text>
                  <Text style={styles.statLabel}>{"בעיטה שמאל (W)"}</Text>
                </View>
              )}
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Text style={styles.statSmallNumber}>{details.weeklyAttendance.split(" ")[0]}</Text>
                <Text style={styles.statLabel}>{"נוכחות/שבוע"}</Text>
              </View>
            </View>
          )}

          {/* Right column: summary + bullets */}
          <View style={styles.rightColumn}>
            {summary ? (
              <Text style={styles.summaryText}>{summary}</Text>
            ) : null}
            <BulletSection
              title={"נקודות חוזקה"}
              items={strengths}
              color={C.accent}
            />
            <BulletSection
              title={"מיקוד לשיפור"}
              items={weaknesses}
              color={C.accentAmber}
            />
            <BulletSection
              title={"כישורים חברתיים"}
              items={socialSkills}
              color={C.accentIndigo}
            />
          </View>
        </View>

        {/* Assessment table */}
        {recent.length > 0 && (
          <View>
            <Text style={styles.tableTitle}>{"מבדקים גופניים"}</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellHeader}>{"מדד"}</Text>
              {recent.map((a) => (
                <Text key={a.id} style={styles.tableCellHeader}>
                  {formatDate(a.assessment_date)}
                </Text>
              ))}
            </View>
            {METRIC_KEYS.map((key, rowIdx) => {
              const latest = recent[0]?.[key] as string | number | null ?? null;
              const previous = recent[1]?.[key] as string | number | null ?? null;
              const result = compareMetric(String(key), latest, previous);
              const isImproved = result === "improved";
              const isDeclined = result === "declined";
              return (
                <View
                  key={key}
                  style={[styles.tableRow, rowIdx % 2 === 1 ? styles.tableRowAlt : {}]}
                >
                  <Text style={styles.tableCellHeader}>
                    {ASSESSMENT_LABELS_HE[key] ?? String(key)}
                  </Text>
                  <Text
                    style={
                      isImproved
                        ? styles.tableCellImproved
                        : isDeclined
                          ? styles.tableCellDeclined
                          : styles.tableCell
                    }
                  >
                    {String(latest ?? "---")}
                  </Text>
                  {recent.length > 1 && (
                    <Text style={styles.tableCell}>{String(previous ?? "---")}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <PageFooter playerName={playerName} generatedAt={generatedAt} pageNum={1} />
      </Page>

      {/* ===== PAGE 2: Progress Analysis ===== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.page2Header}>
          <View>
            <Text style={styles.page2Title}>{playerName + " — ניתוח התקדמות"}</Text>
          </View>
          <Text style={styles.page2Date}>{generatedAt}</Text>
        </View>

        {radarChartImage && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={radarChartImage} style={styles.chartImage} />
        )}
        {trendsChartImage && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={trendsChartImage} style={styles.chartImage} />
        )}

        <PageFooter playerName={playerName} generatedAt={generatedAt} pageNum={2} />
      </Page>
    </Document>
  );
}
