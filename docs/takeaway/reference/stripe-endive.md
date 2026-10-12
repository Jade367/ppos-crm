# Stripe reference: API `2026-09-30.endive` with `stripe@23.0.0` (agent-facing)

> **Read this before you write any Stripe code.** It is the only Stripe knowledge you may rely on. Your training data is older than this API version, so where your memory and this file disagree, this file wins.
> Status: **FROZEN**. This is a protected path; you cannot edit it. Propose changes in `PROGRESS.md` under `## Proposed doc changes`.
> Precedence: installed SDK types, then this file, then your memory. `architecture.md` §9 is the summary and this file holds the detail. A task card may set function signatures and file names. Stripe parameter values and semantics come from this file.
> Basis (checked 2026-10-11): the stripe-node 23.0.0 npm tarball (types and code read directly), the Stripe OpenAPI spec (`info.version` 2026-09-30.endive), and the stripe-cli source. The TypeScript snippets in §3–§10 compile under `tsc --strict --noUncheckedIndexedAccess` against the package's `deno`-condition types (`esm/stripe.esm.worker.d.ts`). They were type-checked with tsc, not run under Deno. stripe.com and docs.stripe.com could not be fetched. Items marked **UNVERIFIED-LIVE** must be checked on the live page by a human before anyone relies on them.
> If you need a Stripe fact that is not here, read the official docs with the web-reader tool and record the URL plus what you verified in `PROGRESS.md`. Never guess.

## 1. Versions (FROZEN)

| Thing | Value | Notes |
|---|---|---|
| Stripe API version | `2026-09-30.endive` | Pinned in the client **and** on both webhook endpoints |
| Server SDK | npm `stripe` **23.0.0**, used from Deno as `npm:stripe@23.0.0` | Edge functions only. Exact version, never a range |
| Import style | Either inline `import Stripe from 'npm:stripe@23.0.0';` **or** a `supabase/functions/deno.json` import entry `"stripe": "npm:stripe@23.0.0"` used as `import Stripe from 'stripe';` | ADR-0002 (P0-03) picks one. Only `_shared/stripe.ts` imports the SDK; every other file imports from `../_shared/stripe.ts` |
| `@stripe/stripe-js` | 10.0.0 (release train `endive`) | **Not used in the MVP.** Hosted Checkout is a redirect, so no Stripe.js runs in the browser |
| `@stripe/connect-js` | 3.4.6 | Reserved for embedded onboarding (phase 2+). Not used |
| Stripe CLI | latest | Dev only. Always run `stripe listen --latest` |

- Deno resolves `npm:stripe@23.0.0` through the package's `deno` export condition to `esm/stripe.esm.worker.js`, which uses the fetch HTTP client and SubtleCrypto by default. Its types are in `esm/stripe.esm.worker.d.ts`.
- Runtime self-check: `Stripe.PACKAGE_VERSION === '23.0.0'` and `Stripe.API_VERSION === '2026-09-30.endive'`. Assert both in a deno test (§3).
- The real types live in the package's `.d.ts` files: `esm/lib.d.ts` (StripeConfig, RequestOptions), `esm/Webhooks.d.ts`, `esm/resources/Checkout/Sessions.d.ts`, `esm/resources/Accounts.d.ts`, `esm/resources/AccountLinks.d.ts`, `esm/resources/Refunds.d.ts`, `esm/resources/ApplicationFees.d.ts`, `esm/resources/Events.d.ts`. Run `deno info` to find the "npm modules cache" directory; the package is under `registry.npmjs.org/stripe/23.0.0/` inside it.
- `deno check` is the gate that catches invented parameter names. It does **not** catch wrong enum strings (see §2, item 2).

## 2. Your memory is probably wrong about…

