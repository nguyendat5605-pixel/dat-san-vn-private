import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { InviteStaffDto } from './dto/invite-staff.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { getVietnamDayRange } from '../common/helpers/vietnam-day-range.helper.js';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  // OWNER xem danh sách staff của venue mình
  async getStaffByVenue(venueId: string, ownerId: string) {
    await this.assertOwnership(venueId, ownerId);

    return this.prisma.venueStaff.findMany({
      where: { venueId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // OWNER mời nhân viên bằng email
  async inviteStaff(venueId: string, ownerId: string, dto: InviteStaffDto) {
    await this.assertOwnership(venueId, ownerId);

    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!targetUser) {
      throw new NotFoundException(`Không tìm thấy tài khoản với email: ${dto.email}`);
    }

    if (targetUser.id === ownerId) {
      throw new ConflictException('Không thể tự thêm mình làm nhân viên.');
    }

    const existing = await this.prisma.venueStaff.findUnique({
      where: { venueId_userId: { venueId, userId: targetUser.id } },
    });

    if (existing) {
      // Nếu đã tồn tại nhưng bị disable → re-activate
      if (!existing.isActive) {
        return this.prisma.venueStaff.update({
          where: { id: existing.id },
          data: { isActive: true, permissions: dto.permissions },
        });
      }
      throw new ConflictException('Nhân viên này đã tồn tại trong sân.');
    }

    return this.prisma.venueStaff.create({
      data: {
        venueId,
        userId: targetUser.id,
        permissions: dto.permissions,
        invitedBy: ownerId,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  // OWNER cập nhật permission hoặc disable staff
  async updateStaff(
    venueId: string,
    staffId: string,
    ownerId: string,
    dto: UpdateStaffDto,
  ) {
    await this.assertOwnership(venueId, ownerId);

    const record = await this.prisma.venueStaff.findFirst({
      where: { id: staffId, venueId },
    });

    if (!record) throw new NotFoundException('Không tìm thấy nhân viên.');

    return this.prisma.venueStaff.update({
      where: { id: staffId },
      data: dto,
    });
  }

  // OWNER xóa staff khỏi venue (soft delete qua isActive)
  async removeStaff(venueId: string, staffId: string, ownerId: string) {
    await this.assertOwnership(venueId, ownerId);

    const record = await this.prisma.venueStaff.findFirst({
      where: { id: staffId, venueId },
    });

    if (!record) throw new NotFoundException('Không tìm thấy nhân viên.');

    return this.prisma.venueStaff.update({
      where: { id: staffId },
      data: { isActive: false },
    });
  }

  // STAFF xem doanh thu trong ca (chỉ ngày hôm nay, theo venue)
  // Tính từ các booking CONFIRMED/COMPLETED của venue trong ngày
  async getShiftRevenue(venueId: string) {
    const { date, startUtc, endUtc } = getVietnamDayRange();

    const where: Prisma.BookingWhereInput = {
      venueId,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      createdAt: { gte: startUtc, lt: endUtc },
    };

    const [bookings, revenue] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          payment: { select: { method: true, status: true, amount: true } },
        },
      }),
      this.prisma.booking.aggregate({
        where,
        _sum: { totalPrice: true },
      }),
    ]);

    return {
      date,
      venueId,
      totalBookings: bookings.length,
      totalRevenue: Number(revenue._sum?.totalPrice ?? 0),
      bookings: bookings.map((b) => ({
        id: b.id,
        status: b.status,
        totalPrice: b.totalPrice,
        paymentMethod: b.payment?.method ?? null,
        paymentStatus: b.payment?.status ?? null,
      })),
    };
  }

  // Helper — đảm bảo ownerId sở hữu venueId
  private async assertOwnership(venueId: string, ownerId: string) {
    const ownership = await this.prisma.venueOwner.findFirst({
      where: { venueId, userId: ownerId, status: 'APPROVED' },
    });
    if (!ownership) {
      throw new ForbiddenException('Bạn không sở hữu sân này.');
    }
  }
}
