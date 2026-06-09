"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  PhoneCall,
  RotateCcw,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  completeMockPayment,
  getPaymentStatusByBooking,
  verifyVnpayReturn,
  type PaymentStatusResult,
} from "@/lib/player-payment-api";
import { formatCurrency } from "@/lib/utils";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 20;
const ENABLE_MOCK_PAYMENT =
  process.env.NEXT_PUBLIC_ENABLE_MOCK_PAYMENT === "true";

type PageState =
  | { type: "loading" }
  | { type: "missing_booking_id" }
  | { type: "auth_required" }
  | { type: "success"; data: PaymentStatusResult }
  | { type: "cancelled"; data: PaymentStatusResult }
  | { type: "failed"; data: PaymentStatusResult }
  | { type: "reconciliation"; data: PaymentStatusResult }
  | { type: "timeout"; data: PaymentStatusResult | null }
  | { type: "error"; message: string };

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const bookingId = searchParams.get("bookingId");
  const attemptId = searchParams.get("attemptId");
  const isMockPayment = searchParams.get("mockPayment") === "true";
  const hasVnpayReturnParams = searchParams.has("vnp_SecureHash");

  const [state, setState] = useState<PageState>({ type: "loading" });
  const [isCompletingMockPayment, setIsCompletingMockPayment] = useState(false);
  const [mockCompletionError, setMockCompletionError] = useState<string | null>(
    null,
  );
  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const verifiedReturnRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const evaluateStatus = useCallback(
    (data: PaymentStatusResult): PageState | null => {
      // Payment PAID + Booking CONFIRMED = success
      if (
        data.payment?.status === "PAID" &&
        data.bookingStatus === "CONFIRMED"
      ) {
        return { type: "success", data };
      }

      // Booking cancelled or completed (after expiry/manual cancel)
      if (data.bookingStatus === "CANCELLED") {
        return { type: "cancelled", data };
      }

      const latestAttempt = data.payment?.latestAttempt;

      // Latest attempt requires reconciliation
      if (latestAttempt?.status === "REQUIRES_RECONCILIATION") {
        return { type: "reconciliation", data };
      }

      // Latest attempt failed and no longer active
      if (
        latestAttempt?.status === "FAILED" ||
        latestAttempt?.status === "EXPIRED" ||
        latestAttempt?.status === "CANCELLED"
      ) {
        return { type: "failed", data };
      }

      // Still pending — continue polling
      return null;
    },
    [],
  );

  const pollStatus = useCallback(
    async (token: string) => {
      if (!bookingId || !mountedRef.current) return;

      try {
        const data = await getPaymentStatusByBooking(token, bookingId);
        if (!mountedRef.current) return;

        const terminal = evaluateStatus(data);
        if (terminal) {
          stopPolling();
          setState(terminal);
          return;
        }

        pollCountRef.current += 1;
        if (pollCountRef.current >= MAX_POLLS) {
          stopPolling();
          setState({ type: "timeout", data });
          return;
        }
      } catch (error) {
        if (!mountedRef.current) return;

        const message =
          error instanceof Error ? error.message : "Lỗi không xác định";

        // Stop polling on auth / not found errors
        if (
          message.includes("401") ||
          message.includes("403") ||
          message.includes("404")
        ) {
          stopPolling();
          setState(
            message.includes("404") || message.includes("403")
              ? {
                  type: "error",
                  message:
                    "Không tìm thấy booking hoặc bạn không có quyền truy cập.",
                }
              : { type: "auth_required" },
          );
          return;
        }

        // Other errors: let polling continue (backend might be temporarily unavailable)
        pollCountRef.current += 1;
        if (pollCountRef.current >= MAX_POLLS) {
          stopPolling();
          setState({ type: "timeout", data: null });
        }
      }
    },
    [bookingId, evaluateStatus, stopPolling],
  );

  const canSimulateMockPayment =
    ENABLE_MOCK_PAYMENT &&
    isMockPayment &&
    Boolean(attemptId) &&
    state.type !== "success" &&
    state.type !== "cancelled";

  const verifyReturnIfNeeded = useCallback(async () => {
    if (!hasVnpayReturnParams || verifiedReturnRef.current) {
      return;
    }

    verifiedReturnRef.current = true;
    const result = await verifyVnpayReturn(searchParams.toString());
    if (result.RspCode !== "00") {
      throw new Error(result.Message || "VNPay return verification failed");
    }
  }, [hasVnpayReturnParams, searchParams]);

  const handleCompleteMockPayment = useCallback(async () => {
    if (!attemptId || isCompletingMockPayment) return;

    setIsCompletingMockPayment(true);
    setMockCompletionError(null);

    try {
      const token = await getToken();
      if (!token) {
        setState({ type: "auth_required" });
        return;
      }

      await completeMockPayment(token, attemptId);
      pollCountRef.current = 0;
      await pollStatus(token);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể mô phỏng thanh toán thành công.";
      setMockCompletionError(message);
    } finally {
      setIsCompletingMockPayment(false);
    }
  }, [attemptId, getToken, isCompletingMockPayment, pollStatus]);

  // Main effect: start polling
  useEffect(() => {
    mountedRef.current = true;

    if (!bookingId) {
      setState({ type: "missing_booking_id" });
      return;
    }

    if (!isLoaded) return;

    if (!isSignedIn) {
      setState({ type: "auth_required" });
      return;
    }

    let cancelled = false;

    const startPolling = async () => {
      const token = await getToken();
      if (!token || cancelled || !mountedRef.current) {
        setState({ type: "auth_required" });
        return;
      }

      try {
        await verifyReturnIfNeeded();
      } catch (error) {
        if (!mountedRef.current) return;
        const message =
          error instanceof Error
            ? error.message
            : "Không thể xác thực phản hồi VNPay.";
        setState({
          type: "error",
          message: `Không thể xác thực phản hồi VNPay: ${message}`,
        });
        return;
      }

      // Initial poll immediately
      await pollStatus(token);

      // Set up interval for subsequent polls
      if (mountedRef.current && !cancelled) {
        intervalRef.current = setInterval(async () => {
          const freshToken = await getToken();
          if (freshToken && mountedRef.current) {
            await pollStatus(freshToken);
          }
        }, POLL_INTERVAL_MS);
      }
    };

    void startPolling();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      stopPolling();
    };
  }, [
    bookingId,
    isLoaded,
    isSignedIn,
    getToken,
    pollStatus,
    stopPolling,
    verifyReturnIfNeeded,
  ]);

  // ── Render states ──────────────────────────────────────────

  if (state.type === "loading") {
    return (
      <StatusCard
        icon={<Loader2 className="h-8 w-8 animate-spin text-emerald-600" />}
        title="Đang xác nhận thanh toán..."
        description="Hệ thống đang kiểm tra trạng thái thanh toán từ nhà cung cấp. Vui lòng chờ."
        actions={
          canSimulateMockPayment ? (
            <MockPaymentActions
              error={mockCompletionError}
              isCompleting={isCompletingMockPayment}
              onComplete={handleCompleteMockPayment}
            />
          ) : undefined
        }
      />
    );
  }

  if (state.type === "missing_booking_id") {
    return (
      <StatusCard
        icon={<XCircle className="h-8 w-8 text-rose-500" />}
        title="Không tìm thấy thông tin booking"
        description="URL không hợp lệ. Vui lòng quay lại trang lịch sử đặt sân."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/bookings">Xem lịch sử đặt sân</Link>
          </Button>
        }
      />
    );
  }

  if (state.type === "auth_required") {
    return (
      <StatusCard
        icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}
        title="Vui lòng đăng nhập"
        description="Bạn cần đăng nhập để xem trạng thái thanh toán."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/sign-in">Đăng nhập</Link>
          </Button>
        }
      />
    );
  }

  if (state.type === "success") {
    return (
      <StatusCard
        icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
        title="Thanh toán thành công!"
        description={`Booking đã được xác nhận. Số tiền: ${formatCurrency(state.data.totalPrice)}.`}
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/bookings">Xem lịch sử đặt sân</Link>
          </Button>
        }
      />
    );
  }

  if (state.type === "cancelled") {
    return (
      <StatusCard
        icon={<XCircle className="h-8 w-8 text-rose-500" />}
        title="Booking đã hết hạn hoặc bị huỷ"
        description="Booking không còn hiệu lực. Vui lòng tạo booking mới nếu bạn muốn đặt sân."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/bookings">Xem lịch sử đặt sân</Link>
          </Button>
        }
      />
    );
  }

  if (state.type === "failed") {
    const canRetry = state.data.bookingStatus === "PENDING";
    return (
      <StatusCard
        icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}
        title="Thanh toán thất bại"
        description={
          canRetry
            ? "Thanh toán không thành công. Bạn có thể thử lại nếu booking chưa hết hạn."
            : "Thanh toán không thành công và booking đã không còn khả dụng."
        }
        actions={
          <div className="grid w-full gap-3 sm:flex sm:flex-wrap">
            {canRetry && (
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  // Reload page to re-trigger polling (in case backend state changed)
                  router.refresh();
                  setState({ type: "loading" });
                  pollCountRef.current = 0;
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Thử lại
              </Button>
            )}
            <Button variant="secondary" asChild className="w-full sm:w-auto">
              <Link href="/bookings">Xem lịch sử đặt sân</Link>
            </Button>
          </div>
        }
      />
    );
  }

  if (state.type === "reconciliation") {
    return (
      <StatusCard
        icon={<PhoneCall className="h-8 w-8 text-amber-500" />}
        title="Thanh toán cần đối soát"
        description="Thanh toán cần đối soát, vui lòng liên hệ hỗ trợ. Đội ngũ DatSanVN sẽ xử lý trong thời gian sớm nhất."
        actions={
          <Button variant="secondary" asChild className="w-full sm:w-auto">
            <Link href="/bookings">Xem lịch sử đặt sân</Link>
          </Button>
        }
      />
    );
  }

  if (state.type === "timeout") {
    return (
      <StatusCard
        icon={<Clock3 className="h-8 w-8 text-slate-500" />}
        title="Hệ thống đang xác nhận"
        description="Hệ thống đang xác nhận thanh toán, vui lòng kiểm tra lại sau. Trạng thái thanh toán sẽ được cập nhật trong lịch sử đặt sân."
        actions={
          <div className="grid w-full gap-3 sm:flex sm:flex-wrap">
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setState({ type: "loading" });
                pollCountRef.current = 0;
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Kiểm tra lại
            </Button>
            <Button variant="secondary" asChild className="w-full sm:w-auto">
              <Link href="/bookings">Xem lịch sử đặt sân</Link>
            </Button>
            {canSimulateMockPayment && (
              <MockPaymentActions
                error={mockCompletionError}
                isCompleting={isCompletingMockPayment}
                onComplete={handleCompleteMockPayment}
              />
            )}
          </div>
        }
      />
    );
  }

  // state.type === "error"
  return (
    <StatusCard
      icon={<XCircle className="h-8 w-8 text-rose-500" />}
      title="Đã xảy ra lỗi"
      description={state.message}
      actions={
        <Button variant="secondary" asChild className="w-full sm:w-auto">
          <Link href="/bookings">Xem lịch sử đặt sân</Link>
        </Button>
      }
    />
  );
}

function MockPaymentActions({
  error,
  isCompleting,
  onComplete,
}: {
  error: string | null;
  isCompleting: boolean;
  onComplete: () => void;
}) {
  return (
    <div className="grid w-full gap-2">
      <Button
        onClick={onComplete}
        disabled={isCompleting}
        className="w-full whitespace-normal"
      >
        {isCompleting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang mô phỏng...
          </>
        ) : (
          "Simulate successful payment"
        )}
      </Button>
      {error && <p className="max-w-sm text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function StatusCard({
  icon,
  title,
  description,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="mx-auto max-w-lg border-white/70">
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
        {icon}
        <h2 className="text-xl font-semibold leading-tight text-slate-950">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">{description}</p>
        {actions && <div className="mt-2 w-full sm:w-auto">{actions}</div>}
      </CardContent>
    </Card>
  );
}

export default function PaymentReturnPage() {
  return (
    <div className="px-4 pb-8 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        }
      >
        <PaymentReturnContent />
      </Suspense>
    </div>
  );
}
