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

// Register Hebrew font - same as assessment template
Font.register({
  family: "Heebo",
  fonts: [
    { src: "/fonts/Heebo-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/Heebo-Bold.ttf", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    fontFamily: "Heebo",
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: "#22c55e",
    paddingBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#22c55e",
    textAlign: "right",
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 4,
  },
  dateText: {
    fontSize: 9,
    textAlign: "right",
    color: "#6b7280",
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row-reverse",
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: 700,
    textAlign: "right",
    width: 140,
  },
  detailValue: {
    fontSize: 10,
    textAlign: "right",
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: "right",
    marginTop: 16,
    marginBottom: 6,
    color: "#22c55e",
  },
  sectionTitleAmber: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: "right",
    marginTop: 16,
    marginBottom: 6,
    color: "#d97706",
  },
  sectionTitleIndigo: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: "right",
    marginTop: 16,
    marginBottom: 6,
    color: "#4f46e5",
  },
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: "#f3f4f6",
    paddingVertical: 6,
    paddingHorizontal: 5,
    borderBottom: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableRow: {
    flexDirection: "row-reverse",
    borderBottom: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  tableCell: {
    flex: 1,
    textAlign: "right",
    fontSize: 8,
  },
  tableCellHeader: {
    flex: 1,
    textAlign: "right",
    fontSize: 8,
    fontWeight: 700,
  },
  bulletItem: {
    flexDirection: "row-reverse",
    marginBottom: 3,
    paddingRight: 10,
  },
  bulletDot: {
    fontSize: 8,
    marginLeft: 5,
    color: "#6b7280",
  },
  bulletText: {
    fontSize: 9,
    textAlign: "right",
    flex: 1,
  },
  chartImage: {
    width: "100%",
    marginVertical: 8,
  },
  summaryText: {
    fontSize: 10,
    textAlign: "right",
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
});

const METRIC_KEYS: (keyof PlayerAssessment)[] = [
  "sprint_5m", "sprint_10m", "sprint_20m",
  "jump_2leg_height", "jump_2leg_distance", "jump_right_leg", "jump_left_leg",
  "blaze_spot_time", "kick_power_kaiser",
  "flexibility_ankle", "flexibility_knee", "flexibility_hip",
  "coordination", "body_structure", "leg_power_technique",
];

export interface PlayerReportPdfDocumentProps {
  playerName: string;
  details: {
    birthdate: string | null;
    position: string | null;
    club: string | null;
    registrationDate: string;
    weeklyAttendance: string;
  };
  assessments: readonly PlayerAssessment[];
  radarChartImage: string | null;
  trendsChartImage: string | null;
  strengths: string[];
  weaknesses: string[];
  socialSkills: string[];
  summary: string;
  generatedAt: string;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletItem}>
          <Text style={styles.bulletDot}>{"•"}</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function PlayerReportPdfDocument({
  playerName,
  details,
  assessments,
  radarChartImage,
  trendsChartImage,
  strengths,
  weaknesses,
  socialSkills,
  summary,
  generatedAt,
}: PlayerReportPdfDocumentProps) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString("he-IL");
  const recent = assessments.slice(0, 2);

  return (
    <Document>
      {/* Page 1: Details + Assessments */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>סיכום פעילות שחקן</Text>
            <Text style={styles.subtitle}>Garden of Eden</Text>
          </View>
        </View>

        <Text style={styles.dateText}>
          תאריך הסיכום: {generatedAt}
        </Text>

        <DetailRow label="שם השחקן" value={playerName} />
        {details.birthdate && (
          <DetailRow label="תאריך לידה" value={formatDate(details.birthdate)} />
        )}
        {details.position && (
          <DetailRow label="עמדה" value={details.position} />
        )}
        {details.club && (
          <DetailRow label="מועדון / קבוצה" value={details.club} />
        )}
        <DetailRow label="תאריך הצטרפות" value={formatDate(details.registrationDate)} />
        <DetailRow label="תדירות הגעה בממוצע" value={details.weeklyAttendance} />

        {recent.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>מבדקים גופניים</Text>
            {/* Table header */}
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellHeader}>מדד</Text>
              {recent.map((a) => (
                <Text key={a.id} style={styles.tableCellHeader}>
                  {formatDate(a.assessment_date)}
                </Text>
              ))}
            </View>
            {/* Table rows */}
            {METRIC_KEYS.map((key) => (
              <View key={key} style={styles.tableRow}>
                <Text style={styles.tableCell}>
                  {ASSESSMENT_LABELS_HE[key] ?? key}
                </Text>
                {recent.map((a) => (
                  <Text key={a.id} style={styles.tableCell}>
                    {String((a[key] as string | number | null) ?? "---")}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer}>Garden of Eden | {generatedAt}</Text>
      </Page>

      {/* Page 2: Charts + Strengths + Weaknesses */}
      <Page size="A4" style={styles.page}>
        {/* @react-pdf/renderer Image doesn't support alt prop */}
        {/* eslint-disable jsx-a11y/alt-text */}
        {radarChartImage && (
          <Image src={radarChartImage} style={styles.chartImage} />
        )}
        {trendsChartImage && (
          <Image src={trendsChartImage} style={styles.chartImage} />
        )}
        {/* eslint-enable jsx-a11y/alt-text */}

        {strengths.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>נקודות חוזקה / פרמטרים ששופרו</Text>
            <BulletList items={strengths} />
          </>
        )}

        {weaknesses.length > 0 && (
          <>
            <Text style={styles.sectionTitleAmber}>מיקוד לשיפור בהמשך התהליך</Text>
            <BulletList items={weaknesses} />
          </>
        )}

        <Text style={styles.footer}>Garden of Eden | {generatedAt}</Text>
      </Page>

      {/* Page 3: Social Skills + Summary (conditional) */}
      {(socialSkills.length > 0 || summary) && (
        <Page size="A4" style={styles.page}>
          {socialSkills.length > 0 && (
            <>
              <Text style={styles.sectionTitleIndigo}>כישורים חברתיים</Text>
              <BulletList items={socialSkills} />
            </>
          )}

          {summary && (
            <>
              <Text style={styles.sectionTitle}>סיכום / הערות נוספות</Text>
              <Text style={styles.summaryText}>{summary}</Text>
            </>
          )}

          <Text style={styles.footer}>Garden of Eden | {generatedAt}</Text>
        </Page>
      )}
    </Document>
  );
}
