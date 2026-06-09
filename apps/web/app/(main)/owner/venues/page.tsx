import { auth } from "@clerk/nextjs/server";
import { SectionHeading } from "@/components/common/section-heading";
import { OwnerVenuesClient } from "@/components/owner/owner-venues-client";
import { getOwnerVenues } from "@/lib/owner-api";

export default async function OwnerVenuesPage() {
  const authObject = await auth();
  const token = await authObject.getToken();

  if (!token) {
    return null;
  }

  const venues = await getOwnerVenues(token).catch(() => []);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Venues"
        title="Danh sách sân của tôi"
        description="Xem tình trạng từng venue, cập nhật thông tin cơ bản và đi tiếp sang khu vực quản lý field cho từng sân."
      />

      <OwnerVenuesClient initialVenues={venues} />
    </div>
  );
}
