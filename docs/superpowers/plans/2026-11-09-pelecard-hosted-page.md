# Pelecard Hosted Payment Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the site's own card form with Pelecard's Iframe/Redirect 2.0 payment page, embedded in `/join/pay/[orderId]`, so card data never reaches our pages or server.

**Architecture:** The card page's server render calls Pelecard `PaymentGW/init` and renders the returned URL in an `<iframe>`. Pelecard sends the parent's top window to a return route and POSTs a server-side callback; both only carry ids, and a shared `settlePagePayment()` confirms the payment with `GetTransaction` + `ValidateByUniqueKey` before running the existing `completeCardPayment()`. Pure mapping and decision functions live in `src/lib`, I/O in `src/lib/payments/pelecard.ts` and `src/features/enrollment/lib`.

**Tech Stack:** Next.js 16 App Router (server components, route handlers), TypeScript strict, Supabase service role client, Upstash rate limiting, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-pelecard-hosted-page-design.md` (approved 2026-11-09). Pelecard guides: `~/Downloads/iFrame20 - Heb.pdf` (fields pages 10-17, output 37-40, status codes 41-44) and `~/Downloads/API - Heb.pdf` (`GetTransaction` page 18, `ValidateByUniqueKey` page 17).

## Global Constraints

- Card number, CVV, ID never appear in our code path, logs, DB or test fixtures. Masked numbers, `shvaOutput`, `CardHolder*` and `ConfirmationKey` are never stored on the order.
- Nothing is marked paid from redirect parameters or the callback body; only `settlePagePayment()` after `GetTransaction` + `ValidateByUniqueKey`.
- A decline never sets `status = failed`.
- `PELECARD_PASSWORD` only in `server-only` modules.
- One Pelecard base URL for `/services` and `/PaymentGW`: the existing `PELECARD_API_URL` (default `https://gateway21.pelecard.biz`). No new env var.
- Absolute URLs from `process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il"` (same fallback as `notify.ts`).
- Hebrew user-facing text, logical CSS properties, no emojis, immutable updates, files under 800 lines, `isValidUUID()` on every id from a request.
- Tests: pure functions only, written first, no mocks. Run with `npm run test:run -- <path>`.
- No database migration.
- Commit after each task: `feat(payments): ...` / `refactor(payments): ...`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Observed Pelecard behavior (2026-11-09)

- `POST {base}/PaymentGW/init` answers with content type `text/html` and a JSON body: `{"URL":"","ConfirmationKey":"","Error":{"ErrCode":503,"ErrMsg":"Login for user testpelecard3 failed. Locked"}}`. Parse the text, never trust the content type. Success has `ErrCode` 0 and a non-empty `URL`.
- The guide's public sandbox user is locked, so no successful init, `GetTransaction` or callback has been observed. The `GetTransaction` fixture below is the documented example (guide page 9, Services guide page 18); mark it `documented, not observed` in the test file. Replace it with a real one after the first live payment.
- Pelecard's API refuses browser CORS preflights (400 "Illegal query").

## Review Focus

1. Return and callback for the same payment arrive together: exactly one Plan, the second is a no-op (`paidOrderAction` returns `already_done` for the same transaction; the DB claim in `markOrderPaid` breaks the tie).
2. A decline comes back through `ErrorURL` while `GetTransaction` is unreachable: the parent returns to the card page with a reason, the order is not moved to `charging` (`unverifiedOutcome` and `returnRedirect` tests).
3. `init` answers with a URL that is not `https:` on `pelecard.biz`, or with `ErrCode` 0 and an empty URL: no frame, a Hebrew message (`parseInitResponse` tests).
4. The callback body arrives as a form field wrapping JSON, as raw JSON, with lowercased keys, or empty: ids are found or the request is ignored with 200 (`feedbackIds` tests).
5. An order amount with agorot (449.5 ILS) is sent as `Total` "44950" and matched against `DebitTotal` 44950 (`buildInitRequest` and `judgePagePayment` tests).

---

### Task 1: Pelecard page request mapping (pure)

**Files:**
- Create: `src/lib/payments/pelecard-page-mapping.ts`
- Test: `src/lib/payments/__tests__/pelecard-page-mapping.test.ts`

**Interfaces:**
- Consumes: `toAgorot`, `pelecardParamX`, `isRecord`, `normalizeCode` from `./pelecard-mapping` (kept in Task 7).
- Produces:
  - `interface PageCredentials { terminal: string; user: string; password: string }`
  - `interface PageOrder { id: string; amountIls: number; maxInstallments: number }`
  - `buildInitRequest(order: PageOrder, creds: PageCredentials, siteUrl: string): Record<string, string>`
  - `type InitResult = { ok: true; url: string } | { ok: false; reason: string }`
  - `parseInitResponse(text: string): InitResult`
  - `isPelecardPageUrl(url: string): boolean`
  - `declineMessage(code: string | null): string`

