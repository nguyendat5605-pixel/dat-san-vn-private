import { auth } from "@clerk/nextjs/server";
import { SectionHeading } from "@/components/common/section-heading";
import { VenueApprovalTable } from "@/components/admin/venue-approval-table";
import { getAdminVenues } from "@/lib/admin-api";

export default async function AdminVenuesPage() {
  const authObject = await auth();
  const token = await authObject.getToken();

  if (!token) {
    return null;
  }

  const venues = await getAdminVenues(token).catch(() => []);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Venue Management"
        title="Quản lý & duyệt sân"
        description="Xem danh sách sân, duyệt hoặc từ chối yêu cầu đăng ký sân mới. Approve sẽ tự động set owner role = OWNER."
      />

      <VenueApprovalTable venues={venues} token={token} />
    </div>
  );
}
