import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Building2, CalendarRange, LayoutDashboard } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OwnerRealtimeRefresh } from "@/components/owner/owner-realtime-refresh";
import { getCurrentUserProfile } from "@/lib/owner-api";

const navigationItems = [
  {
    href: "/owner",
    label: "Dashboard",
    description: "Tổng quan booking và tình trạng sân.",
    icon: LayoutDashboard,
  },
  {
    href: "/owner/bookings",
    label: "Bookings",
    description: "Xác nhận, từ chối hoặc huỷ booking.",
    icon: CalendarRange,
  },
  {
    href: "/owner/venues",
    label: "Venues",
    description: "Quản lý danh sách sân và field.",
    icon: Building2,
  },
];

export default async function OwnerLayout({
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

  // Try to fetch user profile. If backend is down, allow access in mock/dev mode.
  let profile: { id?: string; fullName: string; email: string; role: string } | null = null;
  let isMockMode = false;

  try {
    profile = await getCurrentUserProfile(token);
  } catch {
    // Backend unreachable — enter mock mode only in development
    if (process.env.NODE_ENV !== 'development') redirect('/');
    isMockMode = true;
    profile = {
      fullName: "Chủ sân (Mock)",
      email: "owner@test.local",
      role: "OWNER",
    };
  }

  if (!isMockMode && (!profile || profile.role !== "OWNER")) {
    redirect("/");
  }

  // After the redirect guard above, profile is guaranteed to be non-null.
  const userProfile = profile!;

  return (
    <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <OwnerRealtimeRefresh ownerId={userProfile.id ?? null} />
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(245,248,246,0.98)_100%)] shadow-[0_24px_80px_rgba(16,34,22,0.12)]">
            <CardContent className="space-y-5 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Owner Panel</div>
                  {isMockMode && (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] px-1.5 py-0">
                      Mock
                    </Badge>
                  )}
                </div>
                <h1 className="mt-3 text-2xl font-semibold text-slate-950">{userProfile.fullName}</h1>
                <p className="mt-2 text-sm text-slate-600">{userProfile.email}</p>
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
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
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