| # | What you probably remember | What is true for endive / stripe@23 | What to do |
|---|---|---|---|
| 1 | `payment_method_types: ['card']` on Checkout / PaymentIntents | **Removed** from Checkout Session create, PaymentIntent create/update/confirm and SetupIntent create/update. It still exists on Payment Links, on Invoice/Subscription `payment_settings.payment_method_types`, and as a read-only field on the Session object. Per-request alternatives: `allowed_payment_method_types` (new on Checkout Session create in endive; on PaymentIntent/SetupIntent since stripe-node 22.4.0) and `excluded_payment_method_types` (already existed) | Never write the token `payment_method_types` (the guard flags it in `supabase/functions`, `apps` and `packages`; §13). Payment methods come from the platform's Connect payment-method settings in the Dashboard (human). **P1 decision:** delayed (async) methods such as bank debits and bank transfers stay **off** there (human: P0-00 in sandbox, P1-20 in live), and we send neither `allowed_payment_method_types` nor `excluded_payment_method_types`. If an async payment happens anyway, §7 handles it (`async_payment_failed` → `cancel`) |
| 2 | `ui_mode: 'hosted'`, `'embedded'`, `'custom'` | Renamed in 2026-03-25.dahlia: `hosted_page` (the default), `embedded_page`, `elements`, plus a new `form`. The old values fail **at runtime**. The type is `'elements' \| 'embedded_page' \| 'form' \| 'hosted_page' \| OtherString`, so **a wrong string still type-checks** | Use `ui_mode: 'hosted_page'`. A unit test on the param builder asserts the exact value. (Stripe.js `initEmbeddedCheckout` became `createEmbeddedCheckoutPage`; we do not use it) |
| 3 | `const stripe = Stripe('sk_...')` | `new Stripe(key, config)` has been mandatory since v22. The v23 README still shows the old form | Always `new Stripe(...)`, and only in `_shared/stripe.ts` |
| 4 | `stripe.accounts.create({ type: 'standard' })` | The `type` param is deprecated and Standard is legacy. Use `controller` properties | Use the snippet in §4 |
| 5 | `stripe.webhooks.constructEvent(...)` | The sync version throws `CryptoProviderOnlySupportsAsyncError` with SubtleCrypto (Deno). Old Supabase examples import `esm.sh/stripe@14` | `await stripe.webhooks.constructEventAsync(...)` on the **raw** body |
| 6 | "tolerance 0 means default" | Since v23, `tolerance = 0` **disables** the timestamp check. The default is 300 s | Never pass a tolerance; pass `undefined` if a later argument is needed |
| 7 | `maxNetworkRetries` defaults to 1 | The v23 code default is **2**; the README and JSDoc saying 1 are stale. The SDK also auto-adds an idempotency key to every POST | Set `maxNetworkRetries: 2` explicitly. Pass your own deterministic `idempotencyKey` for every create |
| 8 | `stripeAccount` is the only option | v23 JSDoc prefers `stripeContext`. The two are identical today, and `stripeAccount` will later be discouraged and dropped | **FROZEN: we use `stripeAccount`, and only inside `onAccount()` in `_shared/stripe.ts`.** Never write `stripeAccount:` or `stripeContext:` anywhere else |
| 9 | Account Links `type: 'account_update'` for editing details | `account_update` links **cannot be created** for accounts with Stripe-hosted Dashboard access, which includes our `stripe_dashboard.type: 'full'` accounts | Only use `account_onboarding`. Merchants edit their details in their own Stripe Dashboard |
| 10 | Every event goes through `constructEvent` | v2 "thin" events (`v2.core.*`) need `stripe.parseEventNotificationAsync()` and an Event Destination with its own secret. `constructEventAsync` throws on a `v2.core.event` payload | We use neither Accounts v2 nor thin events. If you see a `v2.` event type, stop and escalate |
| 11 | `stripe listen` forwards latest-shaped events | Without `--latest` it uses the account's default API version. One listen session prints **one** `whsec_...` that is shared by `--forward-to` and `--forward-connect-to` | `stripe listen --latest ...`. In local dev, both webhook secrets hold the same value |
| 12 | `Stripe.constructEventWithoutVerification` | The static was removed in v23. `stripe.webhooks.constructEventWithoutVerification` still exists | Never use it in production code: it skips the signature check |
| 13 | `import { ErrorType }` | Removed in v23 | `err instanceof Stripe.errors.StripeSignatureVerificationError` (also `StripeIdempotencyError`, `StripeInvalidRequestError`, `StripeConnectionError`, `StripeRateLimitError`, `StripePermissionError`) |
| 14 | Checkout Sessions live for 24 h | 24 h is only the default. `expires_at` can be set anywhere from 30 min to 24 h after creation (unix **seconds**) | We set now + 35 min (§6; architecture §9 — 5 min margin over Stripe's 30-min minimum for clock skew) |
| 15 | Response enums are closed | `controller.fees.payer` can also be `application_custom` or `application_express`; `capabilities.card_payments` is `active \| inactive \| pending`; every Stripe enum type ends in `\| OtherString` | Store Stripe-owned values as plain `text`. Do not put a CHECK constraint on them |
| 16 | `charge.refunds` is always present | It is optional on Charge (`refunds?:`) and not populated unless expanded | Use `stripe.refunds.list({ charge }, onAccount(acct))` |
| 17 | SDK JSDoc says "add `@ts-ignore` to use another API version" | We pin the matching version. `@ts-ignore` is banned | Never suppress types |

## 3. Client factory: `supabase/functions/_shared/stripe.ts` (exact code)

P0-03 creates this file exactly as written. The only allowed change is the import line, if ADR-0002 chooses the `deno.json` mapping. It requires `_shared/env.ts` to expose `env.STRIPE_SECRET_KEY` as a string getter that throws when the variable is missing. Adapt only that property access if P0-03's env API is shaped differently.

```ts
// supabase/functions/_shared/stripe.ts — the ONLY file that imports the Stripe SDK.
import Stripe from 'npm:stripe@23.0.0'; // or: import Stripe from 'stripe';  (deno.json mapping, per ADR-0002)
import { env } from './env.ts';

export { Stripe };

/** Build a client. Production code calls getStripe(); tests may call this with a fake key. */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2026-09-30.endive',
    maxNetworkRetries: 2,
  });
}

let client: Stripe | undefined;

/** Lazy singleton. Reading env at import time would break `deno test`. */
export function getStripe(): Stripe {
  client ??= createStripeClient(env.STRIPE_SECRET_KEY);
  return client;
}

/** Request options for a call ON a connected account: Checkout, refunds, disputes, charges, re-fetches. */
export function onAccount(stripeAccountId: string, idempotencyKey?: string): Stripe.RequestOptions {
  if (!/^acct_[A-Za-z0-9]+$/.test(stripeAccountId)) {
    throw new Error('onAccount: expected a connected account id (acct_...)');
  }
  return idempotencyKey === undefined
    ? { stripeAccount: stripeAccountId }
    : { stripeAccount: stripeAccountId, idempotencyKey };
}

/** Request options for a call on the PLATFORM account: accounts.create, applicationFees.*. */
export function onPlatform(idempotencyKey: string): Stripe.RequestOptions {
  return { idempotencyKey };
}

/** SubtleCrypto provider for webhook signature checks (Deno). */
export const webhookCryptoProvider = Stripe.createSubtleCryptoProvider();
```

Required deno tests (`_shared/stripe.test.ts`) check that:
- `Stripe.PACKAGE_VERSION` is `'23.0.0'` and `Stripe.API_VERSION` is `'2026-09-30.endive'`;
- `onAccount('acct_123', 'k')` deep-equals `{ stripeAccount: 'acct_123', idempotencyKey: 'k' }`;
- `onAccount('cus_123')` throws.

Which scope each call needs:

| Object lives on | Examples | Request options |
|---|---|---|
| Connected account (the shop) | `checkout.sessions.*`, `paymentIntents.*`, `charges.*`, `refunds.*`, `disputes.*` | `onAccount(acct, key?)` |
| Platform | `accounts.create`, `accounts.retrieve(acct)`, `accountLinks.create`, `applicationFees.*`, `webhookEndpoints.*`, phase-2 billing | none, or `onPlatform(key)` |

Amounts in Stripe are integer minor units, so pence go in unchanged: `unit_amount: 45` means £0.45. Never multiply or divide by 100. Currency is always lowercase `'gbp'`.

## 4. Connected account creation (Accounts v1 + controller)

This lives in `connect-onboarding` (owner only). Call it only when the shop has no `stripe_accounts` row. Insert the row immediately after creation, in the same request.

```ts
const account = await getStripe().accounts.create(
  {
    country: 'GB',
    email: ownerEmail,
    business_profile: { name: shop.name, url: `${env.APP_STOREFRONT_URL}/${shop.slug}` },
    controller: {
      fees: { payer: 'account' },            // shop pays Stripe fees → no Connect fees for the platform
      losses: { payments: 'stripe' },        // Stripe, not the platform, covers negative balances
      requirement_collection: 'stripe',      // Stripe collects KYC
      stripe_dashboard: { type: 'full' },    // shop gets the full Stripe Dashboard (Standard-equivalent)
    },
    metadata: { shop_id: shop.id },
  },
  onPlatform(`acct-create-${shop.id}`),
);
```

- Do not pass `type`. Do not use Accounts v2 (`stripe.v2.core.accounts`); that would need an ADR.
- [H] Do not request capabilities. The API requires `capabilities` only when `stripe_dashboard.type` is `none`; for full-dashboard accounts Stripe is expected to request `card_payments` itself (UNVERIFIED-LIVE). If it is missing after onboarding, escalate.
- Idempotency keys are kept for at least 24 h, so the real guard against duplicates is "a row already exists in `stripe_accounts`". The key only protects concurrent double-clicks. Reusing the key with different params (for example a changed email) raises `StripeIdempotencyError`; return 409.
- [H] Stripe may reject a non-public `business_profile.url` such as `localhost`. In local dev, omit `url` if it fails, and note it in PROGRESS.md.

Sync these fields after create, on `account.updated`, and on the return route. Always write the full current snapshot:

| `stripe_accounts` column | From `Stripe.Account` |
|---|---|
| `stripe_account_id` | `account.id` |
| `charges_enabled` | `account.charges_enabled` |
| `payouts_enabled` | `account.payouts_enabled` |
| `details_submitted` | `account.details_submitted` |
| `card_payments_status` (text) | `account.capabilities?.card_payments ?? null` |
| `requirements_currently_due` (jsonb) | `account.requirements?.currently_due ?? []` |
| `disabled_reason` (text) | `account.requirements?.disabled_reason ?? null` |
| optional controller info (text only) | `account.controller?.fees?.payer`: can be `account`, `application`, `application_custom`, `application_express`, or a future value |

## 5. Onboarding with Account Links, and readiness

```ts
const link = await getStripe().accountLinks.create({
  account: stripeAccountId,
  type: 'account_onboarding',
  refresh_url: `${env.APP_MERCHANT_URL}/settings/payments/refresh`,
  return_url: `${env.APP_MERCHANT_URL}/settings/payments/return`,
});
return json({ url: link.url }); // the browser navigates to link.url
```

- Links are **single-use** and short-lived (see `link.expires_at`). Chat-app link previews can consume them. Never store, email or log a link; mint one per click.
- `refresh_url` is hit when the link has expired or was already used. The merchant-app route (authenticated, owner) calls `connect-onboarding` again and redirects to the new URL. The route can carry the shop id, but the function **must** re-check that the caller is the owner of that shop. There is never a public endpoint that mints links.
- `return_url` is hit when the merchant leaves **or** completes onboarding. Reaching it does **not** mean the account is ready. The route asks the server to `accounts.retrieve(acct)`, sync §4's fields, and show the result. `account.updated` (§7) remains the source of truth.
- Only `account_onboarding` links are allowed (see §2, item 9).

**Readiness rule (FROZEN):** `charges_enabled === true && card_payments_status === 'active'`. Until both hold, `create-checkout` returns `503 PAYMENTS_NOT_READY`, and the platform-admin "go live" action is refused.

**Requirements banner** (merchant Payments page, en-GB and zh-CN dictionaries): show it when `requirements_currently_due` is non-empty, `disabled_reason` is not null, or `charges_enabled` is false. Actions: "Continue Stripe setup", which mints a fresh `account_onboarding` link, and "Open your Stripe Dashboard" (`https://dashboard.stripe.com/`). [H] If Stripe refuses an onboarding link for an already-onboarded account, show only the Dashboard action and note it in PROGRESS.md.

**Deauthorization** (`account.application.deauthorized`): set `deauthorized_at = now()` and `charges_enabled = false`, and stop calling Stripe for that account. Stripe will refuse those calls with permission errors.

## 6. Checkout Session (hosted page, direct charge)

The pure builder lives in `create-checkout/params.ts`: no env, no clock, no I/O. The P1-11 card may fix a different signature; the field values below are mandatory either way.

```ts
import { onAccount, type Stripe } from '../_shared/stripe.ts';

export const CHECKOUT_TTL_SECONDS = 35 * 60; // Stripe allows 30 min .. 24 h; +5 min margin for clock skew (architecture §9)

export function buildCheckoutSessionParams(
  order: CheckoutOrder,   // id, shopId, publicToken, customerEmail, checkoutAttempt, deliveryFeePence, serviceFeePence, tipPence, applicationFeePence, totalPence
  lines: CheckoutLine[],  // name, quantity, unitAmountPence (unit price incl. options), lineTotalPence
  shop: CheckoutShop,     // slug, stripeAccountId
  now: Date,
  storefrontUrl: string,  // APP_STOREFRONT_URL, passed in by the caller
): { params: Stripe.Checkout.SessionCreateParams; options: Stripe.RequestOptions } {
  const money = (name: string, pence: number, quantity = 1): Stripe.Checkout.SessionCreateParams.LineItem => ({
    quantity,
    price_data: { currency: 'gbp', unit_amount: pence, product_data: { name } },
  });
  const lineItems = lines.map((l) => {
    if (l.unitAmountPence * l.quantity !== l.lineTotalPence) throw new Error('line total mismatch');
    return money(l.name, l.unitAmountPence, l.quantity);
  });
  if (order.deliveryFeePence > 0) lineItems.push(money('Delivery', order.deliveryFeePence));
  lineItems.push(money('Service fee', order.serviceFeePence));
  if (order.tipPence > 0) lineItems.push(money('Tip', order.tipPence));
  const sum = lineItems.reduce((s, li) => s + (li.price_data?.unit_amount ?? 0) * (li.quantity ?? 0), 0);
  if (sum !== order.totalPence) throw new Error('line items do not add up to order total');

  return {
    params: {
      mode: 'payment',
      ui_mode: 'hosted_page',
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: order.applicationFeePence, // = service fee (architecture §5 rule 8)
        metadata: { order_id: order.id, shop_id: order.shopId },
      },
      metadata: { order_id: order.id, shop_id: order.shopId },
      client_reference_id: order.id,
      customer_email: order.customerEmail,
      expires_at: Math.floor(now.getTime() / 1000) + CHECKOUT_TTL_SECONDS, // unix SECONDS
      success_url: `${storefrontUrl}/o/${order.publicToken}`,
      cancel_url: `${storefrontUrl}/${shop.slug}/basket`,
    },
    options: onAccount(shop.stripeAccountId, `checkout-${order.id}-${order.checkoutAttempt}`),
  };
}
```

At the call site:

```ts
const { params, options } = buildCheckoutSessionParams(order, lines, shop, new Date(), env.APP_STOREFRONT_URL);
const session = await getStripe().checkout.sessions.create(params, options);
if (session.url === null) throw new Error('Checkout Session has no url');
// save session.id → orders.checkout_session_id; session.expires_at (unix s) → orders.checkout_expires_at
return json({ url: session.url, token: order.publicToken });
```

Rules:
- Never include `payment_method_types` and never add `customer`. Do not use `discounts`; P1 has none.
- [H] `expires_at = now + 35 min` stays 5 min above the documented 30-min minimum, so clock skew cannot push it below. P1-11's sandbox smoke confirms that Stripe accepts it. If Stripe rejects it (for example because of clock skew), write a `## Blockers` entry in PROGRESS.md and stop; changing the TTL needs an ADR.
- `application_fee_amount` must be a positive integer below the charge total. The spec only says the fee is "capped at the total amount captured".
- `statement_descriptor_suffix` is optional (`payment_intent_data`, ≤ 22 chars, cards only). It is appended to the shop's prefix, and only the first 22 characters of the combined descriptor are shown. P1 default: omit it. **Never** set `payment_intent_data.statement_descriptor`, which errors on card charges.
- Same idempotency key + same params replays the **same** session, even an expired one, for at least 24 h. To create a new session for the same order, increment `orders.checkout_attempt` first. Same key + different params raises `StripeIdempotencyError`.
- Fulfil **only** in the webhook, and only when `session.payment_status === 'paid'`. The `success_url` page just polls `order-status`; it never marks anything paid.
- If the customer cancels, the order stays `pending_payment` until `checkout.session.expired` arrives. A new basket submission creates a new order.
- [H] Whether Checkout accepts a line with `unit_amount: 0` (a free item or option) is unverified. Test it in sandbox before relying on it.
- Unit tests for the builder must assert the exact `Object.keys(params)` list, which proves no unexpected or removed params are present without naming them, plus `ui_mode === 'hosted_page'`, the fee, `expires_at = now + 2100`, the URLs, the idempotency key, `options.stripeAccount`, and the line sum.

Error mapping for `create-checkout`:
- `StripeIdempotencyError` → 409.
- `StripePermissionError` on the account (deauthorized) → 503 `PAYMENTS_NOT_READY`.
- `StripeConnectionError`, `StripeAPIError`, `StripeRateLimitError` → 503, retryable.
- `StripeInvalidRequestError` → 502. This is a bug: log `err.code` and `err.param` (never the payload).

## 7. Webhooks

| Function | Endpoint `connect` | Secret env var | Subscribe to exactly |
|---|---|---|---|
| `stripe-webhook-connect` | `true` (events from connected accounts; carry `event.account`) | `STRIPE_WEBHOOK_SECRET_CONNECT` | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `account.updated`, `account.application.deauthorized` |
| `stripe-webhook-platform` | `false` (your account) | `STRIPE_WEBHOOK_SECRET_PLATFORM` | `application_fee.created`, `application_fee.refunded` (phase 2 adds billing events, §12) |

- Both endpoints are created by a human with `api_version: '2026-09-30.endive'`: sandbox/dev in P0-00/P1-09, live in P1-20. The URL is `https://<project-ref>.supabase.co/functions/v1/<function>`. The API params are `url`, `connect`, `api_version`, `enabled_events[]`. The response's `secret` (`whsec_...`) is returned **only at creation** and goes into Supabase secrets (human).
- `supabase/config.toml` must contain:

```toml
[functions.stripe-webhook-connect]
verify_jwt = false

[functions.stripe-webhook-platform]
verify_jwt = false
```

(Stripe sends no Supabase JWT, so the signature is the authentication.)

Handler skeleton (shape mandatory, names illustrative). `createServiceClient` stands for the service client from `_shared/supabase.ts` (P0-03):

```ts
// supabase/functions/stripe-webhook-connect/index.ts
import { getStripe, webhookCryptoProvider, type Stripe } from '../_shared/stripe.ts';
import { env } from '../_shared/env.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { handleConnectEvent, makeDeps } from './handler.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const signature = req.headers.get('stripe-signature');
  if (signature === null) return new Response('missing signature', { status: 400 });
  const rawBody = await req.text(); // RAW text. Never req.json() or re-serialise before verifying.
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      rawBody, signature, env.STRIPE_WEBHOOK_SECRET_CONNECT, undefined, webhookCryptoProvider,
    );
  } catch {
    return new Response('bad signature', { status: 400 });
  }
  const deps = makeDeps(createServiceClient(), getStripe());
  if ((await deps.events.begin(event)) === 'duplicate') return new Response('ok', { status: 200 });
  try {
    await handleConnectEvent(event, deps); // DB writes + at most a few Stripe re-fetches; no SMS/email here
    await deps.events.markProcessed(event.id);
    return new Response('ok', { status: 200 });
  } catch (err) {
    await deps.events.markFailed(event.id, err instanceof Error ? err.message : 'unknown');
    return new Response('handler error', { status: 500 }); // Stripe will retry
  }
});
```

In tests, put the `Deno.serve` callback in a factory (for example `createWebhookHandler({ secret, stripe, deps })` in `handler.ts`) so that `index.ts` is only `Deno.serve(createWebhookHandler(realDeps))` and tests can inject fakes.

Dedupe (`deps.events.begin`):

```sql
insert into public.stripe_events (event_id, type, account, livemode, api_version, received_at)
values ($1, $2, $3, $4, $5, now())
on conflict (event_id) do nothing;
select processed_at from public.stripe_events where event_id = $1;
-- processed_at not null → 'duplicate' (return 200, do nothing)
-- otherwise             → run the handler (first delivery or retry after a failure)
```

Routing: `switch (event.type)`. `Stripe.Event` is a discriminated union, so each `case` narrows `event.data.object`. For a missing `event.account` or an unknown type, record the event and return 200.

| Event | Look up | Action (every write idempotent) |
|---|---|---|
| `checkout.session.completed`, `…async_payment_succeeded` | order by `checkout_session_id = session.id` (never by metadata alone) | Require `event.account === order.stripe_account_id`, `session.amount_total === order.total_pence` and `session.currency === 'gbp'`; otherwise record the error, do not transition, return 200. If `session.payment_status !== 'paid'`, do nothing (an async method; wait). If `order.payment_status !== 'unpaid'`, do nothing: the golden tests make `payment_succeeded` ILLEGAL once paid. Otherwise run core `transition(order, { type: 'payment_succeeded' })`, store `payment_intent_id`, and enqueue outbox `order.placed`. If the result has `requiresRefund` (late payment on an expired or cancelled order), refund in full at once (§8, `initiated_by: 'platform'`) |
| `checkout.session.async_payment_failed` | same | If the order is still `pending_payment`, run `transition(order, { type: 'cancel', reason: 'async_payment_failed' })` (the reason is mandatory — the P1-02 golden tests reject an empty one). Delayed payment methods should be switched off in the Connect payment-method settings, so this is a safety net |
| `checkout.session.expired` | same | If the order is still `pending_payment`, run `transition(order, { type: 'checkout_expired' })`; otherwise do nothing |
| `charge.refunded` | order by `payment_intent_id = charge.payment_intent` | Re-fetch with `charges.retrieve(charge.id, undefined, onAccount(acct))`. Set `refunded_pence = charge.amount_refunded` (absolute, never `+=`). Upsert refunds from `refunds.list({ charge: charge.id, limit: 100 }, onAccount(acct))` with insert-if-absent on `stripe_refund_id`; `initiated_by` = `refund.metadata.initiated_by`, or `'stripe_dashboard'` when absent. If the order is paid, set `payment_status = paymentStatusAfterRefund(...)`. If `charge.refunded === true`, run the application-fee top-up (§8) |
| `charge.dispute.*` | order by `payment_intent_id = dispute.payment_intent` | Re-fetch with `disputes.retrieve(dispute.id, undefined, onAccount(acct))` and write `dispute_status = dispute.status`. On `created`, enqueue outbox `order.disputed` (§9). Do not touch `status` or `payment_status` |
| `account.updated` | `stripe_accounts` by `event.account` | Re-fetch with `accounts.retrieve(event.account)` (platform call, no `onAccount`), write §4's snapshot, and set `updated_from_event_id = event.id` |
| `account.application.deauthorized` | `stripe_accounts` by `event.account` (`data.object` is an **Application**, not the Account) | §5 deauthorization |
| `application_fee.created` / `.refunded` (platform endpoint) | `fee.account` + `fee.charge` → `charges.retrieve(fee.charge, undefined, onAccount(fee.account))` → order by `payment_intent_id` | Upsert `platform_fee_ledger` (`application_fee_id` unique, `amount_pence = fee.amount`, `refunded_pence = fee.amount_refunded`) and set `orders.application_fee_id`. If no order matches yet (out-of-order across endpoints), throw, so the 500 makes Stripe retry |

Delivery rules:
- **At-least-once.** Duplicates and retries happen: live retries run for up to 3 days with backoff (UNVERIFIED-LIVE), sandboxes retry less. Concurrent duplicates can both pass `begin`, so the real guard is conditional writes (`update … where id = $1 and status = 'pending_payment'`), unique keys and upserts.
- **Out of order.** Never use `event.created` to order events. Write absolute values, re-fetch the current object where the table says so, and make every handler reach the same final state whatever the order. The P1-12 out-of-order test (refund before completed) enforces this.
- Make the order update and its outbox insert **one SQL function** (rpc) so they commit together. Side effects (SMS, email, print) happen only in the outbox processor.
- Return 200 quickly. Log only `event.id`, `event.type` and `event.account`, never the payload, which contains customer PII.
- Do not branch on `event.api_version`; store it. Endpoints are created with endive, and dev uses `--latest`.
- [H] That `application_fee.created` arrives at the **platform** endpoint is inferred from where the object lives; Stripe's docs do not say so. Confirm it in sandbox with `stripe listen --latest` and record the result in PROGRESS.md. If it arrives on the connect side, stop and escalate.

## 8. Refunds

Refund policy (FROZEN, architecture §9): **full refund → `refund_application_fee: true`; partial refund → `false`**. A charge that ends fully refunded through several partial refunds counts as a full refund: the `charge.refunded` top-up below returns the fee. Stripe keeps its original processing fee either way (UNVERIFIED-LIVE; no refund fee on standard pricing). The shop bears that cost.

```ts
// refund-order (manager+), merchant reject, auto-reject, late payment. Always on the connected account.
const isFull = order.refunded_pence === 0 && amountPence === order.total_pence;
const refund = await getStripe().refunds.create(
  {
    payment_intent: order.payment_intent_id,
    ...(isFull ? {} : { amount: amountPence }), // omit amount for a full refund
    refund_application_fee: isFull,
    metadata: { order_id: order.id, initiated_by: initiatedBy, reason_code: reasonCode },
  },
  onAccount(order.stripe_account_id, `refund-${order.id}-${n}`),
);
```

- `n` is the 1-based sequence number of this platform refund for the order. A retry of the **same** logical request must reuse the same `n`, so that the key replays instead of refunding twice. Rule (adopted by P1-15): the client sends the refund count it saw; the server refuses with 409 if that is stale, and otherwise uses `n = count + 1`.
- Put our reason codes (`item_missing`, `wrong_item`, `late`, `quality`, `customer_request`, `other`) in `metadata`. Leave Stripe's `reason` unset; never send `'fraudulent'`, which has Radar side effects.
- `initiated_by` metadata is `merchant_app`, `auto_reject` or `platform`. Its absence on a refund means it was made in the shop's own Dashboard (§7).
- Insert the `refunds` row right after a successful create. The final `payment_status` is synced by `charge.refunded`.

**Only the platform can refund the application fee.** The spec says "An application fee can be refunded only by the application that created the charge". A merchant who refunds in their own Stripe Dashboard does **not** return the 45p. To keep the "full refund → fee returned" policy true for every refund source, the `charge.refunded` handler tops up:

```ts
// connect webhook, after re-fetching the charge; charge.application_fee is the fee id (string) on direct charges
if (charge.refunded && typeof charge.application_fee === 'string') {
  const fee = await getStripe().applicationFees.retrieve(charge.application_fee); // platform object: NO onAccount()
  const remaining = fee.amount - fee.amount_refunded;
  if (remaining > 0) {
    await getStripe().applicationFees.createRefund(
      fee.id,
      { amount: remaining, metadata: { order_id: order.id } },
      onPlatform(`appfee-refund-${order.id}`),
    );
  }
}
```

The verified v23 signature is `applicationFees.createRefund(id: string, params?: ApplicationFeeCreateRefundParams, options?: RequestOptions)`. Request options must be the third argument; pass `undefined` as params if you have none. Reading the fee first makes retries safe, because `remaining` becomes 0 after success.

## 9. Disputes

- On a direct charge, the **shop's** connected account bears the disputed amount and Stripe's dispute fee. Stripe debits the shop's balance first. Because `losses.payments = 'stripe'`, Stripe and not the platform covers a negative balance (UNVERIFIED-LIVE; consistent with the spec's definition of `losses.payments`).
- Dispute fee: **£20 per dispute, not returned** (UNVERIFIED-LIVE). A separate "countered" fee and Smart Disputes pricing exist in the US and are doubtful for GB. Never quote them.
- Platform policy (FROZEN, changeable only by ADR): **the platform keeps the 45p** on disputes. Do not call `applicationFees.createRefund` for disputes. Whether Stripe returns the fee on its own is unknown and not relied on.
- Product behaviour: set `orders.dispute_status`, enqueue outbox `order.disputed`, and notify the merchant (SMS/email via outbox) that they must respond **in their own Stripe Dashboard** before `dispute.evidence_details.due_by` (unix seconds). The platform submits no evidence in P1.
- `dispute.status` values: `warning_needs_response`, `warning_under_review`, `warning_closed`, `needs_response`, `under_review`, `won`, `lost`, `prevented`, and future values. Store them as text.

