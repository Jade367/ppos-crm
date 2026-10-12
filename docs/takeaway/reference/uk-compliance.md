# UK compliance rules for product behaviour (agent-facing)

> **给老板的中文摘要（本文件主体是写给编码 AI 的英文规则；这不是法律意见）**
>
> - **45p 服务费必须一开始就看得到（DMCC Act 2024，2025-04-06 起生效）。** 菜单上常驻提示、每个菜的加购处也提示、购物篮总价从第一件起就包含 45p、结账逐项列出。最稳妥的替代方案是把 45p 并进菜价（需要写 ADR）。上线前请律师按 CMA209 **最新版**原文书面确认。罚款最高为 £300,000 或全球营业额的 10%，取较高者。
> - **名字只能叫 "service fee"。** 不能叫 card fee 或 surcharge（2018 年起对个人卡加收附加费违法），也不能叫 service charge（小费法）。小费默认 £0；平台一分不拿，全部交给店铺，店铺必须 100% 分给员工（小费法）。
> - **结账页：** 按钮写 "Place order and pay £X.XX"；必须告诉顾客"不能取消"；不能预选任何收费项；店铺电话不能是收费号码。
> - **每页底部**显示店铺法定身份：名称、地址、邮箱、电话、公司号、VAT 号。有限公司和 LLP 还要写注册办公地址和注册地（英格兰和威尔士 / 苏格兰 / 北爱尔兰）。
> - **14 种过敏原：** 每个菜、每个加料选项都要填完才能上架。下单前、厨房小票、确认邮件都要显示。厨房小票留在厨房；要让顾客在送达时也有书面信息，小票要多打一联放进袋子，否则以确认邮件为准。店里提前包好的食品还要遵守 Natasha's Law，签约时提醒店主。
> - **P1 不卖酒和限龄商品，不放任何非必要 cookie 或追踪代码。**
> - **VAT：** 菜品冷热分类和 45p 的 VAT 性质，请会计确认。
> - **隐私：** 在店铺网站上，店铺是数据控制者（controller），平台是处理者（processor），双方要签 DPA（这是建议的分工，需律师确认，见第 18 节律师第 8 题）。以后做跨店营销，需要顾客单独同意。
> - **上线前**必须完成第 17 节的清单（包括 CRM 加固 P0-B2、P0-B3、P0-B4 全部合并并生效，以及试点店签好商户平台协议），并把第 18 节的问题交给律师和会计。
> - **状态标记：** verified 表示两轮研究结论一致，但复核时无法访问政府网站原文；verified (single source) 表示只有复核方凭自己的知识给出、原研究没有提到，可以照着做，但写进顾客文案前要律师确认；needs lawyer 表示需要律师或会计确认；unverified 表示未核实，不能依赖。

Status: reference, agent-readable, human-maintained (PROTECTED). Researched 2026-10-11. **This is not legal or tax advice.** Every rule marked `needs lawyer` / `needs accountant` must be signed off by a qualified UK professional before the pilot goes live (P1-20).
If this file and `architecture.md` ever disagree, `architecture.md` wins. Report the conflict in `PROGRESS.md` → `## Proposed doc changes`.

## 0. How to use this file

**Status legend**

| Status | Meaning |
|---|---|
| `verified` | The research report and the independent verifier agree. Caveat: the verifier could not reach gov.uk, legislation.gov.uk, food.gov.uk or ico.org.uk live (egress blocked). "Verified" means "consistent across two independent research passes", not "checked against the primary text today". |
| `verified (single source)` | Stated by the verifier from knowledge only; not in the original report and not checked live. Fine to build on; the lawyer confirms it before it is cited in customer copy. |
| `needs lawyer` / `needs accountant` | The legal basis is clear enough to build, but the exact wording, the interpretation or a business decision needs a UK professional. |
| `unverified` | Could not be checked. Do not cite it in customer-facing copy, and do not build on it without a primary source. |

A row may carry two parts, e.g. `verified; wording → lawyer`. Keywords: **MUST / MUST NOT** are launch-blocking for the phase shown. **SHOULD** is strongly recommended.

**Rules for agents**

1. Implement only the rules whose *Implemented in* column lists your task ID. Rules for later phases are context, not work.
2. Put the rule ID in the test name, so reviewers can grep for it, e.g. `it('UKC-PRICE-03 basket total includes the service fee from the first item', …)`.
3. Customer-facing copy lives only in `apps/storefront/src/i18n/en-GB.ts` and the legal templates in `apps/storefront/src/legal/`. Strings quoted here are **drafts**. Every legal template keeps a visible `LAWYER REVIEW REQUIRED` marker in its source until a human removes it.
4. Never decide a legal question yourself. If a rule seems to need a schema, pricing or legal change outside your card, write it under `## Blockers` in `PROGRESS.md` and stop (AGENTS.md §5).
5. All money shown to customers comes from core `priceOrder` and `formatPence` (architecture §4–§5). Never hard-code `£0.45`; read `shops.service_fee_pence`.

---

## 1. Price transparency: DMCC Act 2024 drip pricing (UKC-PRICE)

**Sources**
- [D1] Digital Markets, Competition and Consumers Act 2024, Part 4 Ch 1 (unfair commercial practices; in force 6 Apr 2025): https://www.legislation.gov.uk/ukpga/2024/13/part/4/chapter/1. The "omitting material information from an invitation to purchase" rule is s.230 by the verifier's recollection; check the number: https://www.legislation.gov.uk/ukpga/2024/13/section/230
- [D2] CMA209 *Price transparency* guidance (final 18 Nov 2025 per secondary sources; a revised version dated Feb 2026 may exist): https://www.gov.uk/government/publications/price-transparency-cma209. The CMA209 text itself was **not read** by either research pass.
- [D3] Secondary summaries of CMA209: https://www.taylorwessing.com/en/insights-and-events/insights/2025/11/rd-cma-final-price-transparency-guidance-under-the-dmcca-whats-changed-from-draft-to-final · https://www.osborneclarke.com/insights/uk-cma-finalises-guidance-price-transparency-under-dmcca-and-begins-enforcement-action · https://www.reedsmith.com/articles/full-price-no-surprises-cma-s-final-price-transparency-guidance-arrives/
- [D4] Enforcement drive (400+ businesses reviewed, about 100 advisory letters): https://www.gov.uk/government/news/cma-launches-major-consumer-protection-drive-focused-on-online-pricing-practices. Reports of 2026 fines (StubHub £900,000; a case over an undisclosed £3 booking fee) are `unverified`.

