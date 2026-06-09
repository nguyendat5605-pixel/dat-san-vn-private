import { MapPinned, ExternalLink, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function VenueMap({
  districtLabel,
  address,
  latitude,
  longitude,
}: Readonly<{
  districtLabel: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}>) {
  const hasCoordinates = typeof latitude === "number" && typeof longitude === "number";
  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${districtLabel}`)}`;

  return (
    <Card className="border-white/70 overflow-hidden">
      <div className="relative h-48 overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-100 via-emerald-50 to-white">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,34,22,0.03)_0%,transparent_40%,rgba(52,211,153,0.08)_100%)]" />
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="flex w-full max-w-sm flex-col items-center text-center gap-3 rounded-2xl bg-white/80 backdrop-blur-md px-6 py-5 shadow-[0_8px_30px_rgba(16,34,22,0.08)] border border-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-950">{districtLabel}</div>
              <div className="mt-1 text-sm text-slate-600 line-clamp-2">{address}</div>
            </div>
          </div>
        </div>
      </div>
      <CardContent className="p-4 bg-white">
        <Button asChild variant="outline" className="w-full border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 group">
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <MapPinned className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
            Xem trên Google Maps
            <ExternalLink className="ml-2 h-3 w-3 opacity-50" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
