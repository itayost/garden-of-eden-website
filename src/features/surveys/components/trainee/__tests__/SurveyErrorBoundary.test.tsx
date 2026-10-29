import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { SurveyErrorBoundary } from "../SurveyErrorBoundary";

// Nothing is mocked except the console, which React and the boundary write to.
afterEach(cleanup);

function Broken(): never {
  throw new Error("popup exploded");
}

describe("SurveyErrorBoundary", () => {
  test("shows its children when nothing throws", () => {
    render(
      <SurveyErrorBoundary>
        <p>הסקר</p>
      </SurveyErrorBoundary>,
    );
    expect(screen.getByText("הסקר")).toBeTruthy();
  });

  test("renders nothing, beside the rest of the page, when a child throws", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      render(
        <main>
          <p>שאר העמוד</p>
          <SurveyErrorBoundary>
            <Broken />
          </SurveyErrorBoundary>
        </main>,
      );
      expect(screen.getByText("שאר העמוד")).toBeTruthy();
      expect(screen.getByRole("main").children).toHaveLength(1);
    } finally {
      log.mockRestore();
    }
  });

  test("logs the failure with the surveys prefix", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      render(
        <SurveyErrorBoundary>
          <Broken />
        </SurveyErrorBoundary>,
      );
      expect(log).toHaveBeenCalledWith("[surveys] render failed:", "popup exploded");
    } finally {
      log.mockRestore();
    }
  });
});