**What the law says**
- `verified`: A mandatory per-order fee must appear in the invitation to purchase and in the total price. Leaving it out is unfair in itself, with no test of its effect on the average consumer. This has applied since 6 Apr 2025; CMA209 adds no later start date.
- `verified`: The CMA can fine a business up to £300,000 or 10% of global turnover, whichever is higher.
- `needs lawyer`: the shop is the trader for the food; whether Pocket Packet, which builds and runs the site and receives the 45p, is also a trader is §18 lawyer Q2. Either way, Pocket Packet should assume it is exposed.
- `unverified` (secondary summaries of CMA209):
  - Per-transaction fees (service, admin and booking fees) get no "cannot be calculated in advance" exception.
  - The accepted route for a multi-item basket is the price with the fee stated alongside it, plus a running total that includes the fee from the start (a floating basket, a dynamic add-to-basket button or a basket pop-up).
  - Tooltips, expandable disclosures and linked pages are unreliable ways to disclose material price information.
  - Mandatory delivery charges belong in the invitation to purchase. The minimum delivery charge counts until a free-delivery threshold is reached.

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-PRICE-01 | MUST: every menu page shows a service-fee notice at every scroll position, at 375×667 and on desktop. It goes in a sticky header, or in the sticky basket bar, which is then shown even when the basket is empty. Exact string (architecture §11), with the amount from `formatPence(shop.service_fee_pence)`: `A £0.45 service fee applies to every order.` | D1, D3 | P1-10 | RTL: render the menu with fee 45 → `/£0\.45 service fee/` is present; fee 50 → `£0.50`. Playwright: scroll to the bottom of a long menu → the notice passes `toBeInViewport()`. | principle verified (D1); sufficiency unverified (CMA209 text not read) → lawyer |
| UKC-PRICE-02 | MUST NOT: put the fee only behind a tooltip, an info icon, a collapsed `<details>`, a modal or a link. An "About our service fee" link is allowed only in addition to the visible text. | D3 | P1-10, P1-17 | RTL: the notice is visible with no user events: no `hidden`, no `aria-hidden`, not inside a closed `<details>`. | unverified (CMA209 detail); treat as MUST |
| UKC-PRICE-03 | MUST: once the first item is added, the sticky basket bar shows the item count and a running total that already includes the service fee, computed by core `priceOrder`. Draft: "1 item · £9.45 incl. £0.45 service fee". The UI MUST NOT add the fee with its own arithmetic. | D1, D3 | P1-10 | RTL: add a £9.00 item → the bar reads `£9.45` and `incl. £0.45 service fee`. Review: no fee arithmetic in `apps/storefront` (grep `service_fee`/`serviceFee` and `+`). | principle verified (D1); sufficiency unverified (CMA209 text not read) → lawyer |
| UKC-PRICE-04 | MUST: the item sheet repeats the fee notice next to the add button (e.g. "Add · £9.00" with "+ £0.45 service fee per order" directly beneath it). | Verifier's safer reading of D2/D3 | P1-10 | RTL: open the item sheet → the fee text is inside the same container as the add button. | needs lawyer |
| UKC-PRICE-05 | MUST (delivery mode): show the delivery charge up front. Ask for the postcode as soon as the customer chooses delivery. Until a zone resolves, the basket bar shows items + service fee and the text `+ delivery from £Y.YY`, where Y.YY is the lowest `fee_pence` among the shop's zones (architecture §11); checkout stays disabled until a zone resolves. Once a zone resolves, the running total includes that zone's fee (0 above the free-delivery threshold), via `priceOrder`. | D3, architecture §11 | P1-10 | RTL: delivery mode, a £9.00 item, no postcode, zones 150/250 → the bar reads `£9.45 incl. £0.45 service fee` and `+ delivery from £1.50`, and checkout is disabled; postcode resolves to the 250 zone → the total includes £2.50. | needs lawyer (§18 lawyer Q1) |
| UKC-PRICE-06 | MUST: the checkout review itemises Items, Discount (only if any), Delivery, Service fee, Tip and Total, all from one `priceOrder` result. The Total equals the amount on the pay button and the Stripe Checkout total. The storefront sends that Total as `expectedTotalPence`; if the server re-price differs, `create-checkout` returns `409 PRICE_CHANGED` and creates no session (architecture §8). | D1, D3 | P1-10, P1-11 | RTL: the itemised rows are present. P1-11 param-builder test: Σ(line_items unit_amount × quantity) = `order.total_pence`; a line named exactly `Service fee` with `unit_amount = service_fee_pence`; a `Delivery` line when > 0; a `Tip` line when > 0. P1-11 pipeline test: a wrong `expectedTotalPence` → `409 PRICE_CHANGED`, no order and no Stripe call. | verified |
| UKC-PRICE-07 | MUST: one fee amount per order, from `shops.service_fee_pence`. It never varies by payment method, basket size or time, and it is never discounted. | Architecture §5, PAY-02 | P1-01 (golden), P1-11 | P1-01 golden tests (discounts never touch the service fee); P1-11 test: the service-fee line equals the shop value in every fixture. | verified |
| UKC-PRICE-08 | MUST NOT: customer-facing copy claiming "no fees", "no hidden fees" or "free" for anything that carries the service fee. | D1 | P1-17 | Banned-strings test (UKC-NAME-02) also rejects `no fees` and `no hidden fees`. | needs lawyer |

**Safest alternative: fold the fee into menu prices.** The shop raises its menu prices, the customer sees no separate fee, and the platform still takes 45p as `application_fee_amount`. This removes the drip-pricing risk. It is **not allowed without an ADR**, because architecture §5 rule 8 fixes `applicationFeePence = serviceFeePence` and the P1-01 golden tests encode it. Consequences:
- Core pricing needs a separate platform-fee setting, and the golden tests change (human only).
- The marketing line changes to "the shop pays 45p per order, still 0% commission".
- The VAT analysis of the 45p may change (accountant).

Recommended path: build the separate-fee UI (rules above), get the lawyer's written view at P1-20, and switch only if the lawyer advises it.

## 2. Naming the fee and tips (UKC-NAME)

