import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import {
  buildPlayerReportHtml,
  loadStaticAssets,
} from "@/lib/exports/player-report-html";
import { playerReportPdfBodySchema } from "./schema";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function fetchAvatarAsBase64(url: string | null): Promise<string | null> {
  if (!url) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || !url.startsWith(supabaseUrl)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const b64 = Buffer.from(buffer).toString("base64");
    const rawCt = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const ct = ALLOWED_AVATAR_TYPES.includes(rawCt) ? rawCt : "image/jpeg";
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await verifyAdminOrTrainer();
  if (authResult.error || !authResult.user) {
    return NextResponse.json({ error: "נדרשת הרשאת מנהל או מאמן" }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const identifier = getRateLimitIdentifier(authResult.user.id, ip);
  const rateLimitResult = await checkRateLimit(identifier, "general");
  if (rateLimitResult.rateLimited) {
    return NextResponse.json({ error: "יותר מדי בקשות, נסה שוב מאוחר יותר" }, { status: 429 });
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין" }, { status: 400 });
  }

  const parsed = playerReportPdfBodySchema.safeParse(bodyRaw);
  if (!parsed.success) {
    console.error("[player-report/pdf] invalid body", parsed.error.flatten());
    return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
  }

  const data = parsed.data;

  let pdf: Buffer;
  let browser: Awaited<ReturnType<typeof import("puppeteer-core").default.launch>> | undefined;

  try {
    // loadStaticAssets is synchronous (readFileSync); call it directly before the async avatar fetch
    const assets = loadStaticAssets();
    const avatarDataUri = await fetchAvatarAsBase64(data.profile.processed_avatar_url);

    const html = buildPlayerReportHtml(
      {
        profile: data.profile,
        assessments: data.assessments,
        stats: data.stats,
        attendance: data.attendance,
        summary: data.summary,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        socialSkills: data.socialSkills,
        avatarDataUri,
      },
      assets,
    );

    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);

    // Required for serverless environments (no GPU / display server)
    chromium.setGraphicsMode = false;

    const executablePath =
      process.env.LOCAL_CHROME_PATH ?? (await chromium.executablePath());

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123 },
      executablePath,
      headless: "shell",
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle2", timeout: 15000 });
    // Buffer.from() normalises Uint8Array (puppeteer-core v21+) and Buffer equally
    pdf = Buffer.from(await page.pdf({ format: "A4", printBackground: true }));
  } catch (err) {
    console.error("[player-report/pdf]", err);
    return NextResponse.json({ error: "שגיאה ביצירת ה-PDF" }, { status: 500 });
  } finally {
    await browser?.close();
  }

  const playerName = data.profile.full_name ?? "שחקן";
  const date = new Date().toISOString().split("T")[0];
  const encodedFilename = encodeURIComponent(`סיכום-שחקן-${playerName}-${date}.pdf`);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
    },
  });
}
