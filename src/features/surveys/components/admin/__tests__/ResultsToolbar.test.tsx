import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";

import { ResultsToolbar } from "../ResultsToolbar";

// Only the URL is observed (nuqs' own testing adapter); nothing here is mocked.
const COUNTS = { answered: 78, seen: 18, unseen: 214 };
const BRANCHES = [
  { id: "b-ha", nameHe: "חיפה" },
  { id: "b-ka", nameHe: "קריית אתא" },
];

// Radix Select measures and focuses with APIs jsdom does not have.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(cleanup);

function renderToolbar(
  props: { branches?: typeof BRANCHES; birthYears?: number[]; searchParams?: string } = {},
) {
  const updates: UrlUpdateEvent[] = [];
  render(
    <NuqsTestingAdapter searchParams={props.searchParams ?? ""} onUrlUpdate={(event) => updates.push(event)}>
      <ResultsToolbar counts={COUNTS} branches={props.branches ?? BRANCHES} birthYears={props.birthYears ?? [2015, 2014]} />
    </NuqsTestingAdapter>,
  );
  return updates;
}

const lastUpdate = (updates: UrlUpdateEvent[]) => updates[updates.length - 1];

describe("ResultsToolbar: the segments", () => {
  test("show their counts and mark the one in the address", () => {
    renderToolbar({ searchParams: "?segment=seen" });
    expect(screen.getByRole("radio", { name: "ענו 78" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "ראו ולא ענו 18" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "לא ראו 214" })).toHaveAttribute("aria-checked", "false");
  });

  test("answered is the one chosen when the address names none", () => {
    renderToolbar();
    expect(screen.getByRole("radio", { name: "ענו 78" })).toHaveAttribute("aria-checked", "true");
  });

  test("choosing one writes it and goes back to page 1 in the same update", async () => {
    const updates = renderToolbar({ searchParams: "?page=3&q=לוי" });
    fireEvent.click(screen.getByRole("radio", { name: "לא ראו 214" }));

    await waitFor(() => expect(updates.length).toBe(1));
    const { searchParams, options } = lastUpdate(updates);
    expect(searchParams.get("segment")).toBe("unseen");
    expect(searchParams.has("page")).toBe(false);
    expect(searchParams.get("q")).toBe("לוי");
    expect(options.shallow).toBe(false);
  });

  test("choosing answered again leaves the address bare", async () => {
    const updates = renderToolbar({ searchParams: "?segment=seen" });
    fireEvent.click(screen.getByRole("radio", { name: "ענו 78" }));

    await waitFor(() => expect(updates.length).toBe(1));
    expect(lastUpdate(updates).searchParams.has("segment")).toBe(false);
  });
});

describe("ResultsToolbar: the name search", () => {
  test("writes the typed name after a pause, and goes back to page 1", async () => {
    const updates = renderToolbar({ searchParams: "?page=2" });
    fireEvent.change(screen.getByLabelText("חיפוש חניך"), { target: { value: "מאיה" } });
    expect(updates).toHaveLength(0);

    await waitFor(() => expect(updates.length).toBe(1), { timeout: 2000 });
    expect(lastUpdate(updates).searchParams.get("q")).toBe("מאיה");
    expect(lastUpdate(updates).searchParams.has("page")).toBe(false);
  });

  test("an emptied box takes the name out of the address", async () => {
    const updates = renderToolbar({ searchParams: "?q=מאיה" });
    expect(screen.getByLabelText("חיפוש חניך")).toHaveValue("מאיה");
    fireEvent.change(screen.getByLabelText("חיפוש חניך"), { target: { value: "  " } });

    await waitFor(() => expect(updates.length).toBe(1), { timeout: 2000 });
    expect(lastUpdate(updates).searchParams.has("q")).toBe(false);
  });

  test("the box holds no more than the server reads", () => {
    renderToolbar();
    expect(screen.getByLabelText("חיפוש חניך")).toHaveAttribute("maxlength", "60");
  });
});

describe("ResultsToolbar: the filters", () => {
  test("the branch filter is offered when there is more than one branch to choose", () => {
    renderToolbar();
    expect(screen.getByRole("combobox", { name: "סניף" })).toBeTruthy();
  });

  test("one branch, or none, leaves the branch filter out", () => {
    renderToolbar({ branches: [BRANCHES[0]] });
    expect(screen.queryByRole("combobox", { name: "סניף" })).toBeNull();
  });

  test("choosing a branch goes back to page 1 in the same update", async () => {
    const updates = renderToolbar({ searchParams: "?page=4" });
    fireEvent.click(screen.getByRole("combobox", { name: "סניף" }));
    fireEvent.click(await screen.findByRole("option", { name: "חיפה" }));

    await waitFor(() => expect(updates.length).toBe(1));
    expect(lastUpdate(updates).searchParams.get("branch")).toBe("b-ha");
    expect(lastUpdate(updates).searchParams.has("page")).toBe(false);
  });

  test("the year filter lists the years newest first and writes the one chosen", async () => {
    const updates = renderToolbar({ searchParams: "?page=2", birthYears: [2014, 2016, 2015] });
    fireEvent.click(screen.getByRole("combobox", { name: "שנתון" }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["כל השנתונים", "2016", "2015", "2014"]);
    fireEvent.click(options[2]);

    await waitFor(() => expect(updates.length).toBe(1));
    expect(lastUpdate(updates).searchParams.get("year")).toBe("2015");
    expect(lastUpdate(updates).searchParams.has("page")).toBe(false);
  });

  test("nobody with a birth year leaves the year filter out", () => {
    renderToolbar({ birthYears: [] });
    expect(screen.queryByRole("combobox", { name: "שנתון" })).toBeNull();
  });
});
