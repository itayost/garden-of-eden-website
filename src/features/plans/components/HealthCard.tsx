"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartPulse, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toLocalPhone as local } from "@/lib/plans/local-phone";
import { updateTraineeHealthAction, type TraineeHealth } from "../lib/actions/trainee-health";


export function HealthCard({ traineeId, health }: { traineeId: string; health: TraineeHealth }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [medical, setMedical] = useState(health.medicalNotes ?? "");
  const [name, setName] = useState(health.emergencyContactName ?? "");
  const [phone, setPhone] = useState(local(health.emergencyContactPhone));

  const save = () =>
    startTransition(async () => {
      const result = await updateTraineeHealthAction({
        traineeId,
        medicalNotes: medical,
        emergencyContactName: name,
        emergencyContactPhone: phone,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("נשמר");
      setEditing(false);
      router.refresh();
    });

  return (
    <Card className={health.medicalNotes ? "border-amber-500/60" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="h-4 w-4" />
          בריאות וחירום
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {editing ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="h-medical">מגבלות רפואיות</Label>
              <Textarea id="h-medical" rows={2} value={medical} onChange={(e) => setMedical(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="h-name">איש קשר לחירום</Label>
              <Input id="h-name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="h-phone">טלפון לחירום</Label>
              <Input id="h-phone" dir="ltr" className="text-right" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={pending} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="h-3 w-3 me-1 animate-spin" /> : null}
                שמירה
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                ביטול
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-muted-foreground">מגבלות רפואיות</div>
              <div className={health.medicalNotes ? "font-medium text-amber-700" : ""}>
                {health.medicalNotes ?? "אין"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">איש קשר לחירום</div>
              {health.emergencyContactPhone ? (
                <a href={`tel:${health.emergencyContactPhone}`} className="inline-flex items-center gap-1 font-medium underline">
                  <Phone className="h-3 w-3" />
                  {health.emergencyContactName} · {local(health.emergencyContactPhone)}
                </a>
              ) : (
                <div>לא צוין</div>
              )}
            </div>
            {health.guardianPhone && (
              <div>
                <div className="text-muted-foreground">הורה משלם</div>
                <a href={`tel:${health.guardianPhone}`} className="inline-flex items-center gap-1 underline">
                  <Phone className="h-3 w-3" />
                  {health.guardianName} · {local(health.guardianPhone)}
                </a>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              עריכה
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