## 10. Testing

**Stripe CLI (local dev, human logged in with `stripe login`):**

```bash
stripe listen --latest \
  --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook-platform \
  --forward-connect-to http://127.0.0.1:54321/functions/v1/stripe-webhook-connect
# prints ONE "whsec_..." → the human puts it into BOTH STRIPE_WEBHOOK_SECRET_PLATFORM and
# STRIPE_WEBHOOK_SECRET_CONNECT of the local functions env file (agents never read .env files)

stripe trigger checkout.session.completed --stripe-account acct_...
```

- 54321 is the default local Supabase API port; check it with `supabase status`.
- `stripe trigger` creates fixture objects that match no order. Expected result: 200, a `stripe_events` row, no order change. It is a smoke test only.
- Full flow in sandbox: use a seeded live shop linked to a sandbox connected account, call `create-checkout`, open the URL, pay with a test card, then confirm the order is `placed`, the outbox row exists and the ledger row exists.
- Capture real sandbox payloads for fixtures (Dashboard event log or the CLI) and strip personal data. Hand-written fixtures may contain only the fields the handler reads (§7 table).

**Signed payloads in deno tests.** stripe@23 has `Stripe.webhooks.generateTestHeaderStringAsync` (verified in `esm/Webhooks.d.ts`; it also exists on the instance):

