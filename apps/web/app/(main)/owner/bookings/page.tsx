import { auth } from "@clerk/nextjs/server";
import { SectionHeading } from "@/components/common/section-heading";
import { OwnerBookingsClient } from "@/components/owner/owner-bookings-client";
import { OwnerBookingsMockClient } from "@/components/owner/owner-bookings-mock-client";
import { getOwnerBookings } from "@/lib/owner-api";

export default async function OwnerBookingsPage() {
  const authObject = await auth();
  const token = await authObject.getToken();

  let bookings: Awaited<ReturnType<typeof getOwnerBookings>> | null = null;
  let useMock = false;

  if (token) {
    try {
      bookings = await getOwnerBookings(token);
    } catch {
      // Backend unreachable — fall back to mock mode.
      useMock = true;
    }
  } else {
    useMock = true;
  }


  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Bookings"
        title="Quản lý booking của sân"
        description="Lọc theo trạng thái, xác nhận hoặc từ chối booking PENDING, và huỷ booking CONFIRMED khi còn hơn 24 giờ."
      />

      {useMock ? (
        <OwnerBookingsMockClient />
      ) : (
        <OwnerBookingsClient initialBookings={bookings ?? []} />
      )}
    </div>
  );
}
