// GOLDEN ACCEPTANCE TEST — P1-01 (pricing engine)
// Source of truth: docs/takeaway/acceptance/P1-01/. Installed by `pnpm acceptance:install P1-01`.
// Agents must not edit this file. Spec: docs/takeaway/reference/architecture.md §4–§5.
import { describe, expect, it } from 'vitest';
import { formatPence, priceOrder, PricingError, type PricingInput } from '../../src/index';

const zone = { feePence: 250, minimumOrderPence: 1200, freeDeliveryThresholdPence: null };

function base(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    lines: [{ itemId: 'chips', unitPricePence: 350, quantity: 2 }],
    fulfilment: 'collection',
    serviceFeePence: 45,
    ...overrides,
  };
}

function expectPricingError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(PricingError);
    expect((err as PricingError).code).toBe(code);
    return;
  }
  throw new Error(`expected PricingError with code ${code}`);
}

describe('priceOrder — line totals and subtotal', () => {
  it('multiplies unit price by quantity', () => {
    const r = priceOrder(base());
    expect(r.lines).toEqual([{ itemId: 'chips', lineTotalPence: 700 }]);
    expect(r.itemsSubtotalPence).toBe(700);
  });

  it('adds option prices (default option quantity 1) before multiplying by line quantity', () => {
    const r = priceOrder(
      base({
        lines: [
          {
            itemId: 'burger',
            unitPricePence: 650,
            quantity: 2,
            options: [
              { optionId: 'cheese', pricePence: 50 },
              { optionId: 'bacon', pricePence: 100, quantity: 2 },
            ],
          },
        ],
      }),
    );
    // (650 + 50 + 100*2) * 2 = 1800
    expect(r.lines[0]?.lineTotalPence).toBe(1800);
    expect(r.itemsSubtotalPence).toBe(1800);
  });

  it('sums several lines and keeps their order', () => {
    const r = priceOrder(
      base({
        lines: [
          { itemId: 'a', unitPricePence: 100, quantity: 1 },
          { itemId: 'b', unitPricePence: 275, quantity: 3 },
          { itemId: 'c', unitPricePence: 0, quantity: 1 },
        ],
      }),
    );
    expect(r.lines.map((l) => l.itemId)).toEqual(['a', 'b', 'c']);
    expect(r.lines.map((l) => l.lineTotalPence)).toEqual([100, 825, 0]);
    expect(r.itemsSubtotalPence).toBe(925);
  });

  it('allows zero-priced items and options', () => {
    const r = priceOrder(
      base({ lines: [{ itemId: 'dip', unitPricePence: 0, quantity: 1, options: [{ optionId: 'x', pricePence: 0 }] }] }),
    );
    expect(r.itemsSubtotalPence).toBe(0);
    expect(r.totalPence).toBe(45);
  });
});

describe('priceOrder — service fee and application fee', () => {
  it('charges the service fee on collection orders and uses it as the application fee', () => {
    const r = priceOrder(base());
    expect(r.serviceFeePence).toBe(45);
    expect(r.applicationFeePence).toBe(45);
    expect(r.totalPence).toBe(745);
  });

  it('charges the service fee on delivery orders', () => {
    const r = priceOrder(
      base({ fulfilment: 'delivery', zone, lines: [{ itemId: 'x', unitPricePence: 1500, quantity: 1 }] }),
    );
    expect(r.serviceFeePence).toBe(45);
    expect(r.applicationFeePence).toBe(45);
    expect(r.totalPence).toBe(1500 + 250 + 45);
  });

  it('respects a non-default service fee', () => {
    const r = priceOrder(base({ serviceFeePence: 75 }));
    expect(r.serviceFeePence).toBe(75);
    expect(r.applicationFeePence).toBe(75);
    expect(r.totalPence).toBe(775);
  });

  it('allows a zero service fee (promotional shops)', () => {
    const r = priceOrder(base({ serviceFeePence: 0 }));
    expect(r.applicationFeePence).toBe(0);
    expect(r.totalPence).toBe(700);
  });

  it('never discounts the service fee, even with a 100% discount', () => {
    const r = priceOrder(base({ discount: { kind: 'percent', basisPoints: 10000 } }));
    expect(r.discountPence).toBe(700);
    expect(r.serviceFeePence).toBe(45);
    expect(r.totalPence).toBe(45);
    expect(r.applicationFeePence).toBe(45);
  });

  it('never takes the application fee from the tip', () => {
    const r = priceOrder(base({ tipPence: 200 }));
    expect(r.tipPence).toBe(200);
    expect(r.applicationFeePence).toBe(45);
    expect(r.totalPence).toBe(700 + 45 + 200);
  });
});

