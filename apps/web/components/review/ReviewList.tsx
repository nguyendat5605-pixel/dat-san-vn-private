import { Star } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  user: { fullName: string; avatar?: string | null; avatarUrl?: string | null };
  createdAt: string;
}

interface ReviewListProps {
  reviews: Review[];
  avgRating?: number;
  reviewCount?: number;
}

export default function ReviewList({ reviews, avgRating, reviewCount }: ReviewListProps) {
  const ratingValue = avgRating ?? 0;
  const countValue = reviewCount ?? reviews.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="text-4xl font-bold tabular-nums">{ratingValue.toFixed(1)}</div>
        <div>
          <div className="flex text-yellow-400">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`h-4 w-4 ${
                  index < Math.round(ratingValue)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{countValue} đánh giá</p>
        </div>
      </div>

      <div className="space-y-6">
        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-slate-50 p-8 text-center text-sm text-slate-500">
            Chưa có đánh giá nào cho sân này.
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="border-b pb-6 last:border-b-0 last:pb-0">
              <div className="flex justify-between gap-4">
                <div className="font-medium">{review.user.fullName}</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                </div>
              </div>
              <div className="mt-2 flex text-yellow-400">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className={`h-4 w-4 ${
                      index < review.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              {review.comment && <p className="mt-2 text-sm">{review.comment}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
