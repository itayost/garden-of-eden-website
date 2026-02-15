"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Send,
  ScrollText,
  Trash2,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { LeadContactLogForm } from "./LeadContactLogForm";
import { LeadContactTimeline } from "./LeadContactTimeline";
import { LeadCloseDealDialog } from "./LeadCloseDealDialog";
import { leadUpdateSchema, type LeadUpdateInput } from "@/lib/validations/leads";
import {
  getLeadByIdAction,
  updateLeadAction,
  updateLeadStatusAction,
  deleteLeadAction,
  sendWhatsAppFlowAction,
  sendWhatsAppTextAction,
} from "@/lib/actions/admin-leads";
import {
  AGE_GROUPS,
  TEAMS,
  FREQUENCY_OPTIONS,
} from "@/lib/whatsapp/flow-constants";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_MESSAGE_TYPE_LABELS,
  type Lead,
  type LeadStatus,
  type LeadContactLog,
  type LeadSentMessage,
  type LeadFlowResponse,
} from "@/types/leads";

// Build lookup maps from flow-constants arrays
const AGE_GROUP_MAP = Object.fromEntries(AGE_GROUPS.map((g) => [g.id, g.title]));
const TEAM_MAP = Object.fromEntries(TEAMS.map((t) => [t.id, t.title]));
const FREQUENCY_MAP = Object.fromEntries(FREQUENCY_OPTIONS.map((f) => [f.id, f.title]));

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatPhone(phone: string): string {
  if (phone.startsWith("972")) {
    const local = "0" + phone.slice(3);
    return local.slice(0, 3) + "-" + local.slice(3);
  }
  return phone;
}

