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

      {/*
        The sticker is a physical brand artifact — dozens will hang on
        machines in the studio. Forest frame, wordmark, display-face name,
        grass-to-gold accent strip.
      */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-3">
        {equipment.map((item) => (
          <div
            key={item.id}
            className="flex break-inside-avoid flex-col items-center rounded-2xl border-4 border-forest bg-white p-4 text-center [print-color-adjust:exact]"
          >
            <p className="text-[10px] font-semibold tracking-[0.28em] text-forest">
              GARDEN OF EDEN
            </p>
            <p className="font-display mb-2 mt-1 text-2xl leading-tight text-forest">
              {item.name_he}
            </p>
            {dataUrls[item.id] ? (
              // Plain img: QR data URLs gain nothing from next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrls[item.id]}
                alt={`QR עבור ${item.name_he}`}
                className="h-32 w-32"
              />
            ) : (
              <div className="h-32 w-32 animate-pulse rounded bg-muted" />
            )}
            <p className="mt-2 text-xs text-stone-600">
              סרקו אחרי התרגיל ורשמו מה עשיתם
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-gradient-to-l from-grass to-gold" />
          </div>
        ))}
      </div>
    </div>
  );
}
