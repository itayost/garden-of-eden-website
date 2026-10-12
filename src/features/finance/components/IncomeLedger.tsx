import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IncomeReport } from "../lib/income";
import { ArboxTable, PaymentsTable, RefundsTable } from "./IncomeTables";

export function IncomeLedger({ report }: { report: IncomeReport }) {
  const multiDay = report.from !== report.to;
  return (
    <section aria-label="פירוט" className="min-w-0 rounded-xl border bg-card">
      <Tabs defaultValue="payments" dir="rtl">
        <TabsList className="m-3">
          <TabsTrigger value="payments">תשלומים ({report.paymentCount})</TabsTrigger>
          <TabsTrigger value="refunds">החזרים ({report.refundRows.length})</TabsTrigger>
          <TabsTrigger value="arbox">Arbox ({report.arbox.entries.length}) · מחוץ לסכום</TabsTrigger>
        </TabsList>
        <TabsContent value="payments">
          <PaymentsTable payments={report.payments} multiDay={multiDay} />
        </TabsContent>
        <TabsContent value="refunds">
          <RefundsTable refunds={report.refundRows} multiDay={multiDay} />
        </TabsContent>
        <TabsContent value="arbox">
          <ArboxTable entries={report.arbox.entries} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
