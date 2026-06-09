import type {
  ApiResponse,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  BookingStatus,
} from "@dat-san-vn/types";
import { getApiBaseUrl } from "@/lib/api-base-url";

const API_BASE_URL = getApiBaseUrl();

// ── Types ────────────────────────────────────────────────────

export interface CreatePaymentInput {
  bookingId: string;
  provider: PaymentProvider;
}

export interface CreatePaymentResult {
  paymentId: string;
  attemptId: string;
  bookingId: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  paymentUrl: string | null;
  status: PaymentAttemptStatus;
  expiresAt: string | null;
  receiverName?: string | null;
  phone?: string | null;
  transferContent?: string | null;
  qrImageUrl?: string | null;
  instructions?: string | null;
}

export interface PaymentStatusResult {
  bookingId: string;
  bookingStatus: BookingStatus;
  totalPrice: number;
  payment: {
    id: string;
    status: PaymentStatus;
    method: PaymentMethod;
    provider: PaymentProvider | null;
    amount: number;
    currency: string;
    paidAt: string | null;
    failedAt: string | null;
    expiresAt: string | null;
    latestAttempt: {
      id: string;
      provider: PaymentProvider;
      status: PaymentAttemptStatus;
      amount: number;
      currency: string;
      paymentUrl: string | null;
      expiresAt: string | null;
      createdAt: string;
    } | null;
  } | null;
}

export interface MockPaymentCompletionResult {
  attemptId: string;
  paymentId: string;
  bookingId: string;
  provider: PaymentProvider;
  finalizationStatus: "finalized" | "already_finalized";
}

export interface VnpayVerificationResult {
  RspCode: string;
  Message: string;
}

// ── Helpers ──────────────────────────────────────────────────

type ApiEnvelope<T> = ApiResponse<T> | T;

function unwrapApiResponse<T>(payload: ApiEnvelope<T>): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    "statusCode" in payload
  ) {
    return payload.data as T;
  }

  return payload as T;
}

interface RequestApiOptions extends Omit<RequestInit, "body"> {
  token?: string | null;
  body?: unknown;
}

async function requestApi<T>(
  path: string,
  { token, body, headers, ...init }: RequestApiOptions = {},
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    let message = `API request failed with status ${response.status}`;
    let errorCode: string | undefined;

    try {
      const errorPayload = (await response.json()) as {
        message?: string | string[];
        error?: string;
      };
      errorCode =
        typeof errorPayload.error === "string" ? errorPayload.error : undefined;
      if (Array.isArray(errorPayload.message)) {
        message = errorPayload.message.join(", ");
      } else if (typeof errorPayload.message === "string") {
        message = errorPayload.message;
      }
    } catch {
      // Use status fallback when the API does not return JSON.
    }

    // Friendly Vietnamese message for in-progress conflict
    if (
      response.status === 409 &&
      (errorCode === "PAYMENT_INITIATION_IN_PROGRESS" ||
        message === "PAYMENT_INITIATION_IN_PROGRESS")
    ) {
      throw new Error(
        "Yêu cầu thanh toán đang được xử lý. Vui lòng chờ vài giây rồi thử lại.",
      );
    }

    throw new Error(message);
  }

  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`API returned invalid JSON (${response.status})`);
  }
  return unwrapApiResponse(payload);
}

// ── Payment API Functions ────────────────────────────────────

/**
 * Create a payment for a booking.
 * Returns the payment URL to redirect the user to (e.g. MoMo sandbox).
 */
export async function createPayment(
  token: string,
  data: CreatePaymentInput,
  options: { idempotencyKey?: string } = {},
): Promise<CreatePaymentResult> {
  return requestApi<CreatePaymentResult>("/payments", {
    token,
    method: "POST",
    body: data,
    headers: options.idempotencyKey
      ? { "Idempotency-Key": options.idempotencyKey }
      : undefined,
  });
}

/**
 * Get payment status for a booking.
 * Used for polling on the return page after MoMo redirect.
 */
export async function getPaymentStatusByBooking(
  token: string,
  bookingId: string,
): Promise<PaymentStatusResult> {
  return requestApi<PaymentStatusResult>(
    `/payments/booking/${encodeURIComponent(bookingId)}/status`,
    {
      token,
    },
  );
}

export async function verifyVnpayReturn(
  queryString: string,
): Promise<VnpayVerificationResult> {
  const path = queryString
    ? `/payments/webhooks/vnpay?${queryString}`
    : "/payments/webhooks/vnpay";

  return requestApi<VnpayVerificationResult>(path);
}

export async function completeMockPayment(
  token: string,
  attemptId: string,
): Promise<MockPaymentCompletionResult> {
  return requestApi<MockPaymentCompletionResult>(
    `/payments/mock/${encodeURIComponent(attemptId)}/complete`,
    {
      token,
      method: "POST",
    },
  );
}
