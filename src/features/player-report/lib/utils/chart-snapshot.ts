import { toPng } from "html-to-image";

export async function captureChartAsImage(
  element: HTMLElement | null,
  backgroundColor: string | undefined = "#ffffff",
): Promise<string | null> {
  if (!element) return null;

  try {
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor,
    });
    return dataUrl;
  } catch {
    return null;
  }
}
