'use client';

import { useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/nextjs';
import { getApiBaseUrl } from '@/lib/api-base-url';

interface ReviewFormProps {
  venueId: string;
  onReviewSubmitted?: () => void;
}

export default function ReviewForm({ venueId, onReviewSubmitted }: ReviewFormProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    startTransition(async () => {
      try {
        const API_BASE_URL = getApiBaseUrl();
        const res = await fetch(`${API_BASE_URL}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ venueId, rating, comment }),
        });

        if (!res.ok) {
          const errorMsg = await res.json().then(d => d.message).catch(() => 'Không thể gửi review');
          throw new Error(errorMsg);
        }

        toast({ title: "Cảm ơn!", description: "Đánh giá của bạn đã được ghi nhận." });
        setComment('');
        setRating(5);
        onReviewSubmitted?.();
        
        // Optimistic UI update by refreshing router
        router.refresh();
      } catch (err: any) {
        toast({ variant: "destructive", title: "Lỗi", description: err.message });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-t pt-6">
      <div>
        <p className="text-sm font-medium mb-2">Đánh giá của bạn</p>
        <div className="flex gap-1">
          {[1,2,3,4,5].map((star) => (
            <Star
              key={star}
              className={`w-8 h-8 cursor-pointer transition-colors ${
                star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
              }`}
              onClick={() => setRating(star)}
            />
          ))}
        </div>
      </div>

      <Textarea
        placeholder="Chia sẻ trải nghiệm của bạn..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
      />

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Đang gửi...' : 'Gửi đánh giá'}
      </Button>
    </form>
  );
}