describe('priceOrder — delivery fee and zones', () => {
  it('uses zero delivery fee for collection even if a zone is passed', () => {
    const r = priceOrder(base({ zone }));
    expect(r.deliveryFeePence).toBe(0);
  });

  it('requires a zone for delivery', () => {
    expectPricingError(() => priceOrder(base({ fulfilment: 'delivery' })), 'ZONE_REQUIRED');
    expectPricingError(() => priceOrder(base({ fulfilment: 'delivery', zone: null })), 'ZONE_REQUIRED');
  });

  it('waives the delivery fee when the items subtotal reaches the free-delivery threshold', () => {
    const z = { feePence: 300, minimumOrderPence: 1000, freeDeliveryThresholdPence: 2000 };
    const below = priceOrder(base({ fulfilment: 'delivery', zone: z, lines: [{ itemId: 'x', unitPricePence: 1999, quantity: 1 }] }));
    expect(below.deliveryFeePence).toBe(300);
    const atThreshold = priceOrder(base({ fulfilment: 'delivery', zone: z, lines: [{ itemId: 'x', unitPricePence: 2000, quantity: 1 }] }));
    expect(atThreshold.deliveryFeePence).toBe(0);
    expect(atThreshold.totalPence).toBe(2045);
  });

  it('compares the free-delivery threshold against the subtotal BEFORE discount', () => {
    const z = { feePence: 300, minimumOrderPence: 0, freeDeliveryThresholdPence: 2000 };
    const r = priceOrder(
      base({
        fulfilment: 'delivery',
        zone: z,
        lines: [{ itemId: 'x', unitPricePence: 2000, quantity: 1 }],
        discount: { kind: 'fixed', amountPence: 500 },
      }),
    );
    expect(r.deliveryFeePence).toBe(0);
    expect(r.discountPence).toBe(500);
    expect(r.totalPence).toBe(2000 - 500 + 0 + 45);
  });
});

describe('priceOrder — discounts', () => {
  it('applies a percentage discount to items only, rounding down to the penny', () => {
    // 10% of 999 = 99.9 -> 99
    const r = priceOrder(base({ lines: [{ itemId: 'x', unitPricePence: 999, quantity: 1 }], discount: { kind: 'percent', basisPoints: 1000 } }));
    expect(r.discountPence).toBe(99);
    expect(r.totalPence).toBe(999 - 99 + 45);
  });

  it('applies a percentage discount with basis-point precision', () => {
    // 12.5% of 1600 = 200
    const r = priceOrder(base({ lines: [{ itemId: 'x', unitPricePence: 1600, quantity: 1 }], discount: { kind: 'percent', basisPoints: 1250 } }));
    expect(r.discountPence).toBe(200);
  });

  it('does not apply a percentage discount to the delivery fee', () => {
    const r = priceOrder(
      base({
        fulfilment: 'delivery',
        zone,
        lines: [{ itemId: 'x', unitPricePence: 2000, quantity: 1 }],
        discount: { kind: 'percent', basisPoints: 5000 },
      }),
    );
    expect(r.discountPence).toBe(1000);
    expect(r.deliveryFeePence).toBe(250);
    expect(r.totalPence).toBe(2000 - 1000 + 250 + 45);
  });

  it('caps a fixed discount at the items subtotal', () => {
    const r = priceOrder(base({ discount: { kind: 'fixed', amountPence: 5000 } }));
    expect(r.discountPence).toBe(700);
    expect(r.totalPence).toBe(45);
  });

  it('applies a fixed discount below the subtotal unchanged', () => {
    const r = priceOrder(base({ discount: { kind: 'fixed', amountPence: 150 } }));
    expect(r.discountPence).toBe(150);
    expect(r.totalPence).toBe(700 - 150 + 45);
  });

  it('free_delivery discount equals the delivery fee and keeps the delivery line visible', () => {
    const r = priceOrder(
      base({ fulfilment: 'delivery', zone, lines: [{ itemId: 'x', unitPricePence: 1500, quantity: 1 }], discount: { kind: 'free_delivery' } }),
    );
    expect(r.deliveryFeePence).toBe(250);
    expect(r.discountPence).toBe(250);
    expect(r.totalPence).toBe(1500 + 45);
  });

  it('free_delivery discount is worth zero on collection orders', () => {
    const r = priceOrder(base({ discount: { kind: 'free_delivery' } }));
    expect(r.discountPence).toBe(0);
    expect(r.totalPence).toBe(745);
  });

  it('free_delivery discount is worth zero when the threshold already waived delivery', () => {
    const z = { feePence: 300, minimumOrderPence: 0, freeDeliveryThresholdPence: 1000 };
    const r = priceOrder(
      base({ fulfilment: 'delivery', zone: z, lines: [{ itemId: 'x', unitPricePence: 1000, quantity: 1 }], discount: { kind: 'free_delivery' } }),
    );
    expect(r.deliveryFeePence).toBe(0);
    expect(r.discountPence).toBe(0);
    expect(r.totalPence).toBe(1045);
  });

  it('treats null or missing discount as no discount', () => {
    expect(priceOrder(base({ discount: null })).discountPence).toBe(0);
    expect(priceOrder(base()).discountPence).toBe(0);
  });

  it('rejects invalid discounts', () => {
    expectPricingError(() => priceOrder(base({ discount: { kind: 'percent', basisPoints: 0 } })), 'INVALID_DISCOUNT');
    expectPricingError(() => priceOrder(base({ discount: { kind: 'percent', basisPoints: 10001 } })), 'INVALID_DISCOUNT');
    expectPricingError(() => priceOrder(base({ discount: { kind: 'percent', basisPoints: 12.5 } })), 'INVALID_DISCOUNT');
    expectPricingError(() => priceOrder(base({ discount: { kind: 'fixed', amountPence: 0 } })), 'INVALID_DISCOUNT');
    expectPricingError(() => priceOrder(base({ discount: { kind: 'fixed', amountPence: -100 } })), 'INVALID_DISCOUNT');
    expectPricingError(() => priceOrder(base({ discount: { kind: 'fixed', amountPence: 1.5 } })), 'INVALID_DISCOUNT');
  });
});

