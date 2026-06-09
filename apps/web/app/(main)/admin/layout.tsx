import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { BarChart3, Building2, CalendarRange, LayoutDashboard, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUserProfile } from "@/lib/owner-api";

const navigationItems = [
  {
    href: "/admin",
    label: "Dashboard",
    description: "Thống kê tổng quan hệ thống.",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/users",
    label: "Users",
    description: "Quản lý người dùng và phân quyền.",
    icon: Users,
  },
  {
    href: "/admin/venues",
    label: "Venues",
    description: "Duyệt và quản lý sân.",
    icon: Building2,
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    description: "Theo dõi toàn bộ booking.",
    icon: CalendarRange,
  },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authObject = await auth();

  if (!authObject.userId) {
    redirect("/sign-in");
  }

  const token = await authObject.getToken();
  if (!token) {
    redirect("/sign-in");
  }

  // Server-side role check — only ADMIN can access
  const profile = await getCurrentUserProfile(token).catch(() => null);
  if (!profile || profile.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(245,246,250,0.98)_100%)] shadow-[0_24px_80px_rgba(16,34,22,0.12)]">
            <CardContent className="space-y-5 p-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Admin Panel</div>
                <h1 className="mt-3 text-2xl font-semibold text-slate-950">{profile.fullName}</h1>
                <p className="mt-2 text-sm text-slate-600">{profile.email}</p>
              </div>

              <nav className="grid gap-3">
                {navigationItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-[28px] border border-white/70 bg-white/88 p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(16,34,22,0.08)]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-950">{item.label}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
