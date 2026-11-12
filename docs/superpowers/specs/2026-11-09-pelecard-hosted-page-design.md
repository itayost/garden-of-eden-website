# Pelecard hosted payment page

Date: 2026-11-09. Status: reviewed, awaiting Itay's approval.

## Why

On 2026-11-09 the terminal company reviewed `/join/pay/[orderId]` and wrote that the payment page "is not secured by the terminal company" and "is not embedded", asking for an integration check. Their reviewer wants to open view source on our card page and see Pelecard there.

Today the parent types the card number, expiry, CVV and ID into our own form (`PaymentForm`), the server action `chargeOrderAction` receives them, and our server sends them to Pelecard's Services API (`DebitRegularType` / `DebitPaymentsType`). Card data passes through our server, which puts the business in full PCI DSS scope (SAQ D). The academy cannot carry that, and the terminal company will not approve it.

The fix: the parent types the card on Pelecard's own payment page ("Iframe/Redirect 2.0"), embedded in our card page. Card data goes from the browser straight to Pelecard and never reaches our server. Pelecard's API cannot simply be called from the browser instead: every request carries the terminal user and password (which also allow refunds and reading every transaction), and the endpoint refuses browser (CORS) requests.

## Goals

- Card data never touches our pages' code or our server. The parent types it inside Pelecard's page.
- The card page's server-rendered HTML contains an `<iframe>` whose `src` is Pelecard's payment page URL, so view source shows Pelecard.
- A payment is marked paid only after our server confirms it with Pelecard server to server. Nothing the browser or a callback sends is trusted on its own.
- Everything after payment stays as it is: `completeCardPayment()` (mark paid, fulfillment, Morning receipt, WhatsApp), the confirmation page, the admin "בדיקה מול פלאקארד" check.
- Orders, the agreement step, Payment links, Discounts, manual Cards, the intro-pack rule and the `ONLINE_PAYMENTS` gate behave exactly as today.

## Non-goals

- Bit, Apple Pay and Google Pay. The guide does not cover them; wait for Pelecard's answer.
- Saved cards, tokens or automatic renewals.
- Any change to how staff take cash, transfer, Bit, cheque, free or Arbox payments.

## Anti-goals (a failure even if it works)

- Card number, CVV or ID appear anywhere in our code path, logs or database.
- An order is marked paid from the redirect parameters or the callback body without Pelecard's own confirmation.
- A decline marks the order `failed` (that status means the order is cancelled; the parent must be able to try again).
- A parent who paid ends up with two Plans, or a second payment for the same order is silently lost.
- The terminal password reaches the browser.

## Sources

- Pelecard "Iframe/Redirect 2.0" developer guide (Hebrew, 08/2018, 47 pages): `~/Downloads/iFrame20 - Heb.pdf` on Itay's machine. Flow on pages 4-6, landing-page parameters page 7, init JSON example pages 8-9, required and optional fields pages 10-17, output parameters 37-40, status codes 41-44, sandbox page 47.
- Pelecard "Services ReST API" guide (08/2024): `~/Downloads/API - Heb.pdf`. `ValidateByUniqueKey` page 17, `GetTransaction` page 18, `GetCompleteTransData` page 20 (already used by reconcile).
- Current code: `src/lib/payments/pelecard.ts`, `pelecard-mapping.ts`, `pelecard-lookup.ts`, `src/features/enrollment/lib/actions/charge-order.ts`, `complete-card-payment.ts`, `mark-paid.ts`, `src/app/join/pay/[orderId]/page.tsx`, `src/lib/security/payment-csp.ts`, `src/features/plans/lib/actions/admin-orders-reconcile.ts`.

## How it works

### 1. Opening the page (server render of `/join/pay/[orderId]`)

The page keeps every check it and `chargeOrderAction` do today before money moves: order exists and is `pending` or `expired`, agreement signed, product still sellable at the captured price (or a valid manual Card), intro-pack eligibility, `canPayOnline()`, the IP and per-order rate limits. Those checks move from the server action into the page's server code (or a shared server-only function both can call); the parent can no longer submit anything to us.

When all pass, the server POSTs to Pelecard `PaymentGW/init` with:

