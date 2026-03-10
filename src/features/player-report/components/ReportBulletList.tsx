"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";

export interface BulletItem {
  readonly id: string;
  readonly text: string;
}

interface ReportBulletListProps {
  title: string;
  items: readonly BulletItem[];
  onChange: (items: readonly BulletItem[]) => void;
  emptyMessage?: string;
  headerClassName?: string;
  testIdPrefix?: string;
}

export function ReportBulletList({
  title,
  items,
  onChange,
  emptyMessage = "אין נתונים לתקופה זו",
  headerClassName,
  testIdPrefix,
}: ReportBulletListProps) {
  const [newText, setNewText] = useState("");

  const handleAdd = () => {
    if (!newText.trim()) return;
    const newItem: BulletItem = {
      id: crypto.randomUUID(),
      text: newText.trim(),
    };
    onChange([...items, newItem]);
    setNewText("");
  };

  const handleRemove = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleEdit = (id: string, text: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, text } : item)));
  };

  return (
    <Card data-testid={testIdPrefix ? `bullet-section-${testIdPrefix}` : undefined}>
      <CardHeader>
        <CardTitle className={headerClassName}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        )}
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
              <Input
                value={item.text}
                onChange={(e) => handleEdit(item.id, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(item.id)}
                className="shrink-0"
                aria-label="הסר פריט"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="הוסף פריט..."
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            data-testid={testIdPrefix ? `${testIdPrefix}-add-input` : "bullet-add-input"}
          />
          <Button variant="outline" size="icon" onClick={handleAdd} aria-label="הוסף פריט" data-testid={testIdPrefix ? `${testIdPrefix}-add-button` : "bullet-add-button"}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
