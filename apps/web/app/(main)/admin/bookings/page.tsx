import { auth } from "@clerk/nextjs/server";
import { SectionHeading } from "@/components/common/section-heading";
import { AdminBookingsTable } from "@/components/admin/admin-bookings-table";
import { getAdminBookings } from "@/lib/admin-api";

export default async function AdminBookingsPage() {
  const authObject = await auth();
  const token = await authObject.getToken();

  if (!token) {
    return null;
  }

  const bookingsData = await getAdminBookings(token, 1, 100).catch(() => ({
    items: [],
    meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
  }));

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Booking Overview"
        title="Tổng quan booking"
        description="Xem toàn bộ booking trong hệ thống — chỉ đọc, không có action. Lọc theo trạng thái hoặc ngày tạo."
      />

      <AdminBookingsTable bookings={bookingsData.items} />
    </div>
  );
}
