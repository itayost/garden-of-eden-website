"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2, AlertCircle, CheckCircle, FileText, X } from "lucide-react";
import {
  csvRowSchema,
  normalizeCSVRow,
  type CSVUserRow,
  type CSVValidationResult,
} from "@/lib/validations/user-import";
import { bulkCreateUsersAction, type BulkImportResult } from "@/lib/actions/admin-users";

interface UserImportDialogProps {
  trigger?: React.ReactNode;
}

export function UserImportDialog({ trigger }: UserImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<CSVValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setFile(null);
      setValidation(null);
      setResult(null);
    }
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setValidation(null);

    // Parse and validate CSV
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const valid: CSVUserRow[] = [];
        const errors: CSVValidationResult["errors"] = [];

        results.data.forEach((rawRow, index) => {
          // Normalize column names and role values
          const row = normalizeCSVRow(rawRow as Record<string, string>);

          // Validate with Zod schema
          const parsed = csvRowSchema.safeParse(row);

          if (parsed.success) {
            valid.push(parsed.data);
          } else {
            errors.push({
              row: index + 2, // +2 for header row and 0-based index
              data: row,
              errors: parsed.error.issues.map((i) => i.message),
            });
          }
        });

        setValidation({ valid, errors });
      },
      error: (error) => {
        toast.error(`שגיאה בקריאת הקובץ: ${error.message}`);
      },
    });
  }, []);

  const handleImport = async () => {
    if (!validation?.valid.length) return;

    setImporting(true);
    try {
      const importResult = await bulkCreateUsersAction(validation.valid);
      setResult(importResult);

      if (importResult.created > 0) {
        toast.success(`נוצרו ${importResult.created} משתמשים`);
      }
      if (importResult.errors.length > 0) {
        toast.error(`${importResult.errors.length} שגיאות ביבוא`);
      }
    } catch {
      toast.error("שגיאה ביבוא המשתמשים");
    } finally {
      setImporting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setValidation(null);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Upload className="h-4 w-4 ml-2" />
            יבוא מ-CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>יבוא משתמשים מ-CSV</DialogTitle>
          <DialogDescription>
            העלה קובץ CSV עם עמודות: שם, טלפון, תפקיד (אופציונלי)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Input */}
          {!file ? (
            <div className="space-y-2">
              <Label htmlFor="csv-file">בחר קובץ CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFile}
                disabled={importing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Validation Results */}
          {validation && !result && (
            <div className="space-y-4">
              {/* Valid Rows Summary */}
              {validation.valid.length > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">
                      {validation.valid.length} שורות תקינות מוכנות ליבוא
                    </span>
                  </div>
                </div>
              )}

              {/* Preview Valid Rows */}
              {validation.valid.length > 0 && validation.valid.length <= 10 && (
                <div className="border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-right font-medium">שם</th>
                        <th className="px-3 py-2 text-right font-medium">טלפון</th>
                        <th className="px-3 py-2 text-right font-medium">תפקיד</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.valid.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.phone}</td>
                          <td className="px-3 py-2">
                            {row.role === "admin" ? "מנהל" :
                             row.role === "trainer" ? "מאמן" : "מתאמן"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* More than 10 rows - show count only */}
              {validation.valid.length > 10 && (
                <p className="text-sm text-muted-foreground">
                  מוצגים 10 מתוך {validation.valid.length} שורות תקינות
                </p>
              )}

              {/* Error Rows */}
              {validation.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">
                      {validation.errors.length} שורות לא תקינות (ידולגו)
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                    {validation.errors.map((err) => (
                      <div key={err.row} className="p-2 text-sm">
                        <div className="font-medium text-destructive">
                          שורה {err.row}
                        </div>
                        <div className="text-muted-foreground">
                          {err.data.name || "(ללא שם)"} - {err.data.phone || "(ללא טלפון)"}
                        </div>
                        <ul className="list-disc list-inside text-destructive text-xs mt-1">
                          {err.errors.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Result */}
          {result && (
            <div className="space-y-4">
              {/* Success Summary */}
              {result.created > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">
                      נוצרו {result.created} משתמשים בהצלחה
                    </span>
                  </div>
                </div>
              )}

              {/* Import Errors */}
              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">
                      {result.errors.length} שגיאות ביבוא
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="p-2 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">שורה {err.row}</span>
                          <span className="font-mono text-xs">{err.phone}</span>
                        </div>
                        <div className="text-destructive text-xs">{err.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
          >
            {result ? "סגור" : "ביטול"}
          </Button>
          {validation && !result && validation.valid.length > 0 && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  מייבא...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 ml-2" />
                  יבוא {validation.valid.length} משתמשים
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
