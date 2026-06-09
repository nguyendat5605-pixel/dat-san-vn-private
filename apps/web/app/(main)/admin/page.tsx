import { auth } from "@clerk/nextjs/server";
import { Building2, CalendarDays, Clock3, Users } from "lucide-react";
import { SectionHeading } from "@/components/common/section-heading";
import { AdminStatsCard } from "@/components/admin/stats-overview";
import { getAdminStats } from "@/lib/admin-api";

export default async function AdminDashboardPage() {
  const authObject = await auth();
  const token = await authObject.getToken();

  if (!token) {
    return null;
  }

  const stats = await getAdminStats(token).catch(() => ({
    totalUsers: 0,
    totalVenues: 0,
    totalBookings: 0,
    pendingVenues: 0,
    todayBookings: 0,
  }));

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Admin Dashboard"
        title="Tổng quan hệ thống DatSanVN"
        description="Theo dõi toàn bộ hoạt động của nền tảng — người dùng, sân bãi, booking và các yêu cầu đang chờ xử lý."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminStatsCard
          title="Tổng người dùng"
          value={stats.totalUsers}
          description="Tổng số tài khoản trong hệ thống."
          icon={<Users className="h-5 w-5" />}
          iconClassName="bg-indigo-50 text-indigo-600"
        />
        <AdminStatsCard
          title="Tổng venue"
          value={stats.totalVenues}
          description="Tổng số sân đã đăng ký."
          icon={<Building2 className="h-5 w-5" />}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <AdminStatsCard
          title="Tổng booking"
          value={stats.totalBookings}
          description="Tổng booking toàn hệ thống."
          icon={<CalendarDays className="h-5 w-5" />}
          iconClassName="bg-sky-50 text-sky-700"
        />
        <AdminStatsCard
          title="Booking hôm nay"
          value={stats.todayBookings}
          description="Booking được tạo trong hôm nay."
          icon={<Clock3 className="h-5 w-5" />}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <AdminStatsCard
          title="Venue chờ duyệt"
          value={stats.pendingVenues}
          description="Sân đang chờ admin duyệt."
          icon={<Building2 className="h-5 w-5" />}
          iconClassName="bg-red-50 text-red-600"
          highlight={stats.pendingVenues > 0}
        />
      </div>
    </div>
  );
}