describe('priceOrder — minimum order', () => {
  it('uses the zone minimum for delivery and compares the subtotal BEFORE discount', () => {
    const r = priceOrder(
      base({
        fulfilment: 'delivery',
        zone,
        lines: [{ itemId: 'x', unitPricePence: 1200, quantity: 1 }],
        discount: { kind: 'fixed', amountPence: 500 },
      }),
    );
    expect(r.minimumOrderPence).toBe(1200);
    expect(r.meetsMinimumOrder).toBe(true);
    expect(r.shortfallPence).toBe(0);
  });

  it('reports the shortfall when below the minimum but still returns a full result', () => {
    const r = priceOrder(base({ fulfilment: 'delivery', zone, lines: [{ itemId: 'x', unitPricePence: 1000, quantity: 1 }] }));
    expect(r.meetsMinimumOrder).toBe(false);
    expect(r.shortfallPence).toBe(200);
    expect(r.totalPence).toBe(1000 + 250 + 45);
  });

  it('defaults the collection minimum to zero and honours an explicit collection minimum', () => {
    const none = priceOrder(base());
    expect(none.minimumOrderPence).toBe(0);
    expect(none.meetsMinimumOrder).toBe(true);
    const withMin = priceOrder(base({ collectionMinimumOrderPence: 800 }));
    expect(withMin.minimumOrderPence).toBe(800);
    expect(withMin.meetsMinimumOrder).toBe(false);
    expect(withMin.shortfallPence).toBe(100);
  });

  it('does not count the service fee, delivery fee or tip towards the minimum', () => {
    const r = priceOrder(
      base({ fulfilment: 'delivery', zone, lines: [{ itemId: 'x', unitPricePence: 1199, quantity: 1 }], tipPence: 500 }),
    );
    expect(r.meetsMinimumOrder).toBe(false);
    expect(r.shortfallPence).toBe(1);
  });
});

describe('priceOrder — tip', () => {
  it('defaults the tip to zero', () => {
    expect(priceOrder(base()).tipPence).toBe(0);
  });

  it('rejects negative or fractional tips', () => {
    expectPricingError(() => priceOrder(base({ tipPence: -1 })), 'INVALID_AMOUNT');
    expectPricingError(() => priceOrder(base({ tipPence: 10.5 })), 'INVALID_AMOUNT');
  });
});