```ts
import { Stripe, webhookCryptoProvider } from '../_shared/stripe.ts';

const TEST_SECRET = 'whsec_test'; // keep it short: the secret-literal guard flags whsec_ + 16 alphanumerics

export async function signedRequest(payload: string, secret = TEST_SECRET, timestamp?: number): Promise<Request> {
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
    cryptoProvider: webhookCryptoProvider,
    ...(timestamp === undefined ? {} : { timestamp }), // unix SECONDS; default = now
  });
  return new Request('http://localhost/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
    body: payload,
  });
}
```

Fallback, if the helper is ever unavailable. The scheme is HMAC-SHA256 over `${t}.${payload}`, keyed with the full secret string, and the header is `t=<t>,v1=<hex>`:

```ts
async function stripeSignature(payload: string, secret: string, t: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`)));
  return `t=${t},v1=${Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
```

Required webhook tests (P1-09 / P1-12):
1. A valid signature returns 200, and the event is recorded once.
2. A tampered body, the wrong secret, or `timestamp = now − 400` each return 400.
3. **Replay:** posting the same signed payload twice returns 200 both times, with side effects exactly once (one transition, one outbox row).
4. **Out of order:** `charge.refunded` before `checkout.session.completed` reaches the same final state as the normal order.
5. `payment_status: 'unpaid'` on `completed` causes no transition.
6. An `event.account` that differs from the order's account causes no transition.
7. An unknown event type returns 200 and is recorded.

