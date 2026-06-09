import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async checkEligibility(userId: string, venueId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        userId,
        venueId,
        status: BookingStatus.COMPLETED,
        reviews: { none: {} },
      },
      select: { id: true },
    });

    return bookings.map((booking) => booking.id);
  }

  async create(dto: CreateReviewDto, userId: string) {
    const { venueId, bookingId, rating, comment } = dto;

    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundException('Không tìm thấy sân');
    }

    if (bookingId) {
      const existingReview = await this.prisma.review.findFirst({
        where: { bookingId },
        select: { id: true },
      });

      if (existingReview) {
        throw new ConflictException('Bạn đã đánh giá booking này rồi');
      }

      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { userId: true, venueId: true, status: true },
      });

      if (
        !booking ||
        booking.userId !== userId ||
        booking.venueId !== venueId ||
        booking.status !== BookingStatus.COMPLETED
      ) {
        throw new BadRequestException(
          'Chỉ được review sau khi hoàn thành booking của chính mình',
        );
      }
    } else {
      const completedBooking = await this.prisma.booking.findFirst({
        where: {
          userId,
          venueId,
          status: BookingStatus.COMPLETED,
        },
        select: { id: true },
      });

      if (!completedBooking) {
        throw new BadRequestException(
          'Chỉ được review sau khi hoàn thành booking của chính mình',
        );
      }
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          venueId,
          userId,
          bookingId,
          rating,
          comment,
        },
        include: {
          venue: true,
          user: { select: { fullName: true } },
        },
      });

      const stats = await tx.review.aggregate({
        where: { venueId },
        _avg: { rating: true },
        _count: { id: true },
      });

      const avgRating = stats._avg.rating ?? 0;

      await tx.venue.update({
        where: { id: venueId },
        data: {
          rating: avgRating,
          avgRating,
          reviewCount: stats._count.id,
        },
      });

      return newReview;
    });

    return review;
  }

  async findByVenue(venueId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    return this.prisma.review.findMany({
      where: { venueId },
      include: {
        user: {
          select: {
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }
}