describe('priceOrder — validation', () => {
  it('rejects an empty basket', () => {
    expectPricingError(() => priceOrder(base({ lines: [] })), 'EMPTY_BASKET');
  });

  it('rejects invalid quantities', () => {
    for (const quantity of [0, -1, 100, 1.5, Number.NaN]) {
      expectPricingError(() => priceOrder(base({ lines: [{ itemId: 'x', unitPricePence: 100, quantity }] })), 'INVALID_QUANTITY');
    }
  });

  it('accepts the boundary quantities 1 and 99', () => {
    expect(priceOrder(base({ lines: [{ itemId: 'x', unitPricePence: 100, quantity: 1 }] })).itemsSubtotalPence).toBe(100);
    expect(priceOrder(base({ lines: [{ itemId: 'x', unitPricePence: 100, quantity: 99 }] })).itemsSubtotalPence).toBe(9900);
  });

  it('rejects invalid option quantities', () => {
    expectPricingError(
      () => priceOrder(base({ lines: [{ itemId: 'x', unitPricePence: 100, quantity: 1, options: [{ optionId: 'o', pricePence: 10, quantity: 0 }] }] })),
      'INVALID_QUANTITY',
    );
  });

  it('rejects negative, fractional or non-finite money amounts', () => {
    expectPricingError(() => priceOrder(base({ lines: [{ itemId: 'x', unitPricePence: -1, quantity: 1 }] })), 'INVALID_AMOUNT');
    expectPricingError(() => priceOrder(base({ lines: [{ itemId: 'x', unitPricePence: 3.5, quantity: 1 }] })), 'INVALID_AMOUNT');
    expectPricingError(() => priceOrder(base({ lines: [{ itemId: 'x', unitPricePence: Number.POSITIVE_INFINITY, quantity: 1 }] })), 'INVALID_AMOUNT');
    expectPricingError(
      () => priceOrder(base({ lines: [{ itemId: 'x', unitPricePence: 100, quantity: 1, options: [{ optionId: 'o', pricePence: -5 }] }] })),
      'INVALID_AMOUNT',
    );
    expectPricingError(() => priceOrder(base({ serviceFeePence: -45 })), 'INVALID_AMOUNT');
    expectPricingError(() => priceOrder(base({ serviceFeePence: 0.45 })), 'INVALID_AMOUNT');
    expectPricingError(
      () => priceOrder(base({ fulfilment: 'delivery', zone: { feePence: -1, minimumOrderPence: 0, freeDeliveryThresholdPence: null } })),
      'INVALID_AMOUNT',
    );
  });

  it('does not mutate its input', () => {
    const input = base({ discount: { kind: 'percent', basisPoints: 1000 }, tipPence: 100 });
    const snapshot = JSON.parse(JSON.stringify(input));
    priceOrder(input);
    expect(input).toEqual(snapshot);
  });

  it('produces only safe integers', () => {
    const r = priceOrder(
      base({
        fulfilment: 'delivery',
        zone,
        lines: [
          { itemId: 'a', unitPricePence: 1333, quantity: 3, options: [{ optionId: 'o', pricePence: 17, quantity: 3 }] },
          { itemId: 'b', unitPricePence: 999, quantity: 7 },
        ],
        discount: { kind: 'percent', basisPoints: 333 },
        tipPence: 123,
      }),
    );
    for (const value of [r.itemsSubtotalPence, r.discountPence, r.deliveryFeePence, r.serviceFeePence, r.tipPence, r.totalPence, r.applicationFeePence]) {
      expect(Number.isSafeInteger(value)).toBe(true);
    }
    expect(r.totalPence).toBe(r.itemsSubtotalPence - r.discountPence + r.deliveryFeePence + r.serviceFeePence + r.tipPence);
  });
});

describe('priceOrder — worked example from the business plan', () => {
  it('£20.00 of food on collection costs the customer £20.45 and the platform fee is £0.45', () => {
    const r = priceOrder(base({ lines: [{ itemId: 'meal', unitPricePence: 2000, quantity: 1 }] }));
    expect(r.totalPence).toBe(2045);
    expect(r.applicationFeePence).toBe(45);
    expect(formatPence(r.totalPence)).toBe('£20.45');
  });
});

describe('formatPence', () => {
  it('formats pence as en-GB pounds', () => {
    expect(formatPence(0)).toBe('£0.00');
    expect(formatPence(5)).toBe('£0.05');
    expect(formatPence(45)).toBe('£0.45');
    expect(formatPence(2045)).toBe('£20.45');
    expect(formatPence(123456)).toBe('£1,234.56');
  });

  it('formats negative amounts with a leading minus', () => {
    expect(formatPence(-120)).toBe('-£1.20');
  });

  it('rejects non-integer input', () => {
    expect(() => formatPence(1.5)).toThrow(RangeError);
    expect(() => formatPence(Number.NaN)).toThrow(RangeError);
  });
});