Handlers get a fake Stripe client and a fake repository. Unit tests never call the network. A client built with `createStripeClient('sk_test_fake')` is enough for signature checks, which run locally.

**Test cards** (standard Stripe test numbers from docs.stripe.com/testing; not re-fetched in this research run). Use any future expiry date, any CVC and any postcode:

| Card | Behaviour |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3DS authentication (SCA) |
| `4000 0000 0000 9995` | Declined: insufficient funds |
| `4000 0000 0000 0259` | Succeeds, then a dispute is opened (fraudulent) |

## 11. Pricing facts (for humans' business maths; **never** hard-code into code or merchant copy)

Any merchant-facing text must link to `https://stripe.com/gb/pricing` instead of quoting a rate. Agents must not put these numbers into UI strings, constants or emails.

| Item | Figure | Status |
|---|---|---|
| Standard UK consumer cards | 1.5% + 20p | UNVERIFIED-LIVE |
| Premium UK cards | 1.9% + 20p | UNVERIFIED-LIVE |
| EEA cards | 2.5% + 20p | UNVERIFIED-LIVE |
| International cards | 3.25% + 20p, plus 2% if currency conversion | UNVERIFIED-LIVE |
| Apple Pay / Google Pay | priced as the underlying card | UNVERIFIED-LIVE |
| Refund | no fee to refund; the original processing fee is not returned | UNVERIFIED-LIVE |
| Dispute | £20 per dispute, not returned | UNVERIFIED-LIVE |
| Dispute "countered" fee £20 / Smart Disputes 30% | US-origin, doubtful in GB | UNVERIFIED-LIVE, do not use |
| Connect, Stripe handles pricing (our model: `fees.payer = 'account'`) | £0 Connect fees for the platform | UNVERIFIED-LIVE |
| Connect, platform handles pricing (not our model) | £2 per monthly active account + 0.25% + 10p per payout | UNVERIFIED-LIVE |
| Instant Payouts | the merchant pays Stripe directly under our model; the "1%, min £0.40" figure came from a different product page | UNVERIFIED-LIVE, doubtful |
| Stripe Billing (phase 2) | 0.7% of Billing volume, pay-as-you-go | UNVERIFIED-LIVE |
| Stripe Tax | 0.5% per transaction or 50¢ (USD); may be outdated | UNVERIFIED-LIVE |
| Worked example | £20.45 charge on a standard UK card: Stripe fee ≈ 51p, shop nets ≈ £19.49, platform gets 45p. The shop also pays Stripe's % on the 45p | Arithmetic checked; Stripe's rounding unverified |

