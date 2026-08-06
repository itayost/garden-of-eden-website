"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { equipmentScanUrl, type Equipment } from "@/types/equipment";

interface StickerSheetProps {
  equipment: Equipment[];
}

/**
 * Print-ready QR sticker grid. Each QR encodes /dashboard/scan/<code> — a
 * plain URL the phone's native camera opens; the login flow round-trips the
 * deep link, so no in-app scanner exists.
 */
export function StickerSheet({ equipment }: StickerSheetProps) {
  const [dataUrls, setDataUrls] = useState<Record<string, string>>({});

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      equipment.map(async (item) => {
        const url = await QRCode.toDataURL(
          equipmentScanUrl(baseUrl, item.code),
          // High error correction: stickers in a gym get scratched.
          { errorCorrectionLevel: "H", margin: 1, width: 512 },
        );
        return [item.id, url] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setDataUrls(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [equipment, baseUrl]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">
          {equipment.length} מדבקות. מומלץ נייר מדבקה A4 ולמינציה — סטודיו לא
          סולח לנייר רגיל.
        </p>
        <Button onClick={() => window.print()}>
          <Printer className="me-2 h-4 w-4" />
          הדפסה
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
        {equipment.map((item) => (
          <div
            key={item.id}
            className="flex break-inside-avoid flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center"
          >
            {dataUrls[item.id] ? (
              // Plain img: QR data URLs gain nothing from next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrls[item.id]}
                alt={`QR עבור ${item.name_he}`}
                className="h-36 w-36"
              />
            ) : (
              <div className="h-36 w-36 animate-pulse rounded bg-muted" />
            )}
            <p className="text-lg font-bold">{item.name_he}</p>
            <p className="text-xs text-muted-foreground">
              סרקו אחרי התרגיל ורשמו מה עשיתם
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
