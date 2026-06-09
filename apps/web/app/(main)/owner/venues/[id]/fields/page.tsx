import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/common/section-heading";
import { OwnerFieldsClient } from "@/components/owner/owner-fields-client";
import { getOwnerVenues, getVenueFields } from "@/lib/owner-api";

export default async function OwnerVenueFieldsPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const authObject = await auth();
  const token = await authObject.getToken();

  if (!token) {
    return null;
  }

  const [venues, fields] = await Promise.all([
    getOwnerVenues(token).catch(() => []),
    getVenueFields(token, id).catch(() => []),
  ]);

  const venue = venues.find((item) => item.id === id);
  if (!venue) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Fields"
        title="Quản lý sân con"
        description="CRUD đầy đủ cho field trong từng venue. Form được mở trong dialog để owner xử lý nhanh mà không rời trang."
      />

      <OwnerFieldsClient venueId={id} venueName={venue.name} initialFields={fields} />
    </div>
  );
}