- [ ] **Step 1: Write the failing tests**

```ts
describe("buildInitRequest", () => {
  const order = { id: "3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c", amountIls: 449.5, maxInstallments: 3 };
  const body = buildInitRequest(order, { terminal: "t", user: "u", password: "p" }, "https://www.edengarden.co.il");
  it("sends the total in agorot and binds the page to the order", () => {
    expect(body.Total).toBe("44950");
    expect(body.Currency).toBe("1");
    expect(body.ActionType).toBe("J4");
    expect(body.UserKey).toBe(order.id);
    expect(body.ParamX).toBe("3f2b8c1e9a4d4e21b7c");
  });
  it("returns to our site on the top window and calls our webhook", () => {
    expect(body.GoodURL).toBe(`https://www.edengarden.co.il/join/pay/${order.id}/return`);
    expect(body.ErrorURL).toBe(body.GoodURL);
    expect(body.FeedbackOnTop).toBe("True");
    expect(body.FeedbackDataTransferMethod).toBe("GET");
    expect(body.ServerSideGoodFeedbackURL).toBe("https://www.edengarden.co.il/api/webhooks/pelecard");
    expect(body.ServerSideErrorFeedbackURL).toBe(body.ServerSideGoodFeedbackURL);
    expect(body).not.toHaveProperty("CancelURL");
  });
  it("offers regular installments up to the order's cap, never credit", () => {
    expect(body.MaxPayments).toBe("3");
    expect(body.MinPayments).toBe("1");
    expect(body.FirstPayment).toBe("auto");
    expect(Number(body.MinPaymentsForCredit)).toBeGreaterThan(3);
  });
  it("asks for ID and CVV, hides name, email and phone, in Hebrew with our look", () => {
    expect(body).toMatchObject({ Language: "HE", CustomerIdField: "must", Cvv2Field: "must", CardHolderName: "hide", EmailField: "hide", TelField: "hide" });
    expect(body.CssURL).toBe("https://www.edengarden.co.il/pelecard/payment-page.css");
    expect(body.LogoURL).toBe("https://www.edengarden.co.il/logo-transparent.png");
  });
});

describe("parseInitResponse", () => {
  it("reads Pelecard's real refusal (text/html JSON)", () => {
    const text = '{"URL":"","ConfirmationKey":"","Error":{"ErrCode":503,"ErrMsg":"Login for user testpelecard3 failed. Locked"}}';
    expect(parseInitResponse(text)).toEqual({ ok: false, reason: "503: Login for user testpelecard3 failed. Locked" });
  });
  it("accepts ErrCode 0 with a Pelecard https URL", () => {
    const text = '{"URL":"https://gateway21.pelecard.biz/PaymentGW?transactionId=abc","Error":{"ErrCode":0,"ErrMsg":""}}';
    expect(parseInitResponse(text)).toEqual({ ok: true, url: "https://gateway21.pelecard.biz/PaymentGW?transactionId=abc" });
  });
  it("refuses an empty URL, a foreign URL, and text that is not JSON", () => {
    expect(parseInitResponse('{"URL":"","Error":{"ErrCode":0}}').ok).toBe(false);
    expect(parseInitResponse('{"URL":"https://evil.example/pay","Error":{"ErrCode":0}}').ok).toBe(false);
    expect(parseInitResponse("<html>").ok).toBe(false);
  });
});

describe("isPelecardPageUrl", () => {
  it("allows only https on pelecard.biz and its subdomains", () => {
    expect(isPelecardPageUrl("https://gateway20.pelecard.biz/PaymentGW?x=1")).toBe(true);
    expect(isPelecardPageUrl("http://gateway20.pelecard.biz/PaymentGW")).toBe(false);
    expect(isPelecardPageUrl("https://pelecard.biz.evil.example/")).toBe(false);
    expect(isPelecardPageUrl("https://evilpelecard.biz/")).toBe(false);
    expect(isPelecardPageUrl("not a url")).toBe(false);
  });
});

