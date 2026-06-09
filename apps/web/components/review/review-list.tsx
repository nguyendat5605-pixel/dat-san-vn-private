import { Star } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  user: { fullName?: string };
}

export default function ReviewList({ reviews }: { reviews: Review[] }) {
  if (!reviews || reviews.length === 0) {
    return <p className="text-gray-500 italic">Chưa có đánh giá nào.</p>;
  }

  return (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
      {reviews.map((review) => (
        <div key={review.id} className="break-inside-avoid bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-sm text-slate-900">
                {review.user?.fullName || 'Người dùng ẩn danh'}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          </div>
          {review.comment && <p className="mt-3 text-sm text-slate-600 leading-relaxed">{review.comment}</p>}
        </div>
      ))}
    </div>
  );
}