export function LeadDetailSheet({ lead, open, onOpenChange }: LeadDetailSheetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<LeadStatus | null>(null);
  const [waLoading, setWaLoading] = useState<string | null>(null);
  const [textMessage, setTextMessage] = useState("");
  const [contactLog, setContactLog] = useState<LeadContactLog[]>([]);
  const [sentMessages, setSentMessages] = useState<LeadSentMessage[]>([]);
  const [flowResponses, setFlowResponses] = useState<LeadFlowResponse[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [closeDealOpen, setCloseDealOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadUpdateInput>({
    resolver: zodResolver(leadUpdateSchema),
  });

  const currentStatus = watch("status");
  const isFromHaifa = watch("is_from_haifa");

  const loadDetails = useCallback(async (leadId: string) => {
    setDetailLoading(true);
    try {
      const result = await getLeadByIdAction(leadId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const detail = result.data;
      setContactLog(detail.contactLog);
      setSentMessages(detail.sentMessages);
      setFlowResponses(detail.flowResponses);

      // Update form with latest data
      const l = detail.lead;
      reset({
        id: l.id,
        name: l.name,
        phone: l.phone,
        status: l.status,
        is_from_haifa: l.is_from_haifa,
        note: l.note || "",
        payment: l.payment,
        months: l.months,
        total_payment: l.total_payment,
      });
    } catch {
      toast.error("שגיאה בטעינת פרטי ליד");
    } finally {
      setDetailLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    if (open && lead) {
      // Set initial form values from the lead prop
      reset({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        is_from_haifa: lead.is_from_haifa,
        note: lead.note || "",
        payment: lead.payment,
        months: lead.months,
        total_payment: lead.total_payment,
      });
      loadDetails(lead.id);
    }
  }, [open, lead, reset, loadDetails]);

  const onSubmit = async (data: LeadUpdateInput) => {
    setLoading(true);
    try {
      const result = await updateLeadAction(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("ליד עודכן בהצלחה");
      router.refresh();
    } catch {
      toast.error("שגיאה בעדכון ליד");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead) return;
    setStatusLoading(newStatus);
    try {
      const result = await updateLeadStatusAction(lead.id, newStatus);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setValue("status", newStatus);
      toast.success(`סטטוס עודכן ל${LEAD_STATUS_LABELS[newStatus]}`);
      router.refresh();
    } catch {
      toast.error("שגיאה בעדכון סטטוס");
    } finally {
      setStatusLoading(null);
    }
  };

  const handleWhatsAppFlow = async () => {
    if (!lead) return;
    setWaLoading("flow");
    try {
      const result = await sendWhatsAppFlowAction(lead.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("פלואו WhatsApp נשלח");
      loadDetails(lead.id);
    } catch {
      toast.error("שגיאה בשליחה");
    } finally {
      setWaLoading(null);
    }
  };

  const handleWhatsAppText = async () => {
    if (!lead || !textMessage.trim()) return;
    setWaLoading("text");
    try {
      const result = await sendWhatsAppTextAction(lead.id, textMessage);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הודעת WhatsApp נשלחה");
      setTextMessage("");
      loadDetails(lead.id);
    } catch {
      toast.error("שגיאה בשליחה");
    } finally {
      setWaLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!lead) return { error: "לא נבחר ליד" } as const;
    return deleteLeadAction(lead.id);
  };

  const handleDeleteSuccess = () => {
    onOpenChange(false);
    router.refresh();
  };

  const handleContactLogSuccess = () => {
    if (lead) loadDetails(lead.id);
  };

  const handleCloseDealSuccess = () => {
    if (lead) loadDetails(lead.id);
  };

  if (!lead) return null;

  const statuses: LeadStatus[] = [
    "new",
    "callback",
    "in_progress",
    "closed",
    "disqualified",
  ];

  const hasFlowData = lead.flow_age_group !== null;
  const isClosed = currentStatus === "closed" || lead.status === "closed";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {lead.name}
            <LeadStatusBadge status={lead.status} />
            {lead.is_from_haifa && (
              <Badge variant="outline" className="bg-purple-100 text-purple-800">
                חיפה
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            <span dir="ltr">{formatPhone(lead.phone)}</span>
            {" · "}
            נוצר {new Date(lead.created_at).toLocaleDateString("he-IL")}
          </SheetDescription>
        </SheetHeader>

        {detailLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 px-4 pb-8">
            {/* Close Deal Button — hidden when already closed */}
            {!isClosed && (
              <Button
                onClick={() => setCloseDealOpen(true)}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                <Target className="h-4 w-4 ml-2" />
                סגירת עסקה
              </Button>
            )}

            {/* Flow Data Summary */}
            {hasFlowData && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="text-sm font-medium">נתוני Flow</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">גיל: </span>
                    {AGE_GROUP_MAP[lead.flow_age_group!] || lead.flow_age_group}
                  </div>
                  {lead.flow_team && (
                    <div>
                      <span className="text-muted-foreground">קבוצה: </span>
                      {TEAM_MAP[lead.flow_team] || lead.flow_team}
                    </div>
                  )}
                  {lead.flow_frequency && (
                    <div>
                      <span className="text-muted-foreground">תדירות: </span>
                      {FREQUENCY_MAP[lead.flow_frequency] || lead.flow_frequency}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Status Change */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">שינוי סטטוס מהיר</Label>
              <div className="flex flex-wrap gap-2">
                {statuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={statusLoading !== null || currentStatus === s}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-opacity ${LEAD_STATUS_COLORS[s]} ${currentStatus === s ? "ring-2 ring-offset-1 ring-gray-400" : "opacity-60 hover:opacity-100"} disabled:cursor-not-allowed`}
                  >
                    {statusLoading === s ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      LEAD_STATUS_LABELS[s]
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Edit Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <input type="hidden" {...register("id")} />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">שם</Label>
                  <Input {...register("name")} />
                  {errors.name && (
                    <p className="text-xs text-destructive">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">טלפון</Label>
                  <Input dir="ltr" {...register("phone")} />
                  {errors.phone && (
                    <p className="text-xs text-destructive">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">סטטוס</Label>
                  <Select
                    value={currentStatus || lead.status}
                    onValueChange={(v) =>
                      setValue("status", v as LeadStatus, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(LEAD_STATUS_LABELS) as [
                          LeadStatus,
                          string,
                        ][]
                      ).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex items-end">
                  <div className="flex items-center gap-2 pb-2">
                    <Checkbox
                      id="edit-haifa"
                      checked={isFromHaifa ?? lead.is_from_haifa}
                      onCheckedChange={(checked) =>
                        setValue("is_from_haifa", checked === true)
                      }
                    />
                    <Label htmlFor="edit-haifa" className="text-sm cursor-pointer">
                      מחיפה
                    </Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">תשלום</Label>
                  <Input
                    type="number"
                    {...register("payment", {
                      setValueAs: (v: string) => v === "" ? null : Number(v),
                    })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">חודשים</Label>
                  <Input
                    type="number"
                    {...register("months", {
                      setValueAs: (v: string) => v === "" ? null : Number(v),
                    })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">סה״כ</Label>
                  <Input
                    type="number"
                    {...register("total_payment", {
                      setValueAs: (v: string) => v === "" ? null : Number(v),
                    })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">הערה</Label>
                <Textarea rows={2} {...register("note")} />
              </div>

              <Button type="submit" size="sm" disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                שמור שינויים
              </Button>
            </form>

            <Separator />

            {/* WhatsApp Actions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">פעולות WhatsApp</Label>
              <div className="flex flex-wrap gap-2">
                {!hasFlowData && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleWhatsAppFlow}
                    disabled={waLoading !== null}
                  >
                    {waLoading === "flow" ? (
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    ) : (
                      <ScrollText className="h-4 w-4 ml-2" />
                    )}
                    שלח תבנית פלואו
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={textMessage}
                  onChange={(e) => setTextMessage(e.target.value)}
                  placeholder="הודעה חופשית..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleWhatsAppText}
                  disabled={waLoading !== null || !textMessage.trim()}
                >
                  {waLoading === "text" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Contact Log */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">יומן יצירת קשר</Label>
              <LeadContactLogForm
                leadId={lead.id}
                onSuccess={handleContactLogSuccess}
              />
              <LeadContactTimeline entries={contactLog} />
            </div>

            {/* Sent Messages */}
            {sentMessages.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">הודעות שנשלחו</Label>
                  <div className="space-y-2">
                    {sentMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="flex items-center justify-between p-2 rounded border text-sm"
                      >
                        <Badge variant="outline">
                          {LEAD_MESSAGE_TYPE_LABELS[msg.message_type]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.sent_at).toLocaleDateString("he-IL", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Flow Responses */}
            {flowResponses.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">תגובות פלואו</Label>
                  <div className="space-y-2">
                    {flowResponses.map((fr) => (
                      <div
                        key={fr.id}
                        className="p-2 rounded border text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">
                            {fr.screen || "לא ידוע"}
                          </span>
                          <Badge variant={fr.is_complete ? "default" : "outline"}>
                            {fr.is_complete ? "הושלם" : "חלקי"}
                          </Badge>
                        </div>
                        {fr.data && (
                          <pre
                            dir="ltr"
                            className="text-xs bg-muted p-2 rounded overflow-x-auto"
                          >
                            {JSON.stringify(fr.data, null, 2)}
                          </pre>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(fr.created_at).toLocaleDateString("he-IL", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Delete */}
            <DeleteConfirmDialog
              title="מחיקת ליד"
              description={
                <span>
                  האם למחוק את הליד <strong>{lead.name}</strong>? כל הנתונים
                  הקשורים (יומן קשר, הודעות) יימחקו לצמיתות.
                </span>
              }
              successMessage="ליד נמחק בהצלחה"
              errorMessage="שגיאה במחיקת ליד"
              onDelete={handleDelete}
              onSuccess={handleDeleteSuccess}
              trigger={
                <Button variant="destructive" size="sm" className="w-full">
                  <Trash2 className="h-4 w-4 ml-2" />
                  מחק ליד
                </Button>
              }
            />
          </div>
        )}
      </SheetContent>

      {/* Close Deal Dialog */}
      <LeadCloseDealDialog
        lead={lead}
        open={closeDealOpen}
        onOpenChange={setCloseDealOpen}
        onSuccess={handleCloseDealSuccess}
      />
    </Sheet>
  );
}