describe("declineMessage", () => {
  it("explains known codes and falls back to a generic decline", () => {
    expect(declineMessage("036")).toContain("תוקף");
    expect(declineMessage("301")).toContain("הזמן");
    expect(declineMessage("123")).toBe(declineMessage(null));
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm run test:run -- src/lib/payments/__tests__/pelecard-page-mapping.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/payments/pelecard-page-mapping.ts`**

Field values exactly as the tests pin them, plus `terminal`, `user`, `password`, `ShopNo` "001". `MinPaymentsForCredit` is `String(MAX_INSTALLMENTS + 1)` (guide page 14: a value above `MaxPayments` blocks credit deals). `parseInitResponse` uses `JSON.parse` in try/catch; `ErrCode` read with `Number()`; reason is `"{code}: {ErrMsg}"` flattened to one line and capped at 200 chars. `isPelecardPageUrl`: `new URL()` in try/catch, `protocol === "https:"` and (`hostname === "pelecard.biz"` or ends with `".pelecard.biz"`). `declineMessage` moves the existing `DECLINE_MESSAGES` and `GENERIC_DECLINE` from `pelecard-mapping.ts` here and adds `"301": "עבר הזמן שמוקצב לדף התשלום. נסו שוב."` and `"555": "התשלום בוטל. אפשר לנסות שוב."`.

- [ ] **Step 4: Run to see them pass**

Run: `npm run test:run -- src/lib/payments/__tests__/pelecard-page-mapping.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (`feat(payments): map Pelecard payment page requests`)

---

### Task 2: Verification mapping (pure)

**Files:**
- Modify: `src/lib/payments/pelecard-page-mapping.ts`
- Test: `src/lib/payments/__tests__/pelecard-page-mapping.test.ts`

**Interfaces:**
- Consumes: Task 1 module; `CardBrand` from `@/lib/payments/card`.
- Produces:
  - `interface PageTransaction { transactionId: string; pelecardId: string | null; shvaResult: string | null; totalAgorot: number | null; currency: string | null; paramX: string; confirmationKey: string | null; approvalNumber: string | null; last4: string | null; brand: CardBrand; installments: number; raw: Record<string, unknown> }`
  - `parsePageTransaction(body: unknown): { ok: true; tx: PageTransaction } | { ok: false; reason: string }`
  - `parseValidateResponse(text: string): "valid" | "invalid" | "error"`
  - `pageCardBrand(brand: unknown, issuer: unknown): CardBrand`
  - `type PageVerdict = { kind: "paid" } | { kind: "needs_validation" } | { kind: "not_paid"; code: string } | { kind: "unknown"; reason: string }`
  - `judgePagePayment(tx: PageTransaction, order: { id: string; amountIls: number }, validation: "valid" | "invalid" | "error" | "not_checked"): PageVerdict`
  - `feedbackIds(input: string | URLSearchParams): { orderId: string | null; transactionId: string | null; statusCode: string | null }`

- [ ] **Step 1: Write the failing tests**

Fixture `DOCUMENTED_TX` (comment: shaped like the documented example, not observed): the `GetTransaction` example from the Services guide page 18, adjusted to this test order, with `StatusCode` "000", `ResultData.TransactionId` "1a111c-1d1f6g-9h8j", `ShvaResult` "000", `AdditionalDetailsParamX` "3f2b8c1e9a4d4e21b7c", `DebitApproveNumber` "0155995", `ConfirmationKey` "51053a8812319fb", `TransactionPelecardId` 103059585, `CreditCardNumber` "45******4580", `CreditCardBrand` "2", `CreditCardCompanyIssuer` "2", `DebitTotal` "44950", `DebitCurrency` "1", `TotalPayments` "0", `CardHolderID` "123456789", `shvaOutput` "0000...".

```ts
describe("parsePageTransaction", () => {
  it("reads the fields we need and stores nothing personal", () => {
    const parsed = parsePageTransaction(DOCUMENTED_TX);
    expect(parsed.ok && parsed.tx).toMatchObject({
      transactionId: "1a111c-1d1f6g-9h8j", pelecardId: "103059585", shvaResult: "000",
      totalAgorot: 44950, currency: "1", paramX: "3f2b8c1e9a4d4e21b7c", approvalNumber: "0155995",
      last4: "4580", brand: "visa", installments: 1,
    });
    const raw = parsed.ok ? parsed.tx.raw : {};
    for (const key of ["CreditCardNumber", "CardHolderID", "shvaOutput", "ConfirmationKey"]) expect(raw).not.toHaveProperty(key);
  });
  it("fails on a non-000 StatusCode without ResultData, or a non-object", () => {
    expect(parsePageTransaction({ StatusCode: "501", ErrorMessage: "x" }).ok).toBe(false);
    expect(parsePageTransaction("x").ok).toBe(false);
  });
});

describe("parseValidateResponse", () => {
  it("reads 1, 0, quoted or JSON numbers, and anything else as an error", () => {
    expect(parseValidateResponse("1")).toBe("valid");
    expect(parseValidateResponse('"1"\n')).toBe("valid");
    expect(parseValidateResponse("0")).toBe("invalid");
    expect(parseValidateResponse("<html>")).toBe("error");
  });
});

describe("pageCardBrand", () => {
  it("maps Pelecard brand and issuer codes", () => {
    expect(pageCardBrand("2", "2")).toBe("visa");
    expect(pageCardBrand("1", "1")).toBe("mastercard");
    expect(pageCardBrand("3", "6")).toBe("mastercard");
    expect(pageCardBrand("5", "1")).toBe("isracard");
    expect(pageCardBrand("0", "1")).toBe("isracard");
    expect(pageCardBrand("0", "4")).toBe("amex");
    expect(pageCardBrand(0, 3)).toBe("diners");
    expect(pageCardBrand(null, null)).toBe("unknown");
  });
});

describe("judgePagePayment", () => {
  const order = { id: "3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c", amountIls: 449.5 };
  const parsed = parsePageTransaction(DOCUMENTED_TX);
  if (!parsed.ok) throw new Error("fixture must parse");
  const tx = (overrides: Partial<PageTransaction>): PageTransaction => ({ ...parsed.tx, ...overrides });
  it("asks for validation before calling a clean approval paid", () => {
    expect(judgePagePayment(tx({}), order, "not_checked")).toEqual({ kind: "needs_validation" });
    expect(judgePagePayment(tx({}), order, "valid")).toEqual({ kind: "paid" });
  });
  it("treats a readable non-000 result as not paid", () => {
    expect(judgePagePayment(tx({ shvaResult: "036" }), order, "not_checked")).toEqual({ kind: "not_paid", code: "036" });
  });
  it("never calls a mismatch or a failed validation paid", () => {
    expect(judgePagePayment(tx({ totalAgorot: 45000 }), order, "valid").kind).toBe("unknown");
    expect(judgePagePayment(tx({ currency: "2" }), order, "valid").kind).toBe("unknown");
    expect(judgePagePayment(tx({ paramX: "0000000000000000000" }), order, "valid").kind).toBe("unknown");
    expect(judgePagePayment(tx({ shvaResult: null }), order, "valid").kind).toBe("unknown");
    expect(judgePagePayment(tx({}), order, "invalid").kind).toBe("unknown");
    expect(judgePagePayment(tx({}), order, "error").kind).toBe("unknown");
  });
});

describe("feedbackIds", () => {
  const id = "3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c";
  it("reads the return URL's query", () => {
    expect(feedbackIds(new URLSearchParams({ PelecardTransactionId: "abc", PelecardStatusCode: "036", UserKey: id })))
      .toEqual({ orderId: id, transactionId: "abc", statusCode: "036" });
  });
  it("reads a raw JSON callback body, nested or flat, any key casing", () => {
    expect(feedbackIds(JSON.stringify({ ResultData: { TransactionId: "abc", UserKey: id, ShvaResult: "000" } })).transactionId).toBe("abc");
    expect(feedbackIds(JSON.stringify({ transactionid: "abc", userkey: id })).orderId).toBe(id);
  });
  it("reads JSON wrapped in a single form field", () => {
    expect(feedbackIds(`data=${encodeURIComponent(JSON.stringify({ TransactionId: "abc", UserKey: id }))}`).transactionId).toBe("abc");
  });
  it("drops a UserKey that is not a uuid, and survives an empty body", () => {
    expect(feedbackIds(JSON.stringify({ TransactionId: "abc", UserKey: "x" })).orderId).toBeNull();
    expect(feedbackIds("")).toEqual({ orderId: null, transactionId: null, statusCode: null });
  });
});
```

- [ ] **Step 2: Run to see them fail.** Same command. Expected: FAIL.

- [ ] **Step 3: Implement** in `pelecard-page-mapping.ts`. `parsePageTransaction` requires `StatusCode` "000" and a `ResultData` object with a non-empty `TransactionId`; codes via `normalizeCode`; `last4` only when the digits of `CreditCardNumber` end in 4 digits; `installments` = `TotalPayments > 1 ? TotalPayments : 1`; `raw` = a whitelist: `TransactionId, TransactionPelecardId, VoucherId, ShvaResult, DebitApproveNumber, DebitTotal, DebitCurrency, TotalPayments, FirstPaymentTotal, FixedPaymentTotal, CreditType, JParam, CreditCardCompanyClearer, CreditCardCompanyIssuer, CreditCardBrand, CreditCardAbroadCard, AdditionalDetailsParamX`. `pageCardBrand` order: issuer 4 amex, issuer 3 diners, brand 2 visa, brand 1 or 3 mastercard, brand 5 or (brand 0 and issuer 1) isracard, else unknown. `judgePagePayment` order: `shvaResult` null is unknown, non-000 is not_paid, then total (`toAgorot(order.amountIls)`), currency "1" and `paramX === pelecardParamX(order.id)` must all match (else unknown with the mismatch named), then validation decides. `feedbackIds` lowercases keys, looks at the top level and under `resultdata`, takes the transaction id from `pelecardtransactionid` or `transactionid` and the status from `pelecardstatuscode`, `shvaresult` or `statuscode` (through `normalizeCode`), tries URLSearchParams first and then JSON (also JSON inside a single form value), and passes the id through `isValidUUID`.

- [ ] **Step 4: Run to see them pass.** Expected: PASS.

- [ ] **Step 5: Commit** (`feat(payments): verify Pelecard payment page transactions`)

---

### Task 3: Settlement rules and refund flag (pure)

**Files:**
- Create: `src/lib/payments/page-settlement.ts`
- Test: `src/lib/payments/__tests__/page-settlement.test.ts`

**Interfaces:**
- Produces:
  - `const SUPERSEDED_NOTE = "replaced by a newer Payment link"` (moved here; Task 5 makes `open-payment-link.ts` import it)
  - `const UNVERIFIED_NOTE = "Pelecard result not verified; reconcile"`
  - `const REFUND_FLAG_PREFIX = "refund in Pelecard:"`
  - `type PaidOrderAction = "complete" | "complete_superseded" | "already_done" | "flag_refund"`
  - `paidOrderAction(order: { status: OrderStatus; fulfillment_error: string | null; provider_transaction_id: string | null }, pelecardId: string, newerLinkPaid: boolean): PaidOrderAction`
  - `refundNote(existing: string | null, details: { pelecardId: string; approvalNumber: string | null; reason: string }): string`
  - `returnRedirect(outcome: SettleOutcome, orderId: string): string`
  - `unverifiedOutcome(hintCode: string | null): SettleOutcome` (a readable non-000 hint is `not_paid` with that code; anything else is `unverified`)
  - `type SettleOutcome = { kind: "paid" } | { kind: "refund_flagged" } | { kind: "not_paid"; code: string } | { kind: "unverified" } | { kind: "ignored"; reason: string }`

- [ ] **Step 1: Write the failing tests**

```ts
describe("paidOrderAction", () => {
  const base = { fulfillment_error: null, provider_transaction_id: null };
  it("completes open orders", () => {
    for (const status of ["pending", "expired", "charging"] as const) expect(paidOrderAction({ ...base, status }, "9", false)).toBe("complete");
  });
  it("treats the same transaction on a paid order as done, a different one as a refund", () => {
    expect(paidOrderAction({ ...base, status: "paid", provider_transaction_id: "9" }, "9", false)).toBe("already_done");
    expect(paidOrderAction({ ...base, status: "paid", provider_transaction_id: "8" }, "9", false)).toBe("flag_refund");
  });
  it("honors a superseded link unless a newer link was already paid", () => {
    const superseded = { ...base, status: "failed" as const, fulfillment_error: SUPERSEDED_NOTE };
    expect(paidOrderAction(superseded, "9", false)).toBe("complete_superseded");
    expect(paidOrderAction(superseded, "9", true)).toBe("flag_refund");
  });
  it("flags a payment on any other closed order", () => {
    for (const status of ["failed", "voided", "refunded"] as const) expect(paidOrderAction({ ...base, status, fulfillment_error: "x" }, "9", false)).toBe("flag_refund");
  });
});

describe("refundNote", () => {
  it("leads with the prefix and keeps what was there", () => {
    const note = refundNote("invoice: timeout", { pelecardId: "9", approvalNumber: "0155995", reason: "paid twice" });
    expect(note.startsWith(REFUND_FLAG_PREFIX)).toBe(true);
    expect(note).toContain("9");
    expect(note).toContain("0155995");
    expect(note.endsWith("invoice: timeout")).toBe(true);
  });
});

describe("returnRedirect", () => {
  const id = "3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c";
  it("sends paid, flagged and unverified to the confirmation page", () => {
    for (const kind of ["paid", "refund_flagged", "unverified"] as const) expect(returnRedirect({ kind }, id)).toBe(`/join/success?order=${id}`);
  });
  it("sends a decline back to the card page with its code", () => {
    expect(returnRedirect({ kind: "not_paid", code: "036" }, id)).toBe(`/join/pay/${id}?declined=036`);
  });
  it("sends anything ignored back to the card page", () => {
    expect(returnRedirect({ kind: "ignored", reason: "x" }, id)).toBe(`/join/pay/${id}`);
  });
});

describe("unverifiedOutcome", () => {
  it("trusts a decline hint, because it can only hurt whoever forged it", () => {
    expect(unverifiedOutcome("036")).toEqual({ kind: "not_paid", code: "036" });
  });
  it("holds the order when the hint says paid or says nothing", () => {
    expect(unverifiedOutcome("000")).toEqual({ kind: "unverified" });
    expect(unverifiedOutcome(null)).toEqual({ kind: "unverified" });
    expect(unverifiedOutcome("abc")).toEqual({ kind: "unverified" });
  });
});
```

- [ ] **Step 2: Run to see them fail.** `npm run test:run -- src/lib/payments/__tests__/page-settlement.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/lib/payments/page-settlement.ts` (no I/O). `refundNote` format: `` `${REFUND_FLAG_PREFIX} ${reason}, transaction ${pelecardId}${approval ? `, approval ${approval}` : ""}` `` then `` ` | ${existing}` `` when existing is non-empty.
- [ ] **Step 4: Run to see them pass.** Expected: PASS.
- [ ] **Step 5: Commit** (`feat(payments): settlement rules for the Pelecard page`)

---

### Task 4: Pelecard page I/O and `settlePagePayment`

**Files:**
- Modify: `src/lib/payments/pelecard.ts` (add three calls; `chargeCard` is removed in Task 7)
- Modify: `src/features/enrollment/lib/mark-paid.ts`
- Modify: `src/features/enrollment/lib/complete-card-payment.ts`
- Create: `src/features/enrollment/lib/settle-page-payment.ts`
- Create: `src/features/plans/lib/payment-link-supersede.ts`

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces:
  - `openPelecardPage(order: PageOrder): Promise<InitResult>` (returns `{ ok: false, reason: "not configured" }` without credentials; network errors become `{ ok: false }`, never throw)
  - `getPageTransaction(transactionId: string): Promise<{ ok: true; tx: PageTransaction } | { ok: false; reason: string }>` (POST `{base}/PaymentGW/GetTransaction` with `terminal`, `user`, `password`, `TransactionId`; never throws)
  - `validatePagePayment(confirmationKey: string, orderId: string, totalAgorot: number): Promise<"valid" | "invalid" | "error">` (POST `{base}/PaymentGW/ValidateByUniqueKey` with `ConfirmationKey`, `UniqueKey`, `TotalX100`; reads the body as text)
  - `markOrderPaid(db, orderId, ref, opts?: { allowSuperseded?: boolean })`: with `allowSuperseded`, the single update also matches `status = failed AND fulfillment_error = SUPERSEDED_NOTE` (PostgREST `.or("status.in.(pending,charging,expired),and(status.eq.failed,fulfillment_error.eq.<note>)")`).
  - `completeCardPayment(db, orderId, ref, issuer, opts?: { allowSuperseded?: boolean })` passes `opts` through.
  - `newerPaymentLinkPaid(db, order: { id: string; profile_id: string | null; created_at: string }): Promise<boolean>` and `closeNewerPaymentLinks(db, order: same): Promise<void>` (newer rows for the same `profile_id` with `payment_link_by` set; close `pending`/`expired` ones to `failed` with note `"closed: an older link for this child was paid"`).
  - `settlePagePayment(db: SupabaseClient, input: { orderId: string; transactionId: string; hintCode: string | null }): Promise<SettleOutcome>`

- [ ] **Step 1: Implement the three Pelecard calls** in `pelecard.ts`, reusing `credentials()` (map `terminalNumber` to `terminal`), `apiUrl()` and a JSON POST with the existing 30 s timeout. Read every response with `.text()` and parse in the pure functions.
- [ ] **Step 2: Extend `markOrderPaid` and `completeCardPayment`** with `opts.allowSuperseded`. Existing callers pass nothing and behave as before.
- [ ] **Step 3: Implement `payment-link-supersede.ts`.**
- [ ] **Step 4: Implement `settlePagePayment`** in this order:
  1. Load the order (`id, status, amount_ils, fulfillment_error, provider_transaction_id, profile_id, created_at`); missing is `ignored`.
  2. `getPageTransaction`; on failure go to step 6.
  3. `judgePagePayment(..., "not_checked")`; `needs_validation` calls `validatePagePayment(tx.confirmationKey ?? "", order.id, toAgorot(amount))` and judges again.
  4. `not_paid` returns `{ kind: "not_paid", code }` with no write. `unknown` goes to step 6.
  5. `paid`: build the `PaidReference` (`provider` "isracard", `transactionId` = `tx.pelecardId ?? tx.transactionId`, `approvalNumber`, `cardBrand` = `tx.brand`, `cardLast4`, `installments`, `raw`). `newerLinkPaid` is queried only when the order is superseded. Then by `paidOrderAction`: `complete` runs `completeCardPayment(db, id, ref, { id: null, name: null })`; `complete_superseded` runs it with `{ allowSuperseded: true }` and then `closeNewerPaymentLinks`; `already_done` does nothing; `flag_refund` writes `refundNote(...)` to `fulfillment_error` and logs `[pelecard-page] order {id} refund flagged: {reason}`. Return `paid` or `refund_flagged`.
  6. Unverified: `unverifiedOutcome(input.hintCode)`. `not_paid` returns with no write (the callback still settles a real payment). `unverified` moves `pending`/`expired` to `charging` with `UNVERIFIED_NOTE` (conditional update on those statuses) and returns.
- [ ] **Step 5: Verify types and existing tests**

Run: `npx tsc --noEmit && npm run test:run`
Expected: no type errors, all tests pass.

- [ ] **Step 6: Commit** (`feat(payments): settle Pelecard page payments server side`)

---

### Task 5: Return route and server-side callback

**Files:**
- Create: `src/app/join/pay/[orderId]/return/route.ts`
- Create: `src/app/api/webhooks/pelecard/route.ts`
- Modify: `src/lib/rate-limit.ts` (new limiter `payment_feedback`: sliding window 60 per hour per IP, prefix `goe:payment-feedback`, fails open: not added to the sensitive list)
- Modify: `src/features/plans/lib/open-payment-link.ts` (import `SUPERSEDED_NOTE`)

**Interfaces:**
- Consumes: `settlePagePayment`, `feedbackIds`, `returnRedirect`, `checkRateLimit`.

- [ ] **Step 1: Return route (GET).** `orderId` from the path (must pass `isValidUUID`, else redirect to `/join`). Ids from `feedbackIds(request.nextUrl.searchParams)`; a `UserKey` that differs from the path id is `ignored`. Rate limited by IP on `payment_feedback`; when limited, redirect to `/join/success?order={id}` without settling. With a transaction id, settle with `hintCode` = the `PelecardStatusCode`; without one, use `unverifiedOutcome(hintCode)` but turn `unverified` into `ignored` (nothing to ask Pelecard about, so the order is not held). Redirect (303) to `returnRedirect(outcome, orderId)` as an absolute URL on the request origin.
- [ ] **Step 2: Callback route (POST).** Read `await request.text()`, `feedbackIds(text)`, settle when both ids exist, rate limited by IP on `payment_feedback`. Always answer 200 `{ received: true }`. Log one line per call: order id, outcome kind, never the body.
- [ ] **Step 3: Point `open-payment-link.ts` at `SUPERSEDED_NOTE`.**
- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run test:run`
Expected: clean.

- [ ] **Step 5: Commit** (`feat(payments): Pelecard return route and callback`)

---

### Task 6: The card page renders Pelecard's frame

**Files:**
- Create: `src/features/enrollment/lib/open-payment-page.ts` (server-only)
- Create: `src/features/enrollment/components/PelecardFrame.tsx` (server component)
- Modify: `src/features/enrollment/components/FullLoadGuard.tsx`
- Modify: `src/app/join/pay/[orderId]/page.tsx`
- Modify: `src/lib/security/payment-csp.ts`, `src/lib/security/__tests__/payment-csp.test.ts`
- Modify: `src/lib/rate-limit.ts` (`payment_order`: 10 per 24 h)
- Create: `public/pelecard/payment-page.css`

**Interfaces:**
- Consumes: `openPelecardPage`, `maxInstallmentsFor`, `declineMessage`, and the checks now in `chargeOrderAction`.
- Produces: `openPaymentPage(orderId: string): Promise<{ kind: "frame"; url: string } | { kind: "message"; text: string }>`

- [ ] **Step 1: Write the failing CSP test** in `payment-csp.test.ts`:

```ts
it("lets only Pelecard's payment page into a frame", () => {
  const csp = directives(paymentPageCsp("abc123", { dev: false }));
  expect(csp.get("frame-src")).toBe("https://*.pelecard.biz");
});
```

Rename the existing "keeps card data from leaving for another origin" test to "sends nothing to another origin"; its assertions stay.

- [ ] **Step 2: Run to see it fail.** `npm run test:run -- src/lib/security/__tests__/payment-csp.test.ts`. Expected: FAIL.
- [ ] **Step 3: Add `frame-src https://*.pelecard.biz`** to `paymentPageCsp` and rewrite its header comment: the page no longer handles card data; the policy keeps an injected script from swapping Pelecard's frame for a fake form. Run the test: PASS.
- [ ] **Step 4: Implement `openPaymentPage`** with every check `chargeOrderAction` makes today, in the same order and with the same Hebrew messages (`canPayOnline`, the `payment` IP limit, order status, product sellable at the captured price or valid manual Card terms, signed agreement, intro-pack eligibility), then the `payment_order` limit keyed `order:{id}`, then `openPelecardPage({ id, amountIls, maxInstallments: maxInstallmentsFor(product, order) })`. Init failure logs `[pelecard-page] order {id} init failed: {reason}` and returns `{ kind: "message", text: "לא הצלחנו לפתוח את דף התשלום. נסו שוב בעוד כמה דקות או כתבו לנו בוואטסאפ 052-577-9446." }`.
- [ ] **Step 5: `PelecardFrame`**: `<iframe src={url} title="תשלום מאובטח בפלאקארד" className="block w-full min-h-[640px] rounded-xl border-0" allow="payment" />`.
- [ ] **Step 6: `FullLoadGuard`** keeps the reload-on-client-navigation effect but always renders its children, so the frame is in the server HTML.
- [ ] **Step 7: The page** keeps its redirects, the unsigned-agreement message and the order summary. A valid `?declined=` code (`/^\d{3}$/`) shows `declineMessage(code)` above the frame. When payments are open it renders `FullLoadGuard` around the result of `openPaymentPage`: `PelecardFrame` or the message. `PaymentForm` is no longer imported.
- [ ] **Step 8: `public/pelecard/payment-page.css`**: start from Pelecard's default `https://gateway20.pelecard.biz/Content/Css/variant-he-1.css`, set the site's `--primary` color (from `src/app/globals.css`, written as a literal value) on buttons and focus rings, RTL kept, system font stack.
- [ ] **Step 9: Verify the server HTML**

Run: `npx tsc --noEmit && npm run lint && npm run test:run`, then `npm run build`.
Expected: clean, build succeeds. (A live check of view source needs Pelecard credentials and happens in rollout.)

- [ ] **Step 10: Commit** (`feat(payments): embed Pelecard's payment page on the card page`)

---

### Task 7: Admin check, refund note, and removing the direct charge

**Files:**
- Modify: `src/features/plans/lib/actions/admin-orders-reconcile.ts`
- Modify: `src/features/plans/components/admin/OrdersTable.tsx`
- Delete: `src/features/enrollment/components/PaymentForm.tsx`, `src/features/enrollment/lib/actions/charge-order.ts`, `src/lib/validations/card-payment.ts`, `src/lib/payments/provider.ts`
- Modify: `src/lib/plans/installments.ts` (owns `export const MAX_INSTALLMENTS = 3`)
- Modify: `src/lib/payments/pelecard.ts` (remove `chargeCard`), `src/lib/payments/pelecard-mapping.ts` (remove `buildDebitRequest`, `parseDebitResponse`, `splitInstallments`, `mmyy`, `PelecardDebitPath`, `PelecardOutcome`, the decline maps moved in Task 1; keep `toAgorot`, `pelecardParamX`, `isRecord`, `normalizeCode`, `statusOf`, `pickStored`)
- Modify: `src/lib/payments/card.ts` (keep `CardBrand`; remove helpers nothing imports any more) and its tests
- Modify: `src/lib/payments/__tests__/pelecard-mapping.test.ts` (drop tests of removed functions)
- Modify: `CLAUDE.md` (the card page and Pelecard paragraphs)

**Interfaces:**
- `ReconcileResult` gains `{ outcome: "not_found" }`.

- [ ] **Step 1: Reconcile on pending card orders.** Allow `status = pending` (select `created_at` too) with `chargingSince = new Date(order.created_at)`. Found completes as today. Not found returns `{ outcome: "not_found" }` and writes nothing. `charging` keeps its current behavior.
- [ ] **Step 2: OrdersTable.** Show "בדיקה מול פלאקארד" on pending card orders as well (read `startCheckoutAction` and `createPaymentLinkAction` to find which column marks a card order while pending, and use it); toast "לא נמצא חיוב בפלאקארד" on `not_found`. For any status, a `fulfillment_error` starting with `REFUND_FLAG_PREFIX` renders in red under the status badge with "להחזר בפלאקארד".
- [ ] **Step 3: Delete the direct charge** files and functions listed above. Confirm nothing references them:

Run: `grep -rnE "chargeOrderAction|PaymentForm|cardPaymentSchema|chargeCard|buildDebitRequest|parseDebitResponse|CardChargeRequest" src`
Expected: no output.

- [ ] **Step 4: Update CLAUDE.md**: the card is paid on Pelecard's payment page embedded in `/join/pay/[orderId]` (`PaymentGW/init` in `openPaymentPage()`), settled only by `settlePagePayment()` from the return route and `/api/webhooks/pelecard`; remove the Services API charge description; keep the reconcile and limits text accurate.
- [ ] **Step 5: Full verification**

Run: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`
Expected: all clean.

- [ ] **Step 6: Commit** (`refactor(payments): remove the direct card charge`)
