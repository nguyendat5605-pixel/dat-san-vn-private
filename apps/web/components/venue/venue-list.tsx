import type { VenueSummary } from "@dat-san-vn/types";
import { VenueCard } from "@/components/venue/venue-card";

export function VenueList({
  venues,
  compact = false,
}: Readonly<{
  venues: VenueSummary[];
  compact?: boolean;
}>) {
  return (
    <div className={compact ? "grid gap-4" : "grid gap-5 md:grid-cols-2 xl:grid-cols-3"}>
      {venues.map((venue) => (
        <VenueCard key={venue.id} venue={venue} compact={compact} />
      ))}
    </div>
  );
}
