// GOLDEN ACCEPTANCE TEST — P1-02 (order state machine)
// Source of truth: docs/takeaway/acceptance/P1-02/. Installed by `pnpm acceptance:install P1-02`.
// Agents must not edit this file. Spec: docs/takeaway/reference/architecture.md §6.
import { describe, expect, it } from 'vitest';
import {
  allowedEvents,
  isTerminal,
  OrderTransitionError,
  paymentStatusAfterRefund,
  transition,
  type OrderSnapshot,
} from '../../src/index';

const collectionPlaced: OrderSnapshot = { status: 'placed', paymentStatus: 'paid', fulfilment: 'collection' };
const deliveryPlaced: OrderSnapshot = { status: 'placed', paymentStatus: 'paid', fulfilment: 'delivery' };
const ACCEPT = { type: 'accept', promisedTime: '2026-11-02T18:45:00Z' } as const;

function expectTransitionError(fn: () => unknown, code: 'ILLEGAL_TRANSITION' | 'INVALID_EVENT') {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(OrderTransitionError);
    expect((err as OrderTransitionError).code).toBe(code);
    return;
  }
  throw new Error(`expected OrderTransitionError with code ${code}`);
}

describe('happy paths', () => {
  it('collection: pending_payment → placed → accepted → ready_for_collection → completed', () => {
    let o: OrderSnapshot = { status: 'pending_payment', paymentStatus: 'unpaid', fulfilment: 'collection' };
    let r = transition(o, { type: 'payment_succeeded' });
    expect(r).toEqual({ status: 'placed', paymentStatus: 'paid', requiresRefund: false });
    o = { ...o, status: r.status, paymentStatus: r.paymentStatus };
    r = transition(o, ACCEPT);
    expect(r).toEqual({ status: 'accepted', paymentStatus: 'paid', requiresRefund: false });
    o = { ...o, status: r.status };
    r = transition(o, { type: 'ready' });
    expect(r.status).toBe('ready_for_collection');
    o = { ...o, status: r.status };
    r = transition(o, { type: 'complete' });
    expect(r).toEqual({ status: 'completed', paymentStatus: 'paid', requiresRefund: false });
  });

  it('delivery: placed → accepted → out_for_delivery → completed', () => {
    let o: OrderSnapshot = deliveryPlaced;
    let r = transition(o, ACCEPT);
    o = { ...o, status: r.status };
    r = transition(o, { type: 'dispatch' });
    expect(r.status).toBe('out_for_delivery');
    o = { ...o, status: r.status };
    r = transition(o, { type: 'complete' });
    expect(r.status).toBe('completed');
  });
});

describe('fulfilment-specific events', () => {
  it('ready is only for collection orders', () => {
    expectTransitionError(() => transition({ ...deliveryPlaced, status: 'accepted' }, { type: 'ready' }), 'ILLEGAL_TRANSITION');
  });

  it('dispatch is only for delivery orders', () => {
    expectTransitionError(() => transition({ ...collectionPlaced, status: 'accepted' }, { type: 'dispatch' }), 'ILLEGAL_TRANSITION');
  });

  it('cannot skip acceptance', () => {
    expectTransitionError(() => transition(collectionPlaced, { type: 'ready' }), 'ILLEGAL_TRANSITION');
    expectTransitionError(() => transition(deliveryPlaced, { type: 'dispatch' }), 'ILLEGAL_TRANSITION');
    expectTransitionError(() => transition(collectionPlaced, { type: 'complete' }), 'ILLEGAL_TRANSITION');
  });
});