**Sources**
- [N1] Consumer Payment Surcharges Regulations 2012, as amended (consumer card surcharges banned since 13 Jan 2018): https://www.legislation.gov.uk/uksi/2012/3110/contents. `verified (single source)`
- [N2] Employment (Allocation of Tips) Act 2023, in force 1 Oct 2024: tips must reach workers in full, and employers who frequently receive tips need a written tipping policy. Source: verifier's knowledge, no URL in the research. `verified (single source)`

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-NAME-01 | MUST: the customer-facing label is "Service fee" (line label) or "service fee" (in sentences): in the storefront, the Stripe line item, emails, SMS, the status page and the legal pages. | N1, D1 | P1-10, P1-11, P1-16, P1-17 | P1-11: the line item name is `Service fee`; P1-16 template snapshots contain `Service fee`. | verified |
| UKC-NAME-02 | MUST NOT: customer-facing strings contain, case-insensitively, any of the banned terms of architecture §11: `card fee`, `card charge`, `surcharge`, `processing fee`, `payment fee`, `service charge`, `no fees`, `no hidden fees`, `no refunds` or `non-refundable` ("tax" as the fee's name: UKC-NAME-03). Scope: `apps/storefront/src/i18n/en-GB.ts`, `apps/storefront/src/legal/**`, the notification templates and the Stripe line-item names. | N1, N2, architecture §11 | P1-17 (test), P1-16, P1-11 | P1-17 unit test reads those files and fails on any match of the full list. | verified |
| UKC-NAME-03 | MUST NOT: name the fee "tax", "VAT", "processing", "payment" or "card". VAT may appear elsewhere (UKC-ID-06), but never as the fee's name. | N1, D1 | P1-10, P1-17 | Unit test: every i18n value under the `serviceFee.*` keys fails on `/tax\|vat\|processing\|payment\|card/i`. | verified |
| UKC-NAME-04 | MUST: the tip is optional, defaults to £0 (UKC-CCR-04), goes 100% to the shop (the platform takes none of it) and is never part of the application fee. The shop must pass it in full to its workers (N2, UKC-NAME-05), so the label must not suggest the business keeps it. Draft label: "Add a tip (optional) · 100% goes to the {shopName} team". | N2, architecture §5 r6/r8 | P1-01 (golden), P1-10 | P1-01 golden tests: `applicationFeePence` is unchanged by the tip. RTL: the tip label text. | verified; wording → lawyer |
| UKC-NAME-05 | MUST: the merchant platform terms tell shops about their Tips Act duties: pass 100% of tips to workers, and keep a written tipping policy if they receive tips frequently. | N2 | P1-17 (merchant terms page), P1-20 | Human review of the merchant terms page. | needs lawyer |

## 3. Consumer Contracts Regulations 2013 (UKC-CCR)

**Sources**
- [C1] SI 2013/3134: https://www.legislation.gov.uk/uksi/2013/3134/pdfs/uksi_20133134_en.pdf. Reg 28: https://www.legislation.gov.uk/uksi/2013/3134/regulation/28
- `verified`: reg 28 switches off only the cancellation rules (regs 29–38). The Part 2 information duties still apply.
- `verified`: reg 14(4) requires the order button to say "order with obligation to pay" or an unambiguous equivalent.
- `verified`: Schedule 2 para (l) **requires** telling the consumer when there is no right to cancel.
- `verified`: reg 40 bans pre-ticked or default-on additional payments. Reg 41 limits customer phone lines to the basic rate.
- **Reg 28 sub-paragraph doubt (`needs lawyer`):** the first research pass cited reg 28(1)(b). The verifier recalls that perishable goods ("liable to deteriorate or expire rapidly") fall under **28(1)(c)**, and that 28(1)(b) covers goods made to the consumer's specifications or clearly personalised, which may also cover made-to-order food. Never cite a sub-paragraph in customer copy; the lawyer settles it.

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-CCR-01 | MUST: the final submit button's accessible name is exactly `Place order and pay £X.XX`, where X.XX is `formatPence(result.totalPence)`. | C1 reg 14(4) | P1-10 | RTL: `getByRole('button', { name: 'Place order and pay £20.45' })` for a £20.00 item. | verified; wording → lawyer |
| UKC-CCR-02 | MUST: directly above the button, show the order summary: each line with options and quantity, fulfilment type and time (ASAP estimate or slot), the itemised totals (UKC-PRICE-06) and the shop's legal name. | C1 reg 14 + Sch 2 (paragraph list per lawyer) | P1-10 | RTL: the summary region precedes the button in DOM order and contains the line names, "Service fee" and the legal name. | needs lawyer |
| UKC-CCR-03 | MUST: the checkout shows the no-cancellation statement before the button, and the terms page repeats it. String (architecture §11; the lawyer may change it): `Once the shop accepts your order it can't be cancelled, because food is prepared fresh. If something is wrong with your order, contact the shop.` P1 gives customers no self-cancel action; the copy lives only in `en-GB.ts`, so the lawyer's final wording is a one-line change. | C1 Sch 2(l), reg 28 | P1-10, P1-17 | RTL: the statement is visible on the checkout without interaction. e2e: the terms page contains it. | verified (duty); wording → lawyer |
| UKC-CCR-04 | MUST NOT: pre-select any paid extra. The tip starts at £0 with no tip button pressed. No modifier option with `price_pence > 0` is selected by default, even in a required group. There is no pre-ticked checkbox of any kind. | C1 reg 40 | P1-10 | RTL: the initial tip is `£0.00` and no tip button has `aria-pressed="true"`; opening an item sheet → no checked option with a price > 0. | verified |
| UKC-CCR-05 | MUST: shop phone numbers shown to customers are basic rate. The P1-08 zod schema rejects UK numbers that, after normalising `+44` to `0`, start with `09`, `084`, `087` or `118`. | C1 reg 41; FSA allergen info must be free (§6) | P1-08 | Unit tests on the phone schema: `0161…` and `07…` pass; `0845…`, `0870…`, `0906…` and `118…` fail. | verified (reg 41); prefix list unverified → lawyer |
| UKC-CCR-06 | MUST: after payment, send a confirmation on a durable medium (email). It contains the shop's legal name, geographic address, phone and email; the order number; the lines with options and allergens; the itemised totals including the service fee; the fulfilment type and time; the no-cancellation statement; and how to complain. | C1 (confirmation duty; regulation number per lawyer), uk.json | P1-16 | Template snapshot test asserts each element is present in both the HTML and the text version. | verified; wording → lawyer |
| UKC-CCR-07 | MUST: pre-contract information is available before ordering: trader identity (UKC-ID-01), total price (§1), delivery or collection arrangements and time, payment method (card via Stripe), complaint handling, and a statutory-rights line. | C1 Part 2 / Sch 2 | P1-10, P1-17 | e2e: from the menu, the footer links reach the terms page, which contains each heading. | verified; content → lawyer |

## 4. Consumer Rights Act 2015: wrong or missing items (UKC-CRA)

**Sources**
- `verified (single source)`: statutory rights for goods (satisfactory quality, as described) still apply to food when there is no cancellation right.
- Act: https://www.legislation.gov.uk/ukpga/2015/15/contents. This URL is from general knowledge; it is not in the research files.

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-CRA-01 | MUST: shops can make full or partial refunds with reason codes `item_missing`, `wrong_item`, `late`, `quality`, `customer_request` and `other`. Full refund → `refund_application_fee: true`; partial refund → `false` (architecture §9). | CRA; architecture §9 | P1-15 | P1-15 param-builder tests for each reason, with the fee flag. | verified |
| UKC-CRA-02 | MUST: the status page and the confirmation email show "Something wrong or missing? Call {shopName} on {phone}" with a `tel:` link. | CRA, CCR | P1-16 | Template snapshot plus RTL on `/o/:token`. | verified |
| UKC-CRA-03 | MUST NOT: customer copy says or implies "no refunds", "non-refundable" or that statutory rights are excluded. Do not tell customers that the platform keeps the service fee on partial refunds until the lawyer approves the wording. | CRA (unfair terms: lawyer) | P1-17 | Covered by the extended banned-strings list (UKC-NAME-02). | needs lawyer |

## 5. Trader identity: E-Commerce Regs reg 6 and company trading disclosures (UKC-ID)

**Sources**
- [I1] Electronic Commerce (EC Directive) Regulations 2002, reg 6: https://www.legislation.gov.uk/uksi/2002/2013/regulation/6. `verified` (verifier correction):
  - 6(1)(a)–(c): name, geographic address, and contact details including email.
  - 6(1)(d): trade register and registration number (e.g. Companies House).
  - 6(1)(e): supervisory authority where an authorisation scheme applies (arguably the licensing authority for alcohol sellers, so phase 2+).
  - 6(1)(g): VAT number if registered.
  - 6(2): prices must say clearly whether they include tax and delivery costs.
- [I2] Company, LLP and Business (Names and Trading Disclosures) Regulations 2015: limited companies must show on their websites the registered name, number, registered office and the part of the UK where registered. Source: verifier's knowledge, no URL in the research. `verified (single source)`
- `unverified` (general knowledge, not in the research): E-Commerce Regs reg 9 (information on the technical steps to conclude the contract and on correcting input errors) and reg 11 (acknowledge the order electronically without undue delay). The editable basket and the confirmation email cover both; the lawyer should confirm.

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-ID-01 | MUST: every storefront page (menu, basket, checkout, status, legal pages) has a footer with: the legal name (`shops.legal_name`); the trading name if different; the geographic address and postcode; email; phone; company number and registration details if set; VAT number if set; and links to Terms, Privacy, Allergens and "About our service fee". | I1, I2 | P1-08 (fields), P1-17 (footer) | RTL footer test with a full fixture and a sole-trader fixture (no company or VAT number → those rows absent). e2e: each storefront route shows the legal name. | verified |
| UKC-ID-02 | MUST: a shop cannot go `live` unless `legal_name`, the address, `postcode`, the email and the phone are set, plus the UKC-ID-05 fields for limited companies and LLPs (in addition to the Stripe checks in P1-09). The go-live check: the P1-09 `shops_go_live_check` trigger, fired by the platform-admin "Go live" button, raises the codes from P1-08's `goLiveIdentityProblems`. | I1 | P1-08 (`goLiveIdentityProblems`), P1-09 (`shops_go_live_check` trigger + Go live button) | P1-08: unit tests on the zod schema and `goLiveIdentityProblems`. P1-09 pgTAP: missing phone → `23514`; complete → succeeds. | verified |
| UKC-ID-03 | MUST: the address validation rejects PO boxes (`/\bP\.?\s*O\.?\s*Box\b/i`). | I1 6(1)(b) | P1-08 | Unit test: "PO Box 12" and "P.O. Box" fail. | verified |
| UKC-ID-04 | SHOULD: soft format checks (warn, don't block) for the company number (8 characters, e.g. `01234567` or `SC123456`) and the VAT number (`GB` + 9 digits, or 12 for branches). | I1 | P1-08 | Unit tests on the warnings. | unverified (formats) |
| UKC-ID-05 | MUST (limited companies and LLPs): the footer and the terms identity block also show the company number, the registered office address and the part of the UK where registered. Columns (architecture §7): `shops.legal_form` (`sole_trader`, `partnership`, `limited_company`, `llp`, `other`), `registered_office_address`, `registered_in` (`england_wales`, `scotland`, `northern_ireland`). P1-08 adds the form fields and these `goLiveIdentityProblems` codes: `LEGAL_FORM_MISSING` when `legal_form` is null; and, when it is `limited_company` or `llp`, `COMPANY_NUMBER_MISSING`, `REGISTERED_OFFICE_MISSING` and `REGISTERED_IN_MISSING`. The final field list per legal form follows §18 lawyer Q6. | I2, architecture §11 | P1-05 (columns), P1-08 (fields + go-live codes), P1-09 (go-live trigger), P1-17 (footer) | P1-08 unit tests: a `limited_company` fixture without a registered office → `REGISTERED_OFFICE_MISSING`; a `sole_trader` fixture → none of the company codes. P1-17 RTL: a company fixture shows the registered office and the part of the UK; a sole-trader fixture does not. | verified (single source); field list → lawyer |
| UKC-ID-06 | MUST: the menu states the tax and delivery position. Draft: "Prices include VAT where applicable. Delivery (if any) and the £0.45 service fee are shown in your basket total." | I1 6(2) | P1-10 | RTL: the text is present on the menu. | needs lawyer |
| UKC-ID-07 | SHOULD: the footer names the platform operator ("Online ordering by {platform legal name}") and links to a platform identity page. | D1 (platform exposure) | P1-17 | e2e: the link is present. | needs lawyer (§18 lawyer Q2) |

## 6. Allergens (UKC-ALG)

**Sources**
- [A1] FSA technical guidance Part 2 (non-prepacked food): https://www.food.gov.uk/business-guidance/food-allergen-labelling-and-information-requirements-technical-guidance-part-2-guidance-for-businesses-providing-non-prepacked
- [A2] FSA, Food sold online: https://www.food.gov.uk/business-industry/guidancenotes/food-sold-online
- [A3] FSA allergen guidance hub: https://www.food.gov.uk/business-guidance/allergen-guidance-for-food-businesses. Best-practice summary (secondary): https://foodallergyaware.co.uk/best-practice-guidance-fsa-allergen-update-for-non-prepacked-food/
- `verified`: assimilated Reg 1169/2011 Art 14(2) with Art 44, and the Food Information Regulations 2014:
  - For non-prepacked food sold at a distance, information on the 14 allergens must be available **free of charge before the purchase is concluded AND at the moment of delivery**.
  - Sulphites count above 10 mg/kg or 10 mg/L, measured as total SO2.
  - In Northern Ireland, Reg 1169/2011 applies as EU law (Windsor Framework). In Scotland, Food Standards Scotland is the regulator.
- `verified` (corrected): the legal minimum allows the information to be given orally (e.g. by phone) at either point, if it is accurate and can be checked against written records. Written information at both points is FSA best practice (March 2025, voluntary). **We build the written version at both points.**
- `verified (single source)`: Natasha's Law (PPDS labelling, in force 1 Oct 2021) applies to food the shop packs BEFORE the customer orders. Such food needs a full ingredient label with the allergens emphasised.
- `unverified`: Owen's Law (mandatory written allergen information at the point of order) was not law as of the most recent source (Sept 2026), and the outcome of the spring 2026 FSA evaluation is unknown: https://www.candcsolicitors.co.uk/blog/owens-law-spring-2026-fsa-allergen-review/

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-ALG-01 | MUST: exactly the 14 keys of architecture §7, with values `contains`, `may_contain` or `free`. No default value: new items and options start with `allergens = {}`, and the editor shows 14 rows with nothing preselected. | A1 | P1-05, P1-07 | RTL: a new item → 14 radio groups, none checked. pgTAP: the column default is `'{}'`. | verified |
| UKC-ALG-02 | MUST: publish gate. An item cannot have `is_published = true` unless all 14 keys are set on the item AND on every option of every one of its modifier groups. This is enforced twice: core `validateAllergens` and a DB trigger. The gate works in both directions: an incomplete option cannot be added to, moved under or edited within a published item. | A1, architecture §7 | P1-05 (triggers), P1-07 (UI + core) | pgTAP: publishing with 13 keys fails; an option missing a key fails; inserting an incomplete option into a group of a published item fails; a complete item passes. Core unit tests. | verified |
| UKC-ALG-03 | MUST: before purchase, the item sheet lists allergens in plain names ("Contains: Milk, Eggs" / "May contain: Peanuts"). The options the customer has selected are merged in, with `contains` taking precedence over `may_contain`, which takes precedence over `free`. | A1, A2 | P1-10 | RTL: selecting an option that contains sesame adds "Sesame" to "Contains". Core unit test for the merge. | verified |
| UKC-ALG-04 | MUST: the checkout review repeats each line's merged allergens. | A3 best practice | P1-10 | RTL: the checkout lines show the allergen text. | verified (exceeds the minimum) |
| UKC-ALG-05 | MUST: `order_items.allergens_snapshot` stores each line's merged allergens at order time. Later menu edits never change it. | A1 (at delivery) | P1-11 | Test with fakes: edit the menu after the order → the snapshot is unchanged. | verified |
| UKC-ALG-06 | MUST: the kitchen ticket prints each line's allergens, plus the customer allergy note under a prominent `ALLERGY NOTE` heading. The ticket serves kitchen safety; it is written information at delivery only if a printed copy goes in the bag (§17). Otherwise the confirmation email and the status page (UKC-ALG-07) are the written record at delivery. A dedicated "customer copy" print option or bag stickers are a follow-up (planner). | A3; A1 (at delivery) only via a copy in the bag | P1-13 | RTL on `/orders/:id/ticket`: the allergen text and the heading are present when a note exists. | verified |
| UKC-ALG-07 | MUST: the confirmation email (`order.placed`) and the status page list each line's allergens. | A1, A3 | P1-16 | Template snapshot test. | verified |
| UKC-ALG-08 | MUST: the checkout has an optional allergy note (suggested max 500 characters; the P1-11 schema is authoritative) with the visible text "Have a food allergy or intolerance? Call {shopName} on {phone} before you order." and a `tel:` link to a basic-rate number (UKC-CCR-05). The note is never a substitute for the allergen data. | A1 (free of charge), A3 | P1-10 | RTL: the `tel:` href equals the shop phone; a 501-character note is rejected by the schema. | verified; wording → lawyer |
| UKC-ALG-09 | MUST: each shop has an "Allergen information" page listing every published item and its options with their allergens. It is one click from every menu page. | A3 ("one click away") | P1-17 | e2e: footer link → the page lists the seeded items' allergens. | verified (best practice) |
| UKC-ALG-10 | MUST: write allergen changes on items and options to `audit_log` (before/after), like price changes. | Due diligence; architecture §7 (`audit_log`) | P1-07 | pgTAP: an allergen update by a manager writes one `audit_log` row with before/after; an update that does not change the allergens writes none. | verified (project rule) |
| UKC-ALG-11 | MUST: the merchant platform terms and the onboarding checklist tell shops: (a) they are responsible for accurate allergen data; (b) they must update it before changing recipes or suppliers; (c) items they pack before the customer orders need Natasha's Law (PPDS) labels, or must come off the online menu. | A1, PPDS | P1-17 (merchant terms), P1-20 | Human review; P1-20 checklist item. | verified; wording → lawyer |

## 7. Food hygiene ratings: FHRS (phase 2) (UKC-FHRS)

**Sources**
- https://www.food.gov.uk/business-guidance/food-hygiene-rating-publication-and-displaying-your-rating
- API v2: https://www.food.gov.uk/food-hygiene-rating-scheme-api-version-2
- Wales leaflet rules: https://www.gov.wales/rules-requiring-takeaways-promote-food-hygiene-ratings-leaflets-come-force-0
- NI online-display consultation: https://www.food.gov.uk/news-alerts/consultations/the-food-hygiene-rating-online-display-regulations-northern-ireland-2023

**Facts**
- `verified`: display is voluntary in England. Display on premises is mandatory in Wales (since 28 Nov 2013) and in NI (since 7 Oct 2016).
- `verified`: no online-display duty is known to be in force anywhere.
- `unverified`: whether the NI Online Display Regulations were ever made; the FSA's March 2026 "Future of Food Regulation" programme exploring mandatory display in England.
- `verified`: Scotland's FHIS (Pass / Improvement Required) is voluntary, and the same API returns it.

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-FHRS-01 | SHOULD (P2): show an optional rating badge looked up by `shops.fhrs_id` through FHRS API v2 (no key; request header `x-api-version: 2`), with "Rating checked on {date}". Use only the FSA's official online rating images. Hide the badge if the lookup fails; never show a stale or home-made rating. | API v2 page | P2 (no card yet) | Tests with a fixture API response; the badge is hidden on error. | verified; header from knowledge → check docs |
| UKC-FHRS-02 | SHOULD (P2): put a per-shop "mandatory online display" flag behind config, so a future NI or England online rule is a setting, not a rebuild. | NI consultation | P2 | n/a | unverified (law not in force) |
| UKC-FHRS-03 | MUST (packaging and print business, from P2/P3): printed menus, leaflets and QR flyers for **Welsh** takeaways that show food, a price and a way to order without visiting must carry the prescribed bilingual FHRS statement. Omitting it is an offence; the duty falls on the food business operator, so auto-inserting it is a service, not a liability shield. The fixed penalty (recalled as £200) is unverified. Add a "Welsh shop" flag before printing QR campaigns. | Wales Regs 2016 | P3 (QR print templates); CRM process (human) | Template test: a Welsh shop → the statement is present. | verified (duty) |

## 8. Alcohol and age-restricted products: excluded in phase 1 (UKC-AGE)

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-AGE-01 | MUST (P1): no age-restriction feature. `age_restricted` is not offered in the menu builder, and menu validation rejects it (strict zod schema). | Architecture §11 | P1-07 | Unit test: an item payload with `age_restricted` fails validation. | verified |
| UKC-AGE-02 | MUST (P1): the pilot shop's online menu contains no alcohol and no other age-restricted products (e.g. tobacco or vapes). Energy drinks are allowed in P1, but tell the shop about the planned under-16 ban. Before P2 starts, re-verify the ban; if it is confirmed for April 2027, either keep drinks over 150 mg/L caffeine off England shops' online menus (merchant terms + onboarding check) or build the age-restriction feature (ADR + lawyer) before that date. | §8 facts below | P1-20 (human check) | P1-20 checklist. | verified (P1 decision); ban date unverified |
| UKC-AGE-03 | MUST (P1, England & Wales): late night refreshment. Supplying hot food or hot drink to the public between 23:00 and 05:00 — including takeaway and delivery — needs a premises licence that authorises late night refreshment (Licensing Act 2003, Sch. 2). If any collection or delivery session for a shop in England or Wales runs past 23:00 or starts before 05:00, the merchant must tick "I hold a premises licence that authorises late night refreshment" before the hours can be saved; the confirmation is stored as `shops.late_night_licence_confirmed_at` and audit-logged. Scotland/NI: no such tick in P1 (lawyer to confirm local rules). | Licensing Act 2003 Sch. 2 (from model knowledge; not fetched live) | P1-08 | Unit/RTL: saving a 17:00–01:00 session for an England shop without the tick → validation error; with the tick → saved and `late_night_licence_confirmed_at` set. | unverified → lawyer |

**Requirements before alcohol or age-restricted items are ever built (phase 2+; ADR plus licensing lawyer first)**

*England and Wales (Licensing Act 2003, which covers England and Wales only). `verified`, per the verifier's knowledge:*
- The premises licence must permit off-sales. Every sale must be made or authorised by a personal licence holder.
- An age-verification policy (photo ID from anyone who appears under 18) is a **mandatory condition** on every alcohol licence. Challenge 25 is a common local condition.
- A mandatory condition bans sales below duty plus VAT, so discounts and meal deals must enforce a price floor.
- s.151: knowingly delivering alcohol to an under-18 is an offence. s.146(4) provides a due-diligence defence.
- s.190: a sale is treated as made where the alcohol is appropriated to the contract, so licensed hours and the licence's delivery conditions apply.
- Council guidance: verify age at order AND at delivery; no ID, no delivery. Source: https://www.southampton.gov.uk/business-licensing/licensing/licensing-act-2003/alcohol-delivery-service/

*Scotland (own regime).*
- Challenge 25 is mandatory.
- Off-sales are allowed only 10:00–22:00.
- Quantity discounts on off-sales are banned.
- Minimum unit price is 65p (since 30 Sep 2024).

*Wales.* Minimum unit price of 50p since March 2020; a rise has been proposed, so check the current level.

*Northern Ireland.* Licensing (NI) Order 1996.

*Energy drinks (`unverified`).* A ban on sales of drinks above 150 mg/L caffeine to under-16s in England, from April 2027, with fines up to £2,500, reportedly confirmed on 16 Jul 2026. It is consistent with the September 2025 DHSC consultation. Source: https://www.lewissilkin.com/insights/2026/07/17/government-confirms-ban-on-sale-of-energy-drinks-to-under-16s-in-england-102nch3

*Product needs.*
- Per-item `age_restriction` enum (`none`, `16+`, `18+`).
- A separate licensed-hours schedule.
- Checkout age confirmation.
- "ID REQUIRED" on the ticket and in the driver view, and a "refused, no ID" outcome with refund rules.
- Per-unit price floors for Scottish and Welsh shops, and the duty-plus-VAT floor.
- Possibly the licensing authority as the reg 6(1)(e) supervisory authority.

## 9. Calorie labelling (UKC-KCAL)

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-KCAL-01 | No P1 work. The rule applies only to businesses with **250+ employees** in **England** (from 6 Apr 2022): kcal at the point of choice, including online menus and third-party apps, plus the statement "Adults need around 2000 kcal a day". Independent takeaways are normally exempt. Later: an optional `kcal` field per item/option and a per-shop "calorie labelling required" toggle for franchise customers. | https://www.gov.uk/government/news/new-calorie-labelling-rules-come-into-force-to-improve-nations-health | P2+ (no card) | n/a | verified |

## 10. VAT (UKC-VAT): accountant territory

**Sources**
- VAT Notice 709/1: https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091. The summary below is from knowledge; it is `unverified` live.
  - Hot takeaway food is standard-rated if it is hot at handover AND meets at least one of five tests: heated to be eaten hot, heated to order, kept hot, supplied in heat-retentive packaging, or marketed as hot.
  - Cold takeaway food is generally zero-rated, except always-standard-rated items: confectionery, crisps, soft drinks, bottled water, ice cream and alcohol.
  - Food eaten on the premises is standard-rated whatever its temperature.
- Registration threshold: £90,000 of taxable turnover from 1 Apr 2024 (https://www.gov.uk/register-for-vat). It is `unverified` for 2026/27.
- HMRC registers the legal person, so if the packaging company is VAT-registered, the platform's supplies are its taxable supplies.

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-VAT-01 | MUST: `menu_items.vat_category` ∈ `hot_standard`, `cold_zero`, `always_standard`, default `hot_standard`. The merchant chooses it; the editor shows short help text based on Notice 709/1 ending "Check with your accountant". No automatic classification. | 709/1 | P1-05, P1-07 | pgTAP CHECK constraint; RTL: the select and the help text are present. | needs accountant (help text) |
| UKC-VAT-02 | MUST: `order_items.vat_category_snapshot` (architecture §7) copies the item's `vat_category` at order time, so reports can later split sales by VAT category. Whether P1-18 reports must split by it is for the accountant (§18 accountant Q2). | 709/1, architecture §7 | P1-05 (column), P1-11 (writes it) | P1-11 test with fakes: the inserted `order_items` row carries the item's `vat_category`. | verified (project rule); report split → accountant |
| UKC-VAT-03 | MUST NOT: in P1, call the confirmation email or receipt a "VAT receipt" or "VAT invoice", or show VAT amounts. | Caution | P1-16 | Template test: no `VAT receipt` or `VAT invoice`. | needs accountant |
| UKC-VAT-04 | The 45p question (no code; for the accountant). If the platform's entity is VAT-registered, the 45p, the £149 setup and the £39/month are taxable supplies, normally at 20%. If the 45p is VAT-inclusive, 7.5p of it is VAT. Whether the recipient is the consumer (a booking fee) or the shop (a B2B commission) depends on the contracts; on a direct charge, the shop is merchant of record. `platform_fee_ledger` and P1-18 must give the accountant per-fee and per-refund data. | Stripe research; https://www.gov.uk/guidance/vat-guide-notice-700 | P1-12 (ledger), P1-18 | P1-18 pgTAP: fee totals reconcile with the ledger. | needs accountant |

## 11. UK GDPR and privacy (UKC-DP)

**Roles.** On a shop's storefront, the **shop is the controller** of its customers' order data and **Pocket Packet is a processor**. This needs an Article 28 data processing agreement (DPA) in the merchant platform terms (research recommendation; `needs lawyer`). Pocket Packet is the controller for its own data: merchant user accounts, the fee ledger and security logs. In the aggregator and cross-shop loyalty phases (P3/P4), Pocket Packet becomes a controller, possibly a joint controller (`needs lawyer`).

**Recipients to list.**
- Supabase (London region) and Vercel.
- Stripe. Its role is for the lawyer to define.
- Twilio and Resend.
- postcodes.io, which receives the postcode from the browser.
- International transfers, for the lawyer.

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-DP-01 | MUST: data minimisation. The checkout collects only name, phone, email, delivery address (delivery orders only), notes, allergy note and tip. No date of birth, no account and no marketing checkbox in P1. The request schema is `.strict()`. | UK GDPR Art 5(1)(c) | P1-11 | Unit test: an extra field (e.g. `dob`) → 400 VALIDATION. | verified (principle) |
| UKC-DP-02 | MUST: treat the allergy note as possible **health data** (special category, Art 9). It is optional, used only to prepare the order, never logged, never exported in CSV, never sent to analytics or any LLM, and kept no longer than the other contact fields. | Art 9 (from knowledge) | P1-10, P1-11, P1-18 | P1-18: the CSV columns contain no customer fields. Review grep: no logging of `allergy_note`. | needs lawyer (Art 9 condition) |
| UKC-DP-03 | MUST: each shop has a privacy notice template covering the controller (shop identity), the processor (Pocket Packet), purposes, lawful basis (contract), recipients, retention, rights and the right to complain to the ICO. The merchant app has a platform privacy notice for merchant users. Both carry `LAWYER REVIEW REQUIRED`. | UK GDPR Arts 13–14 (from knowledge) | P1-17 | e2e: the Privacy link from every storefront page reaches the notice. | needs lawyer |
| UKC-DP-04 | MUST NOT: log customer personal data. Edge functions log ids only, never names, phones, emails, addresses or notes. `last_error`, `stripe_events.error` and `notifications_log` hold no message bodies. | Art 5(1)(f), Art 32 | all edge-function tasks; P1-19 review | P1-19 review checklist; grep for `console.log` with customer fields. | verified (principle) |
| UKC-DP-05 | MUST: `order-status` returns safe fields only, with no customer phone, email or full address (architecture §7, §8). | Art 32 | P1-16 | Deno test: the response keys ⊆ the allowlist. | verified |
| UKC-DP-06 | MUST: no real customer data in prompts, seeds, fixtures, tests or commits. The coding model's provider is outside the UK (Z.ai, a Singapore entity), so any leak would also be an international transfer. | Architecture §3; AGENTS.md §4 | all tasks | Guards and review. | verified (project rule) |
| UKC-DP-07 | SHOULD (P2 job; P1 writes the decision into the privacy notice). Suggested retention, to be decided by the lawyer and accountant: order financial fields (amounts, items) 6 years (accountant to confirm); customer contact fields, notes and allergy note erased or pseudonymised after a period the lawyer sets (suggestion: 13 months); `rate_limits` IP hashes 24 hours; `notifications_log` 13 months. | Art 5(1)(e) | P1-17 (notice text); P2 (job) | n/a in P1 | needs lawyer / accountant |
| UKC-DP-08 | MUST (P1-20 runbook): a breach procedure. The processor tells the shop without undue delay, and the controller notifies the ICO within 72 hours where required (Art 33). Name the incident contacts. | Art 33 (from knowledge) | P1-20 | Runbook review. | needs lawyer |
| UKC-DP-09 | Legacy CRM: the open `anon` access exposed B2B contact data and staff password hashes (see `01-upgrade-plan.md` §3.6, P0-B1). Ask the lawyer whether past exposure is a notifiable breach (Art 33/34). The platform never connects to the CRM until lockdown (architecture §12). Lockdown P0-B2…B4 merged and applied is a P1-20 go-live gate (architecture §15; checklist in §17 below). | Art 32–34 | P0-B1, P0-B2…B4, P1-20 (gate) | Review output; §17 checklist. | needs lawyer |

## 12. PECR electronic marketing: loyalty and aggregator phases (UKC-MKT)

**Sources**
- ICO guidance: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/
- `verified`: PECR reg 22. The soft opt-in applies only if all four conditions hold:
  1. the business collected the details itself, during a sale;
  2. it markets only its own similar products;
  3. it offered an opt-out at collection;
  4. it offers an opt-out in every message.

  SMS counts as electronic mail. Only the organisation that collected the details can rely on the soft opt-in.
- `verified (single source)`: reg 23 bans concealing the sender's identity and requires a valid address for opt-outs.
- `verified`: the DUAA 2025 (Royal Assent 19 Jun 2025) raised PECR fines to UK GDPR levels (£17.5m or 4%). The commencement date is `unverified`.

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-MKT-01 | MUST (P1): no marketing at all. Transactional SMS and email contain only order information: no offers, no "order again", no cross-shop promotion. | reg 22 | P1-14, P1-16 | Template test: no `/% off\|discount\|offer\|promo/i` in the notification templates. | verified |
| UKC-MKT-02 | MUST (P3): shop marketing uses the soft opt-in only for that shop's own customers and its own products. The opt-out is offered at checkout (unticked) and in every message. | reg 22 | P3 (no card) | Consent-model tests. | verified |
| UKC-MKT-03 | MUST (P3/P4): platform-wide, cross-shop, loyalty and aggregator marketing needs explicit consent: a separate unticked checkbox. Record the controller, timestamp, source and wording version. Shop A's customers are never marketed for Shop B or the platform without it. | reg 22 | P3, P4 | pgTAP and unit tests on consent records. | verified |
| UKC-MKT-04 | MUST (P3+): every marketing SMS or email names the sender and offers an opt-out (an unsubscribe link, or a STOP keyword for SMS). Check the suppression list before every send. | reg 22, reg 23 | P3 | Unit test: the send is blocked for a suppressed recipient. | verified |

## 13. Cookies and storage (UKC-COOKIE)

**Sources**
- DLA Piper: https://privacymatters.dlapiper.com/2026/02/uk-commencement-of-the-data-protection-provisions-in-the-data-use-and-access-act/
- Stevens & Bolton: https://www.stevens-bolton.com/insights/102mqbh/the-data-use-and-access-act-2025-cookies-what-is-changing-and-what-you-need-t/
- `verified` (corrected by the verifier): the DUAA 2025 adds PECR exemptions for first-party analytics and preference storage. Users must still get clear information and a simple, free way to object (opt out). Analytics data may be used only to improve the operator's own service, so a vendor that reuses the data does not qualify.
- `unverified`: commencement on 5 Feb 2026 and the ICO's final guidance on 29 Apr 2026.
- Advertising and tracking pixels still need prior opt-in consent.

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-COOKIE-01 | MUST (P1): the storefront sets **no cookies** and loads no third-party scripts, fonts, pixels or analytics. Self-host fonts. Network requests go only to the storefront origin, the Supabase project / functions URL and postcodes.io, plus the redirect to Stripe hosted Checkout. | PECR reg 6; architecture §11 | P0-04 (fonts), P1-17 (test) | P1-17 Playwright: after the menu, an item sheet and the basket, `context.cookies()` is empty and every request host is in the allowlist. | verified |
| UKC-COOKIE-02 | MUST: the basket in `sessionStorage` is strictly necessary (the user asked for it), so no consent is needed. The storefront Supabase client MUST NOT persist an auth session (no customer auth in P1; check the option name in the installed `@supabase/supabase-js`). | PECR reg 6 exemption (from knowledge) | P1-10 | Playwright: `localStorage` is empty after browsing. | needs lawyer (low risk) |
| UKC-COOKIE-03 | MUST: the merchant app's storage (the Supabase Auth session and `ppos.merchant.lang`) is listed in the platform privacy notice as strictly necessary or a user-chosen preference. | PECR | P1-06, P1-17 | Human review of the notice. | needs lawyer (low risk) |
| UKC-COOKIE-04 | MUST NOT: add analytics, a tag manager, chat widgets, ad pixels or embedded maps without an ADR. If first-party analytics are added later, add a cookie notice and an opt-out control. Pixels require a real opt-in banner with an equal-weight reject button, and nothing loads before consent. | DUAA 2025 | P2+ (ADR) | Same e2e test keeps failing until the ADR updates the allowlist. | unverified (commencement) |

## 14. Accessibility (UKC-A11Y)

**Sources**
- `verified`: the Equality Act 2010 (s.20 and s.29) imposes an anticipatory duty to make reasonable adjustments: https://www.legislation.gov.uk/ukpga/2010/15/section/29
- No UK statute sets a WCAG level for private firms. Claims have been brought over websites (RNIB v bmibaby, 2012, settled), but there is no known reported judgment.
- The European Accessibility Act matters only for EU-facing sales.
- Target: **WCAG 2.2 AA**. Secondary source: https://www.boia.org/blog/the-equality-act-of-2010-and-british-standards-for-web-accessibility

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-A11Y-01 | MUST: every control has an accessible name. Tests query only by role and label, which proves this as a side effect. | WCAG 4.1.2 | P0-04, all UI tasks | RTL/Playwright use `getByRole`/`getByLabel` only. | verified (target) |
| UKC-A11Y-02 | MUST: the item sheet is a dialog (`role="dialog"`, `aria-modal`). Focus moves into it, Esc closes it, and focus returns to the trigger. Modifier groups are `fieldset`/`legend` with radio or checkbox inputs. Min/max errors are linked with `aria-describedby`. | WCAG 2.1.1, 2.4.3, 3.3.1 | P0-04 (Sheet/Dialog), P1-10 | RTL with `user-event` keyboard only: open, choose, add, close. | verified (target) |
| UKC-A11Y-03 | MUST: colour contrast is at least 4.5:1 for text and 3:1 for UI components. Our calculation (relative-luminance formula; re-check with a tool): orange `#ff8b3d` on `#fcf6fa` ≈ 2.2:1 and white on orange ≈ 2.3:1, so **orange must never be a text colour, and button text on orange must be navy**. Navy `#233749` on `#fcf6fa` ≈ 11.5:1 and on orange ≈ 5.3:1, which passes. Red `#fc5466` on `#fcf6fa` ≈ 3.0:1, so it is not for body text. | WCAG 1.4.3, 1.4.11 | P0-04 (tokens) | Unit test on the token pairs, using a contrast helper written in the test. | verified (math); tool re-check |
| UKC-A11Y-04 | MUST: an expired or abandoned Stripe Checkout (30 minutes) never loses the basket. The `cancel_url` returns to the basket with its contents. | WCAG 2.2.1 (spirit) | P1-10, P1-11 | e2e: return via `cancel_url` → the basket lines are still present. | verified (target) |
| UKC-A11Y-05 | MUST: the merchant new-order alarm is visual as well as audible (a full-screen banner), and works without colour alone. Touch targets are at least 24×24 CSS px (WCAG 2.2 SC 2.5.8, from knowledge). Menu photos have alt text (the item name). | WCAG | P1-13, P1-10 | RTL: the banner text is present while the alarm sounds; the images have `alt`. | verified (target) |
| UKC-A11Y-06 | SHOULD: automated axe checks in e2e. `@axe-core/playwright` is NOT in `approved-deps.json`, so file a dependency request in `PROGRESS.md` first. | n/a | P0-04 follow-up | n/a | recommendation |

## 15. Payments, SCA and surcharges (UKC-PAY)

| ID | Rule | Source | Implemented in | Verification | Status |
|---|---|---|---|---|---|
| UKC-PAY-01 | MUST: payment goes through Stripe **hosted Checkout** only. It handles SCA/3DS and exemptions automatically (UK SCA enforcement from 14 Mar 2022 per the research). No card form, no Stripe.js and no card data on our servers in P1 (architecture §2, §9). | https://docs.stripe.com/strong-customer-authentication | P1-11 | P1-11 param test: `ui_mode: 'hosted_page'`, and no `payment_method_types`. | unverified live (SCA date); design verified |
| UKC-PAY-02 | MUST NOT: vary the fee or any price by payment method (card, Apple Pay, Google Pay). The consumer card surcharge ban has applied since 13 Jan 2018. | N1 | P1-01, P1-11 | Covered by UKC-PRICE-07. | verified |
| UKC-PAY-03 | Facts for copy. On a direct charge, the **shop is merchant of record**: its name appears on the card statement, it handles disputes in its own Stripe Dashboard, and the platform never holds customer funds. Ask the lawyer to confirm the platform needs no FCA payment-services authorisation. | Stripe research; https://docs.stripe.com/connect/saas/tasks/refunds-disputes | P1-17 (terms) | Human review. | verified (Stripe); FCA → lawyer |
| UKC-PAY-04 | MUST NOT: hard-code Stripe GBP prices or dispute fees in merchant-facing copy. They are unverified live, and the GB "countered fee" and Smart Disputes pricing are doubtful. Link to https://stripe.com/gb/pricing instead. | stripeVerify | P1-17, P1-18 | Banned-strings check for `£20` in merchant copy (SHOULD). | unverified |

## 16. Aggregator-phase obligations (phase 4) (UKC-AGG)

No P1–P3 work. Read this before writing any P4 card.

| ID | Obligation | Source | Phase | Status |
|---|---|---|---|---|
| UKC-AGG-01 | Apple 3.1.3(e): food is a physical good consumed outside the app, so use Stripe, Apple Pay or card. **Never** use in-app purchase for meals. | https://developer.apple.com/app-store/review/guidelines/ (fetched; updated 8 Jun 2026) | P4 | verified |
| UKC-AGG-02 | Apple 4.2.6: one "picker" app hosting many restaurants is allowed. Per-restaurant white-label apps are allowed only under each restaurant's own developer account. Apple 4.3(a): ship **one** app for all cities; never one bundle ID per city. Apple 4.2: offer more than a repackaged website (saved addresses, order tracking with push, loyalty wallet, reorder). Apple 4.2.3(i): the app must work standalone. | Same | P4 | verified |
| UKC-AGG-03 | Apple 5.1.1(v): if the app supports account creation, it must offer in-app account deletion. Don't force login, and allow guest ordering. Apple 4.8: if Google or Facebook login is the primary sign-in, also offer an equivalent privacy-preserving login (e.g. Sign in with Apple). Email/SMS OTP only avoids this. | Same | P4 | verified |
| UKC-AGG-04 | iOS web push works only for Home Screen web apps (iOS 16.4+), with permission requested from a user gesture. Until the native app ships, QR-scan users get SMS/email updates. | https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers | P4 (PWA) | verified |
| UKC-AGG-05 | Google Play: physical goods (including food) are exempt from Play Billing. **Not fetched**; verify https://support.google.com/googleplay/android-developer/answer/9858738. Also not researched: the CMA's 2025–26 strategic-market-status conduct requirements for Apple and Google. | uk.json | P4 | unverified |
| UKC-AGG-06 | P2B Regulation (assimilated (EU) 2019/1150): the aggregator is probably an online intermediation service. That would require plain merchant T&Cs, disclosed main ranking parameters, 15 days' notice of T&C changes and internal complaint handling. Check that it still applies. | ukVerify | P4 | needs lawyer |
| UKC-AGG-07 | HMRC digital platform reporting (Reporting Platform Operators Regulations 2023, from 1 Jan 2024): the aggregator may have to collect seller due-diligence data and report merchant income to HMRC every year. It may already apply to the storefront SaaS (ask before P2-E1 self-serve sign-up, so onboarding collects the right seller data). | ukVerify | P2 (question) / P4 | needs accountant |
| UKC-AGG-08 | DMCCA Schedule 20 fake-reviews ban (from 6 Apr 2025, CMA208 guidance): take reasonable steps to prevent and remove fake or incentivised reviews. Recommended: reviews only from completed orders, incentives disclosed, no suppression of negative reviews. | ukVerify | P4 | ban: verified (single source); design → lawyer |
| UKC-AGG-09 | Cross-shop loyalty (P3): its own T&Cs, liability accounting for unredeemed points, and platform-level marketing consent (UKC-MKT-03). Gift cards or stored credit: check the e-money rules first. A paid subscription (e.g. a delivery pass) triggers the DMCCA subscription-contract regime, whose commencement is unverified. | uk.json, ukVerify | P3/P4 | needs lawyer |
| UKC-AGG-10 | Drip pricing (§1), allergens (§6) and trader identity (§5) apply inside the app too: the identity of each listed shop plus the platform's own. | §1, §5, §6 | P4 | verified |

---

## 17. Launch-blocking checklist for P1-20

The human ticks these, with evidence (a screenshot, a document reference or command output), in `docs/takeaway/reviews/P1-20-go-live-runbook.md`.

- [ ] Lawyer's written view on the fee display (UKC-PRICE-01…06) against the **current** CMA209 version, or a decision to fold the fee into prices (ADR plus golden-test change by a human).
- [ ] Lawyer approved the storefront legal templates (terms, privacy, allergen information, "About our service fee") and the merchant platform terms including the DPA. All `LAWYER REVIEW REQUIRED` markers are removed by a human.
- [ ] Lawyer approved the checkout copy: the pay button, the no-cancellation statement (reg 28 sub-paragraph settled), the statutory-rights line, the tip label and the `+ delivery from £Y.YY` text.
- [ ] Accountant answered the VAT questions (§18 accountant list, items 1–3); the `vat_category` help text is approved.
- [ ] Pilot shop: the footer shows the complete legal identity (UKC-ID-01), checked on the production storefront at 375 px width. If the shop is a limited company or LLP, the footer also shows the company number, the registered office address and the part of the UK where registered (UKC-ID-05).
- [ ] Pilot shop: every published item and option has all 14 allergens set; the owner confirmed in writing that the data is accurate; pre-packed items carry PPDS labels or are off the online menu.
- [ ] Pilot menu contains no alcohol or other age-restricted products.
- [ ] If the pilot shop trades after 23:00 (England/Wales), its premises licence authorises late night refreshment (UKC-AGE-03); the tick in the back office matches the licence.
- [ ] The shop phone is basic rate and answered during opening hours (allergy questions, problems, escalation calls).
- [ ] P1-17 tests green on `main`: banned strings, no cookies, no third-party requests. Manual DevTools check on the production storefront shows the same.
- [ ] Live £1 test order: the Stripe Checkout page shows a "Service fee" line; the total equals the pay-button amount; the confirmation email contains the shop identity, the itemised totals, the allergens and the no-cancellation statement; the printed kitchen ticket shows the allergens and the allergy note legibly.
- [ ] Allergen information at delivery (UKC-ALG-06/07): the pilot shop's staff put a printed copy of the ticket, with the allergens, in every bag; or the owner accepts the confirmation email as the written record at delivery, and drivers send allergy questions to the shop phone.
- [ ] Privacy: processor and sub-processor list final, retention periods decided and written into the notice, DPA signed with the pilot shop (as a schedule to the merchant platform agreement below), ICO fee status checked for Pocket Packet and the shop.
- [ ] The pilot shop has signed the lawyer-approved merchant platform agreement. It covers: the service fee and the authorisation to take it as an application fee; refund and dispute cost allocation (the shop bears Stripe's processing fee on refunds, disputed amounts and dispute fees; the platform keeps the 45p on partial refunds and disputes); the 0% commission commitment; pilot/founder pricing, including the date the £39/month starts; responsibility for allergen data (UKC-ALG-11); Tips Act duties (UKC-NAME-05); the DPA as a schedule. The signed copy's reference is recorded in the runbook.
- [ ] Pilot shop briefed on the Tips Act (100% to workers; written policy if tips are frequent) and on allergen-update duties.
- [ ] Accessibility smoke test by a human: a complete order using only the keyboard on the preview, and the token contrast values (UKC-A11Y-03) confirmed with a contrast tool.
- [ ] Breach and incident procedure and contacts are in the runbook (UKC-DP-08).
- [ ] Legacy CRM lockdown complete (formal go-live gate, architecture §15): P0-B2 (Supabase Auth login; every staff member has a new password), P0-B3 (RLS `to authenticated`; `anon` revoked, so an anon `select` on `customers` and on `profiles` returns a permission error; `password_hash` dropped; the CRM project's API keys rotated) and P0-B4 (PDF `innerHTML` XSS fixed) are merged and applied to the CRM's live database. Evidence: merged PR links, the anon `select` output, and the human's apply and key-rotation record. Restricting access to the CRM page alone does not count: the old key is already in `index.html`.
- [ ] The lawyer has been asked about the CRM's past exposure (UKC-DP-09).
- [ ] Re-checked the `unverified` items that affect launch (current CMA209 version, Owen's Law status, Stripe GB fees used in any copy), with the result recorded in `PROGRESS.md`.

## 18. Questions for the lawyer / accountant

**Lawyer (UK consumer, data protection and, later, licensing)**

1. **CMA209:** is the combination of a persistent menu notice, the fee next to the add button, a running total that includes the fee from the first item, and an itemised checkout enough? Or must the 45p be built into each item price? Is the text "+ delivery from £Y.YY" beside the running total enough before the postcode is known, or must the minimum delivery fee be in the running total?
2. **The 45p counterparty:** is the consumer's 45p contract with the shop or with Pocket Packet? Is Pocket Packet a "trader" toward consumers? What must "About our service fee" and the footer say about the platform?
3. **Reg 28:** does (1)(b) or (1)(c) apply to made-to-order hot food? Approve the final no-cancellation wording, bearing in mind that P1 has no customer self-cancel button.
4. **Reg 14(4):** is "Place order and pay £X.XX" adequate? Which Schedule 2 items must appear directly before the button?
5. **Partial refunds:** is keeping the 45p on a partial refund (e.g. one missing item) compatible with CRA remedies and the fair-terms rules? Can the terms say so?
6. **Trader identity:** which fields are required for sole traders, partnerships and limited companies (registered office, part of the UK where registered)? Must Pocket Packet's identity appear on every shop site?
7. **Allergy note:** if it is health data (Art 9), which condition applies? Is the "call the shop" approach plus written information enough?
8. **Data roles:** confirm the controller/processor split; DPA terms; Stripe's role; transfers to US providers (Twilio, Resend, Vercel); the sub-processor list.
9. **Retention:** set the periods for customer contact data, notes and allergy notes.
10. **ICO fee:** do Pocket Packet and each shop need to pay the data protection fee? (From general knowledge; unverified.)
11. **Legacy CRM:** is its past open access a notifiable breach (Art 33) or a matter to tell individuals about (Art 34)?
12. **Storage:** confirm that the `sessionStorage` basket, the merchant auth session and the language preference need no consent.
13. **Reg 41:** confirm the list of non-basic-rate prefixes.
14. **Merchant terms:** how is liability allocated for allergen accuracy, menu prices, refunds, chargebacks and Tips Act compliance?
15. **FCA:** confirm the platform needs no payment-services authorisation, given that funds go straight to the shop's Stripe account.
16. **Merchant-facing claims:** "0% commission forever" (a written commitment), comparisons with OrderYOYO (75p), Just Eat and Deliveroo, and "limited founding-customer places". Do these comply with the B2B misleading-advertising and comparative-advertising rules?
17. **Phase 2+:** alcohol in all four nations; the energy-drink ban; NI online FHRS display; whether Pocket Packet, as the printer, bears any risk for the Welsh leaflet statement.
18. **Phase 3/4:** loyalty T&Cs and e-money; PECR consent wording; P2B; fake reviews; the subscription-contract regime.

**Accountant**

1. VAT on the 45p (B2C booking fee or B2B commission; VAT-inclusive means 7.5p VAT), on the £149 setup and on the £39/month. Which entity runs the platform, and is it VAT-registered? Check the £90,000 threshold for 2026/27.
2. Approve the `vat_category` help text (Notice 709/1). Must P1-18 reports split sales by VAT category (from `order_items.vat_category_snapshot`, UKC-VAT-02)? Do VAT-registered shops need VAT receipts from the platform?
3. Accounting for application fees, refunded fees, retained fees on disputes, and ledger reconciliation with Stripe payouts.
4. Record-retention period for order financial data.
5. Before P2-E1 (self-serve sign-up): whether the HMRC Reporting Platform Operators Regulations 2023 already apply to the storefront SaaS (the shop is merchant of record) or only to the P4 aggregator. Phase 3/4: liability accounting for loyalty points.
