import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function PaymentReturnLoading() {
  return (
    <div className="px-4 pb-8 pt-12 sm:px-6 lg:px-8">
      <Card className="mx-auto max-w-lg border-white/70">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <div className="h-6 w-48 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-4 w-64 animate-pulse rounded-lg bg-slate-100" />
        </CardContent>
      </Card>
    </div>
  );
}
