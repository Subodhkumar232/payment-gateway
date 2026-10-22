import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidTransition,
  assertValidTransition,
  toPublicOutcome
} from '../index.js';
import {
  isTerminalStatus,
  holdsSlot
} from '@youpi/common';
import { PaymentStatus, PublicPaymentOutcome } from '@youpi/common';

describe('SUSPICIOUS Payment Status', () => {
  test('ACTIVE -> SUSPICIOUS is a valid transition', () => {
    assert.equal(isValidTransition(PaymentStatus.ACTIVE, PaymentStatus.SUSPICIOUS), true);
  });

  test('PROCESSING -> SUSPICIOUS is a valid transition', () => {
    assert.equal(isValidTransition(PaymentStatus.PROCESSING, PaymentStatus.SUSPICIOUS), true);
  });

  test('SUSPICIOUS is terminal: no outbound transitions are allowed', () => {
    const allStates = [
      PaymentStatus.INITIATED,
      PaymentStatus.QUEUED,
      PaymentStatus.ACTIVE,
      PaymentStatus.PROCESSING,
      PaymentStatus.SUCCESS,
      PaymentStatus.FAILED,
      PaymentStatus.EXPIRED,
      PaymentStatus.CANCELLED,
      PaymentStatus.SUSPICIOUS
    ];

    for (const target of allStates) {
      assert.equal(
        isValidTransition(PaymentStatus.SUSPICIOUS, target),
        false,
        `Expected isValidTransition('SUSPICIOUS', '${target}') to be false`
      );
      assert.throws(
        () => assertValidTransition(PaymentStatus.SUSPICIOUS, target),
        /Illegal payment state transition/
      );
    }
  });

  test('isTerminalStatus returns true for SUSPICIOUS', () => {
    assert.equal(isTerminalStatus(PaymentStatus.SUSPICIOUS), true);
  });

  test('holdsSlot returns false for SUSPICIOUS', () => {
    assert.equal(holdsSlot(PaymentStatus.SUSPICIOUS), false);
  });

  test('toPublicOutcome maps SUSPICIOUS to SUSPICIOUS', () => {
    assert.equal(toPublicOutcome(PaymentStatus.SUSPICIOUS), PublicPaymentOutcome.SUSPICIOUS);
  });

  test('existing transitions are not affected', () => {
    assert.equal(isValidTransition(PaymentStatus.INITIATED, PaymentStatus.ACTIVE), true);
    assert.equal(isValidTransition(PaymentStatus.INITIATED, PaymentStatus.QUEUED), true);
    assert.equal(isValidTransition(PaymentStatus.QUEUED, PaymentStatus.ACTIVE), true);
    assert.equal(isValidTransition(PaymentStatus.ACTIVE, PaymentStatus.PROCESSING), true);
    assert.equal(isValidTransition(PaymentStatus.PROCESSING, PaymentStatus.SUCCESS), true);
    assert.equal(isValidTransition(PaymentStatus.PROCESSING, PaymentStatus.FAILED), true);
    assert.equal(isValidTransition(PaymentStatus.ACTIVE, PaymentStatus.SUCCESS), true);
    assert.equal(isValidTransition(PaymentStatus.ACTIVE, PaymentStatus.EXPIRED), true);
    assert.equal(isValidTransition(PaymentStatus.ACTIVE, PaymentStatus.CANCELLED), true);
    assert.equal(isValidTransition(PaymentStatus.INITIATED, PaymentStatus.SUCCESS), true);
    assert.equal(isValidTransition(PaymentStatus.QUEUED, PaymentStatus.SUCCESS), true);

    // Transitions that were invalid before must remain invalid
    assert.equal(isValidTransition(PaymentStatus.QUEUED, PaymentStatus.PROCESSING), false);
    assert.equal(isValidTransition(PaymentStatus.EXPIRED, PaymentStatus.SUCCESS), false);
    assert.equal(isValidTransition(PaymentStatus.SUCCESS, PaymentStatus.FAILED), false);
    assert.equal(isValidTransition(PaymentStatus.SUCCESS, PaymentStatus.ACTIVE), false);
    assert.equal(isValidTransition(PaymentStatus.PROCESSING, PaymentStatus.ACTIVE), false);
  });
});
