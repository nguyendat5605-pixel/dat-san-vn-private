export const PAYMENT_HOLD_MINUTES = 5;
export const PAYMENT_HOLD_TIMEOUT_MS = PAYMENT_HOLD_MINUTES * 60 * 1000;

export function getPaymentHoldExpiresAt(from = Date.now()) {
  return new Date(from + PAYMENT_HOLD_TIMEOUT_MS).toISOString();
}