describe('payment and expiry', () => {
  it('checkout_expired moves an unpaid pending order to expired', () => {
    const r = transition({ status: 'pending_payment', paymentStatus: 'unpaid', fulfilment: 'delivery' }, { type: 'checkout_expired' });
    expect(r).toEqual({ status: 'expired', paymentStatus: 'unpaid', requiresRefund: false });
  });

  it('checkout_expired is illegal once the order is placed', () => {
    expectTransitionError(() => transition(collectionPlaced, { type: 'checkout_expired' }), 'ILLEGAL_TRANSITION');
  });

  it('a payment that arrives after the order expired or was cancelled is recorded and must be refunded', () => {
    for (const status of ['expired', 'cancelled'] as const) {
      const r = transition({ status, paymentStatus: 'unpaid', fulfilment: 'collection' }, { type: 'payment_succeeded' });
      expect(r).toEqual({ status, paymentStatus: 'paid', requiresRefund: true });
    }
  });

  it('payment_succeeded is illegal when the order is already paid', () => {
    expectTransitionError(() => transition(collectionPlaced, { type: 'payment_succeeded' }), 'ILLEGAL_TRANSITION');
  });

  it('accept requires a paid order', () => {
    expectTransitionError(
      () => transition({ status: 'placed', paymentStatus: 'unpaid', fulfilment: 'collection' }, ACCEPT),
      'ILLEGAL_TRANSITION',
    );
  });
});

describe('reject and cancel', () => {
  it('rejecting a paid placed order requires a refund', () => {
    const r = transition(collectionPlaced, { type: 'reject', reason: 'Too busy' });
    expect(r).toEqual({ status: 'rejected', paymentStatus: 'paid', requiresRefund: true });
  });

  it('reject is only allowed from placed', () => {
    expectTransitionError(() => transition({ ...collectionPlaced, status: 'accepted' }, { type: 'reject', reason: 'x' }), 'ILLEGAL_TRANSITION');
    expectTransitionError(
      () => transition({ status: 'pending_payment', paymentStatus: 'unpaid', fulfilment: 'collection' }, { type: 'reject', reason: 'x' }),
      'ILLEGAL_TRANSITION',
    );
  });

  it('reject and cancel need a non-empty reason', () => {
    expectTransitionError(() => transition(collectionPlaced, { type: 'reject', reason: '' }), 'INVALID_EVENT');
    expectTransitionError(() => transition(collectionPlaced, { type: 'reject', reason: '   ' }), 'INVALID_EVENT');
    expectTransitionError(() => transition(collectionPlaced, { type: 'cancel', reason: '' }), 'INVALID_EVENT');
  });

  it('cancelling an unpaid pending order needs no refund', () => {
    const r = transition({ status: 'pending_payment', paymentStatus: 'unpaid', fulfilment: 'collection' }, { type: 'cancel', reason: 'Customer abandoned' });
    expect(r).toEqual({ status: 'cancelled', paymentStatus: 'unpaid', requiresRefund: false });
  });

  it('cancelling a paid placed or accepted order requires a refund', () => {
    expect(transition(collectionPlaced, { type: 'cancel', reason: 'Out of stock' })).toEqual({
      status: 'cancelled',
      paymentStatus: 'paid',
      requiresRefund: true,
    });
    expect(transition({ ...deliveryPlaced, status: 'accepted' }, { type: 'cancel', reason: 'Driver unavailable' })).toEqual({
      status: 'cancelled',
      paymentStatus: 'paid',
      requiresRefund: true,
    });
  });

  it('cannot cancel once ready or out for delivery', () => {
    expectTransitionError(() => transition({ ...collectionPlaced, status: 'ready_for_collection' }, { type: 'cancel', reason: 'x' }), 'ILLEGAL_TRANSITION');
    expectTransitionError(() => transition({ ...deliveryPlaced, status: 'out_for_delivery' }, { type: 'cancel', reason: 'x' }), 'ILLEGAL_TRANSITION');
  });
});

describe('event validation', () => {
  it('accept needs a promised time', () => {
    expectTransitionError(() => transition(collectionPlaced, { type: 'accept', promisedTime: '' }), 'INVALID_EVENT');
  });

  it('unknown event types are invalid', () => {
    expectTransitionError(() => transition(collectionPlaced, { type: 'teleport' } as never), 'INVALID_EVENT');
  });
});

