'use client';

import { useEffect, useState } from 'react';
import ReviewForm from './review-form';
import ReviewList from './review-list';
import { getApiBaseUrl } from '@/lib/api-base-url';

interface VenueReviewsSectionProps {
  venueId: string;
}

const mockReviews = [
  {
    id: "mock-1",
    rating: 5,
    comment: "Sân đẹp, bóng lăn mượt. Mỗi tội đội tôi vẫn đá như đang mang dép lào.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    user: { fullName: "Minh Chân Gỗ" }
  },
  {
    id: "mock-2",
    rating: 4,
    comment: "Đèn sáng, cỏ ổn, thủ môn bên tôi thì hơi tối.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    user: { fullName: "Tuấn Không Kèm Người" }
  },
  {
    id: "mock-3",
    rating: 5,
    comment: "Sân chất lượng, sút lên trời vẫn thấy bóng rõ.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    user: { fullName: "Hải Sút Chim" }
  },
  {
    id: "mock-4",
    rating: 4,
    comment: "Anh chủ sân nhiệt tình, cho mượn cả bơm bóng. Tiếc là không mượn được kỹ năng đá.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    user: { fullName: "Bảo Bóp Team" }
  },
  {
    id: "mock-5",
    rating: 5,
    comment: "Góc căng tin bán nước suối lạnh buốt óc, rất hợp để tỉnh táo lại sau khi thua 10 trái.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    user: { fullName: "Quân Thở Dốc" }
  },
  {
    id: "mock-6",
    rating: 5,
    comment: "Cỏ êm đến mức tôi muốn mang gối ra ngủ. Đá bóng thì phụ, nằm sân thì chính.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    user: { fullName: "Thắng Nằm Vạ" }
  },
  {
    id: "mock-7",
    rating: 4,
    comment: "Lưới gôn hơi căng, bóng bật ra nhanh quá làm hậu vệ chạy không kịp. Khuyên ae nên sút nhẹ lại.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 22).toISOString(),
    user: { fullName: "Hưng Mất Bóng" }
  },
  {
    id: "mock-8",
    rating: 5,
    comment: "Review nghiêm túc: Mặt sân tốt, không đọng nước khi mưa. Review ko nghiêm túc: Đội tôi vẫn thua.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    user: { fullName: "Cường Chuyên Chuyền Hỏng" }
  },
  {
    id: "mock-9",
    rating: 4,
    comment: "Chỗ để xe rộng rãi, bảo vệ thân thiện. Còn bên trong sân thì không khí rất căng thẳng =)))",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 35).toISOString(),
    user: { fullName: "Duy Trọng Tài Bàn" }
  },
  {
    id: "mock-10",
    rating: 5,
    comment: "View hoàng hôn cực đẹp. Nếu rảnh thì ngắm, còn tôi đang bận nhặt bóng.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
    user: { fullName: "Nam Tiền Đạo Cắm" }
  }
];

export default function VenueReviewsSection({ venueId }: VenueReviewsSectionProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eligibility, setEligibility] = useState({ canReview: false });

  useEffect(() => {
    if (!venueId || venueId === 'undefined') return;
    
    const API_BASE_URL = getApiBaseUrl();
    
    const fetchData = async () => {
      // Fetch reviews
      try {
        const reviewsRes = await fetch(`${API_BASE_URL}/reviews/venue/${venueId}`);
        if (reviewsRes.ok) {
          const data = await reviewsRes.json().catch(() => ({ data: [] }));
          const fetchedReviews = Array.isArray(data) ? data : data?.data ?? [];
          setReviews(fetchedReviews);
        }
      } catch (err) {
        console.error('Error fetching reviews:', err);
      } finally {
        setIsLoading(false);
      }

      // Check eligibility
      try {
        const eligibilityRes = await fetch(`${API_BASE_URL}/reviews/eligibility?venueId=${venueId}`);
        if (eligibilityRes.ok) {
          const data = await eligibilityRes.json().catch(() => ({ data: [] }));
          const eligibleBookingIds = data?.data ?? data;
          setEligibility({
            canReview: Array.isArray(eligibleBookingIds) && eligibleBookingIds.length > 0
          });
        }
      } catch (err) {
        console.error('Error checking eligibility:', err);
      }
    };

    fetchData();
  }, [venueId]);

  const displayReviews = (!isLoading && reviews.length === 0) ? mockReviews : reviews;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6">Đánh giá từ khách hàng</h2>
      
      {eligibility.canReview && (
        <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
          <h3 className="text-lg font-semibold mb-4">Chia sẻ trải nghiệm của bạn</h3>
          <ReviewForm venueId={venueId} onReviewSubmitted={() => window.location.reload()} />
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500 italic">Đang tải đánh giá...</p>
      ) : (
        <ReviewList reviews={displayReviews} />
      )}
    </div>
  );
}