- `terminal`, `user`, `password` from the existing `PELECARD_*` env vars (server only).
- `Total` in agorot from the order row, `Currency` "1".
- `ActionType` "J4" (charge).
- `UserKey`: the order id. `ParamX`: `pelecardParamX(order.id)` (the 19-character reference reconcile already searches by).
- `GoodURL` and `ErrorURL`: our return handler (section 3). `FeedbackOnTop` true, so Pelecard opens them in the top window, never inside the frame. `FeedbackDataTransferMethod` GET.
- `ServerSideGoodFeedbackURL` and `ServerSideErrorFeedbackURL`: our callback (section 4).
- `MaxPayments` 3 (today's `MAX_INSTALLMENTS`), `MinPayments` 1, `FirstPayment` "auto".
- `Language` "HE", `CustomerIdField` "must", `Cvv2Field` "must", `CardHolderName` "hide", email and phone fields hidden.
- `CssURL` and `LogoURL` pointing at files we serve, so the page matches the site.
- No `CancelURL` (no cancel button; our page already links back to `/join`).

Pelecard answers with the payment page URL and a TransactionId. The page renders, in its server HTML, an `<iframe src="{URL}">` in place of `PaymentForm`, next to the existing order summary. The URL is used only if it is `https:` on a `pelecard.biz` host; anything else is treated as a failure.

If init fails, or a limit is hit, the page shows a Hebrew message and the WhatsApp number instead of the frame. Nothing about the order changes.

The order stays `pending` while the parent is on Pelecard's page. Every render opens a new Pelecard page; the per-order limit bounds how many.

### 2. On Pelecard's page

The parent types the card there. Declines that Pelecard lets the parent retry stay inside the frame. When the transaction ends, Pelecard sends the top window to `GoodURL` or `ErrorURL` and, in parallel, POSTs the result to our callback.

### 3. Return handler (`GoodURL` / `ErrorURL`)

A GET route that receives `PelecardStatusCode`, `PelecardTransactionId`, `ApprovalNo`, `ConfirmationKey`, `ParamX`, `UserKey`. It treats them only as hints: which order (`UserKey`) and which Pelecard transaction to ask about. It then runs the shared verification (section 5) and redirects:

- verified paid: run `completeCardPayment()` (idempotent) and redirect to `/join/success?order={id}`, where the existing poller shows the confirmation.
- verified not paid (declined, timed out, error code): redirect to `/join/pay/{id}` with a short Hebrew reason; the page opens a fresh Pelecard page for another try. The order stays `pending`.
- could not verify (Pelecard unreachable, ambiguous answer): move the order from `pending` / `expired` to `charging` with a `fulfillment_error` note ("Pelecard result not verified; reconcile"), then redirect to `/join/success?order={id}`. `charging` already means "money may have moved": the card page sends such orders to the success page instead of opening a new Pelecard page, the admin check settles them, and a later callback can still complete them (`markOrderPaid()` accepts `charging`). Never tell the parent to pay again in this case. (Builder's call, from the design review.)

### 4. Server-side callback (`ServerSideGoodFeedbackURL` / `ServerSideErrorFeedbackURL`)

A POST route, content type `application/x-www-form-urlencoded`, body is Pelecard's result JSON (guide page 5, "format 2", no `resultDataKeyName`). Same rule: read only the order id (`UserKey`) and Pelecard transaction id from it, tolerantly (top level or under `ResultData`, either key casing), run the shared verification, and on a verified payment run `completeCardPayment()`. Because nothing else in the body is used, its exact shape does not need to be known in advance. Always answer 200 quickly. This is what makes a payment stick when the parent closes the tab before the redirect. Pelecard may send from 31.168.172.190; restricting by IP is optional because nothing is trusted without verification.

### 5. Verification (shared by 3 and 4, and pure where possible)

1. Load the order. It must exist.
2. Call `PaymentGW/GetTransaction` with the transaction id. Require: `ShvaResult` / status "000", `DebitTotal` equal to the order amount in agorot, `DebitCurrency` "1", `AdditionalDetailsParamX` equal to `pelecardParamX(order.id)`.
3. Call `ValidateByUniqueKey` with that transaction's `ConfirmationKey`, `UniqueKey` = order id, `TotalX100` = amount in agorot. Require "1".
4. Only then build the `PaidReference`: `provider` "isracard" (unchanged; Isracard is the acquirer), `transactionId` = Pelecard's numeric transaction id (the same kind of id the Debit path and reconcile store), `approvalNumber` from `DebitApproveNumber`, `cardLast4` from the masked `CreditCardNumber` (null unless exactly 4 digits), `cardBrand` mapped from `CreditCardBrand` / `CreditCardCompanyIssuer` to our `CardBrand` (unknown when unsure), `installments` = max(1, `TotalPayments`), `raw` = Pelecard's result without the masked card number or `shvaOutput`.

The decision ("paid", "not paid with reason", "unknown") is a pure function over the parsed responses and the order, with unit tests. HTTP calls stay thin.

A verified payment is honored even if a page-open check would no longer pass when it arrives (the product went off sale, the price changed, the intro pack was bought on another order meanwhile): the parent paid the price the order captured, on a page we opened. (Builder's call.) Orders in `pending`, `expired` or `charging` are completed normally; `paid` is section 6; `failed` is section 6b.

### 6. Paid twice

The parent can have two Pelecard pages open (two tabs, a reload). If a second verified payment arrives for an order that is already paid with a different transaction id, do not create anything. Record it where admins already look on `/admin/orders` (for example `fulfillment_error` with the second transaction and approval numbers, prefixed so it reads as "refund in Pelecard"), and log it. The same transaction arriving twice (redirect plus callback) is the normal case and is a no-op.

### 6b. Paid on an order a newer Payment link closed

A new Payment link closes the child's older unpaid links (`open-payment-link.ts`: `status = failed`, `fulfillment_error = "replaced by a newer Payment link"`). The parent may still have the old order's Pelecard page open and pay it. Itay decided (2026-11-09): honor it.

- A verified payment on a `failed` order whose note is that supersede note is completed like any other: the order moves to `paid` and goes through `completeCardPayment()`. `markOrderPaid()` must allow `failed` to `paid` only in this case, in the same single conditional update.
- The child's newer unpaid Payment links (`pending` / `expired`, `payment_link_by` set) are then closed the same way, so the parent cannot pay twice.
- If a newer link for that child was already paid, nothing is created from the old order: it is recorded for a refund exactly like section 6.
- A verified payment on a `failed` order closed for any other reason (no Pelecard page should exist for it) is recorded for a refund the same way and logged.

### 7. Admin check ("בדיקה מול פלאקארד")

Keep the existing `charging` path: it now serves old rows and the "could not verify" case from section 3. Also offer the check on `pending` card orders: the existing `lookupCharge()` by `paramX` and amount finds a payment on any Pelecard page of that order. Found: `completeCardPayment()`. Not found: nothing changes (no release step is needed for a pending order). This covers a payment whose redirect and callback both failed.

### 8. Content Security Policy and the page shell

- `paymentPageCsp()` adds `frame-src https://*.pelecard.biz`. Everything else stays enforced, because a script injected on our page could still swap the frame for a fake form. Update its comment: the page no longer handles card data, it hosts Pelecard's frame.
- The frame must be in the server HTML. `FullLoadGuard` today renders its children only on the client; it must not wrap the frame. Keep its reload-on-client-navigation behavior (so the enforced CSP applies) without gating the server render.
- The return handler and the callback are not under `/join/pay` CSP rules that would get in their way; pick paths accordingly.

### 9. What gets removed

`PaymentForm`, the card branch of `chargeOrderAction` (the action itself goes if nothing else uses it), `cardPaymentSchema` and card validation helpers that nothing else uses, `buildDebitRequest` / `parseDebitResponse` and their tests, `chargeCard()`. Keep `lookupCharge()` and its parsers (reconcile still uses them) and `PELECARD_*` env vars. Update the CLAUDE.md paragraph that describes the card page and the Services API.

## Constraints

- Project rules: Hebrew UI, logical CSS properties, no emojis, immutability, files under 800 lines, `isValidUUID()` on ids, server-only for anything holding `PELECARD_PASSWORD`.
- Tests: pure functions only (request builder, response parsers, verification decision, brand mapping, URL check, CSP string), written first. No mock-based tests.
- No database migration is needed for this design.
- The checks that today run in `chargeOrderAction` must not be weakened when they move.

## Testing against Pelecard

Pelecard's sandbox (`https://gateway20.pelecard.biz/sandbox`) and the test terminal in the guide's own init example (page 8) let us see the real init, landing and `GetTransaction` shapes before writing the parsers. Record them by hand with a local script (init, then a test payment on the returned page, then `GetTransaction` and `ValidateByUniqueKey` on it) and keep them as test fixtures, with anything card-like removed. The guide's examples are not reliable enough to code against blind (the Services API was built that way and its lookup formats are still unverified).

No end-to-end run of the new routes on the branch: local dev and preview deployments write to the production database, so a verified sandbox payment would create a real account, Plan, Morning receipt and WhatsApp. The first full run is the admin's small live payment in rollout step 4. (Builder's call, from the design review.)

## Open with Pelecard (do not block the build)

- Is the academy's website terminal enabled for the payment page, with the same user and password as the Services API?
- Which host: the guide uses `gateway20`, our Services calls use `gateway21`.
- Bit, Apple Pay, Google Pay on this page.
- The reviewer's re-check once it is live.

## Left to the builder

- Route paths for the return handler and the callback.
- Whether the page-opening checks live in the page file or a shared server-only module.
- The CSS file's exact styling (Pelecard's default `variant-he-1.css` is a starting point; fonts may fall back to system fonts if cross-origin font loading is a problem).
- The per-order page-open limit (5 a day today; every page load now counts, so it may need to be higher).
- Rate limiting on the return handler and callback.
- Exact Hebrew wording of messages.
- How the "paid twice" note is surfaced, as long as admins see it on `/admin/orders`.

## Rollout

1. Build and test on a branch against the sandbox.
2. Pelecard confirms the terminal settings; set any new env var in Vercel production.
3. Merge and deploy. `ONLINE_PAYMENTS` stays as it is.
4. An admin makes one small live payment through the new page, checks the order, Plan, receipt and WhatsApp, and cancels it in Pelecard.
5. Tell the reviewer it is ready for the re-check.