describe('terminal states', () => {
  it('identifies terminal states', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('rejected')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('expired')).toBe(true);
    for (const s of ['pending_payment', 'placed', 'accepted', 'ready_for_collection', 'out_for_delivery'] as const) {
      expect(isTerminal(s)).toBe(false);
    }
  });

  it('no fulfilment event is legal from a terminal state', () => {
    const events = [ACCEPT, { type: 'ready' }, { type: 'dispatch' }, { type: 'complete' }, { type: 'reject', reason: 'x' }, { type: 'cancel', reason: 'x' }, { type: 'checkout_expired' }] as const;
    for (const status of ['completed', 'rejected'] as const) {
      for (const ev of events) {
        expectTransitionError(() => transition({ status, paymentStatus: 'paid', fulfilment: 'collection' }, ev), 'ILLEGAL_TRANSITION');
      }
    }
  });

  it('does not mutate its input', () => {
    const o: OrderSnapshot = { ...collectionPlaced };
    transition(o, ACCEPT);
    expect(o).toEqual(collectionPlaced);
  });
});

describe('allowedEvents', () => {
  it('lists the legal events for common states', () => {
    expect(new Set(allowedEvents({ status: 'pending_payment', paymentStatus: 'unpaid', fulfilment: 'collection' }))).toEqual(
      new Set(['payment_succeeded', 'checkout_expired', 'cancel']),
    );
    expect(new Set(allowedEvents(collectionPlaced))).toEqual(new Set(['accept', 'reject', 'cancel']));
    expect(new Set(allowedEvents({ ...collectionPlaced, status: 'accepted' }))).toEqual(new Set(['ready', 'cancel']));
    expect(new Set(allowedEvents({ ...deliveryPlaced, status: 'accepted' }))).toEqual(new Set(['dispatch', 'cancel']));
    expect(new Set(allowedEvents({ ...collectionPlaced, status: 'ready_for_collection' }))).toEqual(new Set(['complete']));
    expect(allowedEvents({ ...collectionPlaced, status: 'completed' })).toEqual([]);
  });

  it('agrees with transition() for every state, payment status, fulfilment and event', () => {
    const statuses = ['pending_payment', 'placed', 'accepted', 'ready_for_collection', 'out_for_delivery', 'completed', 'rejected', 'cancelled', 'expired'] as const;
    const payments = ['unpaid', 'paid'] as const;
    const fulfilments = ['collection', 'delivery'] as const;
    const events = [
      { type: 'payment_succeeded' },
      { type: 'checkout_expired' },
      ACCEPT,
      { type: 'reject', reason: 'x' },
      { type: 'ready' },
      { type: 'dispatch' },
      { type: 'complete' },
      { type: 'cancel', reason: 'x' },
    ] as const;
    for (const status of statuses) {
      for (const paymentStatus of payments) {
        for (const fulfilment of fulfilments) {
          const o: OrderSnapshot = { status, paymentStatus, fulfilment };
          const allowed = new Set(allowedEvents(o));
          for (const ev of events) {
            let legal = true;
            try {
              transition(o, ev);
            } catch (err) {
              expect(err).toBeInstanceOf(OrderTransitionError);
              legal = false;
            }
            expect({ status, paymentStatus, fulfilment, event: ev.type, legal }).toEqual({
              status,
              paymentStatus,
              fulfilment,
              event: ev.type,
              legal: allowed.has(ev.type),
            });
          }
        }
      }
    }
  });
});

describe('paymentStatusAfterRefund', () => {
  it('maps refunded amounts to payment status', () => {
    expect(paymentStatusAfterRefund({ totalPence: 2045, refundedPence: 0 })).toBe('paid');
    expect(paymentStatusAfterRefund({ totalPence: 2045, refundedPence: 500 })).toBe('partially_refunded');
    expect(paymentStatusAfterRefund({ totalPence: 2045, refundedPence: 2045 })).toBe('refunded');
  });

  it('rejects impossible refund amounts', () => {
    expect(() => paymentStatusAfterRefund({ totalPence: 2045, refundedPence: -1 })).toThrow(RangeError);
    expect(() => paymentStatusAfterRefund({ totalPence: 2045, refundedPence: 2046 })).toThrow(RangeError);
    expect(() => paymentStatusAfterRefund({ totalPence: 2045, refundedPence: 1.5 })).toThrow(RangeError);
  });
});