A GB pricing-page extract said "Connect users may not pass dispute fees to Connected Accounts". Its context could not be seen, and it probably concerns platforms that handle pricing. A human must check it.

## 12. Phase-2 SaaS billing outline (**NOT for phase 1**: no code, no migrations, no events until a P2 card exists)

- All on the **platform** account (no `onAccount`). One Stripe Customer per shop (`metadata.shop_id`), with the id stored on the shop.
- Prices are created once by a human in the Dashboard: a recurring £39/month price (`unit_amount` 3900, `gbp`, monthly) and a one-time £149 price (14900).
- Subscription (shape only):

```ts
await getStripe().subscriptions.create(
  { customer, items: [{ price: MONTHLY_PRICE_ID }], add_invoice_items: [{ price: SETUP_PRICE_ID }], default_tax_rates: [VAT_RATE_ID] },
  onPlatform(`sub-create-${shopId}`),
);
```

- The founder offer (setup waived + 3 months free) would drop `add_invoice_items` and use a trial; a human decides how.
- VAT: only if the legal entity is VAT-registered. A human creates a 20% exclusive GB tax rate (or uses Stripe Tax), and an accountant confirms first.
- Do not set `payment_settings.payment_method_types`, even though it still exists on subscriptions and invoices: the guard flags the token. Configure invoice payment methods in the Dashboard.
- Platform endpoint events to add: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.

