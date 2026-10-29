import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SurveyCsvButton } from "../SurveyCsvButton";

// Only the toasts, and the browser's download plumbing (a link click and an object URL) are stubbed.
const success = vi.fn();
const error = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (m: string) => success(m), error: (m: string) => error(m) } }));

const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:survey");
const revokeObjectURL = vi.fn();
let clicked: { download: string; href: string }[] = [];

beforeEach(() => {
  clicked = [];
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

/** The bytes a spreadsheet would read. */
function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("SurveyCsvButton", () => {
  const rows = [
    { "שם": "יונתן לוי", "שנתון": "2014", "1. כמה נהנית?": "5" },
    { "שם": "'=cmd()", "שנתון": "2015", "1. כמה נהנית?": "4" },
  ];

  test("is off when there is nothing to export", () => {
    render(<SurveyCsvButton rows={[]} fileName="survey-2026-10-29.csv" />);
    expect(screen.getByRole("button", { name: "CSV" })).toBeDisabled();
  });

  test("downloads the file under the given name and says how many Responses went", () => {
    render(<SurveyCsvButton rows={rows} fileName="survey-2026-10-29.csv" />);
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));

    expect(clicked).toEqual([{ download: "survey-2026-10-29.csv", href: "blob:survey" }]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:survey");
    expect(success).toHaveBeenCalledWith("יוצאו 2 תשובות");
    expect(error).not.toHaveBeenCalled();
  });

  test("the file is UTF-8 CSV behind a byte order mark, and neutralised cells are written as they are", async () => {
    render(<SurveyCsvButton rows={rows} fileName="survey-2026-10-29.csv" />);
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));

    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/csv;charset=utf-8;");
    const bytes = await blobBytes(blob);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8").decode(bytes);
    expect(text).toContain("שם,שנתון,1. כמה נהנית?");
    expect(text).toContain("'=cmd(),2015,4");
    expect(text).not.toContain("''=cmd()");
  });

  test("one Response reads in the singular", () => {
    render(<SurveyCsvButton rows={rows.slice(0, 1)} fileName="survey-2026-10-29.csv" />);
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    expect(success).toHaveBeenCalledWith("יוצאה תשובה אחת");
  });
});
