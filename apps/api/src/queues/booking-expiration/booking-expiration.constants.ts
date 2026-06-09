import type { ConfigService } from '@nestjs/config';

export const PAYMENT_HOLD_MINUTES_ENV = 'PAYMENT_HOLD_MINUTES';
export const LEGACY_BOOKING_EXPIRATION_MINUTES_ENV =
  'BOOKING_EXPIRATION_MINUTES';
export const DEFAULT_PAYMENT_HOLD_MINUTES = 5;
export const PAYMENT_HOLD_TIMEOUT_MS = DEFAULT_PAYMENT_HOLD_MINUTES * 60 * 1000;
export const DEPRECATED_BOOKING_EXPIRATION_MINUTES_MESSAGE =
  'BOOKING_EXPIRATION_MINUTES is deprecated. Use PAYMENT_HOLD_MINUTES=5.';

export function resolvePaymentHoldMinutes(configService: ConfigService) {
  assertDeprecatedLegacyConfig(configService);

  const configuredMinutes = getConfiguredMinutes(
    configService.get<string | number>(PAYMENT_HOLD_MINUTES_ENV),
    PAYMENT_HOLD_MINUTES_ENV,
  );

  return configuredMinutes ?? DEFAULT_PAYMENT_HOLD_MINUTES;
}

export function resolvePaymentHoldTimeoutMs(configService: ConfigService) {
  return resolvePaymentHoldMinutes(configService) * 60 * 1000;
}

function assertDeprecatedLegacyConfig(configService: ConfigService) {
  const legacyMinutes = getConfiguredMinutes(
    configService.get<string | number>(LEGACY_BOOKING_EXPIRATION_MINUTES_ENV),
    LEGACY_BOOKING_EXPIRATION_MINUTES_ENV,
    DEPRECATED_BOOKING_EXPIRATION_MINUTES_MESSAGE,
  );

  if (
    legacyMinutes !== null &&
    legacyMinutes !== DEFAULT_PAYMENT_HOLD_MINUTES
  ) {
    throw new Error(DEPRECATED_BOOKING_EXPIRATION_MINUTES_MESSAGE);
  }
}

function getConfiguredMinutes(
  raw: string | number | undefined | null,
  key: string,
  invalidMessage = `${key} must be 5 for the booking/payment hold timeout.`,
) {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }

  const value = typeof raw === 'number' ? raw : Number(raw);

  if (value !== DEFAULT_PAYMENT_HOLD_MINUTES) {
    throw new Error(invalidMessage);
  }

  return value;
}