## 13. Banned patterns (mirrors `scripts/guards/banned-patterns.mjs`; no inline suppression; exceptions only via human-edited `allowlist.json`)

| Rule id | Catches | Do instead |
|---|---|---|
| `stripe-payment-method-types` | the token `payment_method_types` in `supabase/functions`, `apps`, `packages` | Remove it; payment methods come from Dashboard settings |
| `stripe-ui-mode-legacy` | `ui_mode: 'hosted' \| 'embedded' \| 'custom'` | `ui_mode: 'hosted_page'` |
| `stripe-account-type` | `type: 'standard' \| 'express' \| 'custom'` in a file containing `accounts.create` | `controller` properties (§4) |
| `stripe-no-new` | `Stripe(` without `new` | `new Stripe(key, { apiVersion, maxNetworkRetries })`, only in `_shared/stripe.ts` |
| `stripe-sync-construct-event` | `.constructEvent(` in functions | `await stripe.webhooks.constructEventAsync(rawBody, sig, secret, undefined, webhookCryptoProvider)` |
| `stripe-unpinned-import` | `esm.sh/stripe`, `deno.land/x/stripe`, `npm:stripe` without `@23.0.0` | `npm:stripe@23.0.0` (inline or in `deno.json`) |
| `stripe-api-version` | `apiVersion: '<anything but 2026-09-30.endive>'` | `apiVersion: '2026-09-30.endive'` |
| `stripe-init-embedded` | `initEmbeddedCheckout` | Not used in MVP (hosted Checkout) |
| `stripe-tolerance-zero` | `constructEventAsync(…, 0)` | Omit the tolerance, or pass `undefined` |
| `secret-literal` | `sk_/rk_live\|test_` + 16 chars, `whsec_` + 16, `sb_secret_` + 16, in code, config and Markdown files under `apps/`, `packages/`, `supabase/`, `e2e/`, `scripts/`, `docs/`, `.github/` (tests and docs included) | Env vars / Supabase secrets; in tests use short dummies like `whsec_test` |
| `service-role-in-browser` | `STRIPE_SECRET_KEY`, service-role keys in `apps/` | Stripe calls only in edge functions |
| `money-float` | `parseFloat(`, `.toFixed(` in core and functions | Integer pence; `formatPence` for display |
| `ts-suppress`, `deno-ignore`, `eslint-disable` | type/lint suppression | Fix the types; they are how invented Stripe APIs get caught |

