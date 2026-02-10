import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { PlayerAssessment } from "@/types/assessment";

// Register Hebrew font - use absolute URL for client-side loading
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
    flexDirection: "row-reverse", // RTL
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: "#22c55e", // Brand green
    paddingBottom: 15,
  },
  headerText: {
    textAlign: "right",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#22c55e",
    textAlign: "right",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 4,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: "right",
    marginBottom: 20,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row-reverse", // RTL
    backgroundColor: "#f3f4f6",
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderBottom: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableRow: {
    flexDirection: "row-reverse", // RTL
    borderBottom: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 6,
    paddingHorizontal: 5,
  },
  tableCell: {
    flex: 1,
    textAlign: "right",
    fontSize: 9,
  },
  tableCellHeader: {
    flex: 1,
    textAlign: "right",
    fontSize: 9,
    fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: "right",
    marginTop: 15,
    marginBottom: 5,
    color: "#22c55e",
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

interface AssessmentPdfDocumentProps {
  playerName: string;
  assessments: PlayerAssessment[];
  generatedAt: string;
}

export function AssessmentPdfDocument({
  playerName,
  assessments,
  generatedAt,
}: AssessmentPdfDocumentProps) {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("he-IL");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>דוח מבדקים</Text>
            <Text style={styles.subtitle}>Garden of Eden</Text>
          </View>
        </View>

        {/* Player name */}
        <Text style={styles.playerName}>{playerName}</Text>

        {/* Sprint section */}
        <Text style={styles.sectionTitle}>מבדקי ספרינט</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellHeader}>תאריך</Text>
            <Text style={styles.tableCellHeader}>5 מטר</Text>
            <Text style={styles.tableCellHeader}>10 מטר</Text>
            <Text style={styles.tableCellHeader}>20 מטר</Text>
          </View>
          {assessments.map((a) => (
            <View key={a.id} style={styles.tableRow}>
              <Text style={styles.tableCell}>{formatDate(a.assessment_date)}</Text>
              <Text style={styles.tableCell}>{a.sprint_5m ?? "---"}</Text>
              <Text style={styles.tableCell}>{a.sprint_10m ?? "---"}</Text>
              <Text style={styles.tableCell}>{a.sprint_20m ?? "---"}</Text>
            </View>
          ))}
        </View>

        {/* Jump section */}
        <Text style={styles.sectionTitle}>מבדקי ניתור</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellHeader}>תאריך</Text>
            <Text style={styles.tableCellHeader}>קפיצה לאורך</Text>
            <Text style={styles.tableCellHeader}>קפיצה לגובה</Text>
            <Text style={styles.tableCellHeader}>רגל ימין</Text>
            <Text style={styles.tableCellHeader}>רגל שמאל</Text>
          </View>
          {assessments.map((a) => (
            <View key={a.id} style={styles.tableRow}>
              <Text style={styles.tableCell}>{formatDate(a.assessment_date)}</Text>
              <Text style={styles.tableCell}>{a.jump_2leg_distance ?? "---"}</Text>
              <Text style={styles.tableCell}>{a.jump_2leg_height ?? "---"}</Text>
              <Text style={styles.tableCell}>{a.jump_right_leg ?? "---"}</Text>
              <Text style={styles.tableCell}>{a.jump_left_leg ?? "---"}</Text>
            </View>
          ))}
        </View>

        {/* Agility & Power section */}
        <Text style={styles.sectionTitle}>זריזות וכוח</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellHeader}>תאריך</Text>
            <Text style={styles.tableCellHeader}>בלייז ספוט (פגיעות)</Text>
            <Text style={styles.tableCellHeader}>כוח בעיטה</Text>
          </View>
          {assessments.map((a) => (
            <View key={a.id} style={styles.tableRow}>
              <Text style={styles.tableCell}>{formatDate(a.assessment_date)}</Text>
              <Text style={styles.tableCell}>{a.blaze_spot_time ?? "---"}</Text>
              <Text style={styles.tableCell}>{a.kick_power_kaiser ?? "---"}</Text>
            </View>
          ))}
        </View>

        {/* Flexibility section */}
        <Text style={styles.sectionTitle}>גמישות</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellHeader}>תאריך</Text>
            <Text style={styles.tableCellHeader}>קרסול</Text>
            <Text style={styles.tableCellHeader}>ברך</Text>
            <Text style={styles.tableCellHeader}>אגן</Text>
          </View>
          {assessments.map((a) => (
            <View key={a.id} style={styles.tableRow}>
              <Text style={styles.tableCell}>{formatDate(a.assessment_date)}</Text>
              <Text style={styles.tableCell}>{a.flexibility_ankle ?? "---"}</Text>
              <Text style={styles.tableCell}>{a.flexibility_knee ?? "---"}</Text>
              <Text style={styles.tableCell}>{a.flexibility_hip ?? "---"}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          נוצר ב-{generatedAt} | Garden of Eden
        </Text>
      </Page>
    </Document>
  );
}