`stripeAccount` / `stripeContext` outside `onAccount()` is guard-enforced (rule `stripe-account-option`: `supabase/functions/**` except `_shared/stripe.ts` and `*.test.ts`). Also forbidden by this file (not yet guard-enforced): Accounts v2 / `stripe.v2.*`, `account_update` links, `payment_intent_data.statement_descriptor`, logging webhook payloads, and marking orders paid anywhere except the webhook.

## Former open questions (all resolved; numbers kept because task cards cite them)

| # | Topic | Where the answer lives |
|---|---|---|
| 1 | `expires_at` = now + 35 min (resolved: architecture §9) | §6 Rules ([H]); P1-11's sandbox smoke confirms Stripe accepts it |
| 2 | `Tip` line when `tipPence > 0` | §6 builder; adopted by P1-11 |
| 3 | Guard for `stripeAccount`/`stripeContext` | §13 "Also forbidden" (human guard follow-up) |
| 4 | Delayed payment methods | §2 item 1 (P1 decision: off in Dashboard settings; no per-request params) |
| 5 | Stripe-owned enums | §2 item 15: plain `text`, no CHECK; adopted by P1-05 |
| 6 | Refund idempotency `n` | §8; adopted by P1-15 |
| 7 | `application_fee.created` routing | §7 ([H]); P1-12 confirms it in sandbox |
| 8 | Full refund through several partial refunds | §8: counts as a full refund, so the fee is returned |
