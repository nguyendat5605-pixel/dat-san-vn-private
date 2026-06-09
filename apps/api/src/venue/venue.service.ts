// ============================================================
// DatSanVN — VenueService
// CRUD operations for venues with ownership verification
// ============================================================

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVenueDto, UpdateVenueDto, QueryVenueDto } from './dto/index.js';
import { success } from '../common/helpers/api-response.helper.js';
import { CLERK_CLIENT } from '../auth/auth.module.js';
import type { ClerkClient } from '@clerk/backend';
import type { SportType } from '@dat-san-vn/types';
import type { Prisma } from '@prisma/client';
import {
  assertOptimisticUpdate,
  withOptimisticLock,
} from '../common/optimistic-lock.guard.js';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { UploadStorageService } from '../upload/upload-storage.service.js';

/**
 * Safely parse JSON strings or return the value if it's already an array.
 */
function safeJsonParse(value: unknown, fallback: any = []) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;

  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    // Fallback for single strings that aren't JSON
    if (Array.isArray(fallback) && typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }
    return fallback;
  }
}

function timeOnlyFromQuery(value: string) {
  const [hourRaw, minuteRaw] = value.split(':');
  return new Date(
    Date.UTC(1970, 0, 1, Number(hourRaw), Number(minuteRaw), 0, 0),
  );
}

function withVenueImageFields<T extends { images: unknown }>(venue: T) {
  const parsedImages = safeJsonParse(venue.images, []);
  const images = Array.isArray(parsedImages)
    ? parsedImages.filter((image): image is string => typeof image === 'string')
    : [];

  return {
    ...venue,
    images,
    heroImage: images[0] || '',
    gallery: images.slice(1),
  };
}

@Injectable()
export class VenueService {
  private readonly logger = new Logger(VenueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadStorageService: UploadStorageService,
    @Inject(CLERK_CLIENT) private readonly clerkClient: ClerkClient,
  ) {}

  /**
   * Create a venue and automatically assign the creator as OWNER.
   * VenueOwner status starts as PENDING — ADMIN must approve.
   */
  async create(userId: string, dto: CreateVenueDto) {
    const venue = await this.prisma.venue.create({
      data: {
        name: dto.name,
        description: dto.description,
        address: dto.address,
        district: dto.district,
        city: dto.city,
        latitude: dto.latitude,
        longitude: dto.longitude,
        images: dto.heroImage
          ? [dto.heroImage, ...(dto.gallery ?? [])]
          : (dto.images ?? []),
        amenities: dto.amenities ?? [],
        pricePerHour: dto.pricePerHour ?? null,
        // isActive defaults to false — ADMIN duyệt
        owners: {
          create: {
            userId,
            status: 'PENDING',
          },
        },
      },
      include: {
        owners: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    this.logger.log(`Venue created: ${venue.id} by user: ${userId}`);
    return success(withVenueImageFields(venue), 'Venue created successfully', 201);
  }

  async findAll(query: QueryVenueDto) {
    const {
      q,
      city,
      district,
      sportType,
      size,
      priceMax,
      startTime,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.VenueWhereInput = {
      deletedAt: null,
      isActive: true,
    };

    if (city) where.city = city;
    if (district) where.district = district;

    if (q?.trim()) {
      const keyword = q.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { address: { contains: keyword, mode: 'insensitive' } },
        { district: { contains: keyword, mode: 'insensitive' } },
        { city: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const fieldFilter: Prisma.FieldWhereInput = { isActive: true };
    if (sportType) fieldFilter.sportType = sportType as SportType;
    if (size) fieldFilter.size = size;

    const slotFilter: Prisma.VenueSlotWhereInput = {};
    if (priceMax !== undefined) slotFilter.pricePerSlot = { lte: priceMax };
    if (startTime) slotFilter.startTime = timeOnlyFromQuery(startTime);

    if (Object.keys(slotFilter).length > 0) {
      slotFilter.status = 'AVAILABLE';
      fieldFilter.slots = {
        some: slotFilter,
      };
    }

    if (sportType || size || Object.keys(slotFilter).length > 0) {
      where.fields = { some: fieldFilter };
    }

    const [venues, total] = await Promise.all([
      this.prisma.venue.findMany({
        where,
        skip,
        take: limit,
        include: {
          fields: {
            where: { isActive: true },
            select: { id: true, name: true, sportType: true, size: true },
          },
          _count: { select: { reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.venue.count({ where }),
    ]);

    const mappedVenues = venues.map((venue) => withVenueImageFields(venue));

    return success(
      {
        items: mappedVenues,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      'Venues retrieved successfully',
    );
  }

  async findFeatured() {
    const venues = await this.prisma.venue.findMany({
      where: { deletedAt: null, isActive: true },
      take: 6,
      include: {
        fields: {
          where: { isActive: true },
          select: { id: true, name: true, sportType: true, size: true },
        },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return success(
      venues.map((venue) => withVenueImageFields(venue)),
      'Featured venues retrieved successfully',
    );
  }

  async findOne(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: {
        fields: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        owners: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
        _count: { select: { reviews: true, bookings: true } },
      },
    });

    if (!venue || venue.deletedAt) {
      throw new NotFoundException(`Venue with ID "${id}" not found`);
    }

    // Map Prisma venue to Frontend VenueDetail shape
    const parsedImages = safeJsonParse(venue.images, []);
    const images = Array.isArray(parsedImages)
      ? parsedImages.filter((image): image is string => typeof image === 'string')
      : [];
    const amenities = safeJsonParse(venue.amenities, []);

    const mappedVenue = {
      ...venue,
      pricePerHour: venue.pricePerHour ? Number(venue.pricePerHour) : null,
      images,
      amenities,
      heroImage: images[0] || '',
      gallery: images.slice(1),
      categoryLabel: 'Sân bóng đá', // Placeholder
      districtLabel: `${venue.district}, ${venue.city}`,
      minPrice: 0, // Should be calculated from slots
      openingHours: '05:00 - 22:00', // Placeholder
      phone: '0900 000 000', // Placeholder
      highlight: 'Chất lượng sân tốt, ánh sáng đảm bảo.', // Placeholder
      distanceKm: 0,
      reviewCount: venue._count?.reviews || 0,
    };

    return success(mappedVenue, 'Venue retrieved successfully');
  }

  async update(id: string, userId: string, dto: UpdateVenueDto) {
    await this.validateApprovedOwnershipForMutation(id, userId);

    const currentVenue = await this.prisma.venue.findUniqueOrThrow({
      where: { id },
      select: { version: true, images: true },
    });

    let nextImages: string[] | undefined;

    const venue = await withOptimisticLock(async () => {
      const { heroImage, gallery, ...restDto } = dto;
      const images = heroImage
        ? [heroImage, ...(gallery ?? [])]
        : restDto.images;
      nextImages = images;

      const result = await this.prisma.venue.updateMany({
        where: { id, version: currentVenue.version, deletedAt: null },
        data: {
          ...restDto,
          ...(images ? { images } : {}),
          version: { increment: 1 },
        },
      });
      assertOptimisticUpdate(result);

      return this.prisma.venue.findUniqueOrThrow({
        where: { id },
        include: {
          fields: {
            where: { isActive: true },
            select: { id: true, name: true, sportType: true, size: true },
          },
        },
      });
    }, currentVenue.version);

    if (nextImages) {
      await this.cleanupRemovedVenueImages(currentVenue.images, nextImages, id);
    }

    this.logger.log(`Venue updated: ${id} by user: ${userId}`);
    return success(withVenueImageFields(venue), 'Venue updated successfully');
  }

  async remove(id: string, user: AuthUser) {
    if (user.role !== 'ADMIN') {
      await this.validateApprovedOwnershipForMutation(id, user.id);
    }

    const currentVenue = await this.prisma.venue.findUniqueOrThrow({
      where: { id },
      select: { version: true },
    });

    await withOptimisticLock(async () => {
      const result = await this.prisma.venue.updateMany({
        where: { id, version: currentVenue.version, deletedAt: null },
        data: {
          deletedAt: new Date(),
          isActive: false,
          version: { increment: 1 },
        },
      });
      assertOptimisticUpdate(result);
    }, currentVenue.version);

    this.logger.log(`Venue soft-deleted: ${id} by user: ${user.id}`);
    return success(null, 'Venue deleted successfully');
  }

  // ── Ownership ──────────────────────────────────────────

  async requestOwnership(venueId: string, userId: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId, deletedAt: null },
    });

    if (!venue) {
      throw new NotFoundException(`Venue with ID "${venueId}" not found`);
    }

    const existing = await this.prisma.venueOwner.findUnique({
      where: { userId_venueId: { userId, venueId } },
    });

    if (existing) {
      if (existing.status === 'PENDING') {
        throw new BadRequestException('Ownership request is already pending');
      }
      if (existing.status === 'APPROVED') {
        throw new BadRequestException(
          'You are already an approved owner for this venue',
        );
      }
    }

    const ownership = await this.prisma.venueOwner.upsert({
      where: { userId_venueId: { userId, venueId } },
      update: { status: 'PENDING' },
      create: { userId, venueId, status: 'PENDING' },
    });

    this.logger.log(
      `Ownership requested for venue ${venueId} by user ${userId}`,
    );
    return success(ownership, 'Ownership request submitted successfully', 201);
  }

  async approveOwnership(venueId: string, adminId: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId, deletedAt: null },
    });

    if (!venue) {
      throw new NotFoundException(`Venue with ID "${venueId}" not found`);
    }

    const result = await this.prisma.venueOwner.updateMany({
      where: { venueId, status: 'PENDING' },
      data: { status: 'APPROVED' },
    });

    if (result.count === 0) {
      throw new BadRequestException(
        'No pending ownership requests found for this venue',
      );
    }

    this.logger.log(
      `Admin ${adminId} approved ${result.count} ownership(s) for venue ${venueId}`,
    );
    return success(null, 'Ownership(s) approved successfully');
  }

  async rejectOwnership(venueId: string, adminId: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId, deletedAt: null },
    });

    if (!venue) {
      throw new NotFoundException(`Venue with ID "${venueId}" not found`);
    }

    const result = await this.prisma.venueOwner.updateMany({
      where: { venueId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });

    if (result.count === 0) {
      throw new BadRequestException(
        'No pending ownership requests found for this venue',
      );
    }

    this.logger.log(
      `Admin ${adminId} rejected ${result.count} ownership(s) for venue ${venueId}`,
    );
    return success(null, 'Ownership(s) rejected successfully');
  }

  async findMine(userId: string) {
    const venues = await this.prisma.venue.findMany({
      where: {
        deletedAt: null,
        owners: {
          some: {
            userId,
            status: {
              in: ['PENDING', 'APPROVED'],
            },
          },
        },
      },
      include: {
        fields: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            sportType: true,
            size: true,
            isActive: true,
          },
        },
        owners: {
          where: { userId },
          select: {
            status: true,
          },
        },
        _count: {
          select: {
            fields: true,
            bookings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return success(
      venues.map((venue) => withVenueImageFields(venue)),
      'Owned venues retrieved successfully',
    );
  }

  async validateApprovedOwnershipForMutation(
    venueId: string,
    userId: string,
  ): Promise<void> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, deletedAt: true },
    });

    if (!venue || venue.deletedAt) {
      throw new NotFoundException(`Venue with ID "${venueId}" not found`);
    }

    const ownership = await this.prisma.venueOwner.findUnique({
      where: { userId_venueId: { userId, venueId } },
    });

    if (!ownership || ownership.status !== 'APPROVED') {
      throw new ForbiddenException(
        'You do not have permission to manage this venue',
      );
    }
  }

  async validateManagementAccess(
    venueId: string,
    userId: string,
  ): Promise<void> {
    return this.validateApprovedOwnershipForMutation(venueId, userId);
  }

  /**
   * Verify that the given user is an APPROVED owner of the venue.
   * Throws ForbiddenException if not.
   */
  async validateOwnership(venueId: string, userId: string): Promise<void> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, deletedAt: true },
    });

    if (!venue || venue.deletedAt) {
      throw new NotFoundException(`Venue with ID "${venueId}" not found`);
    }

    const ownership = await this.prisma.venueOwner.findUnique({
      where: { userId_venueId: { userId, venueId } },
    });

    if (!ownership || ownership.status !== 'APPROVED') {
      throw new ForbiddenException(
        'You are not an approved owner of this venue',
      );
    }
  }

  private async cleanupRemovedVenueImages(
    previousImages: string[],
    nextImages: string[],
    venueId: string,
  ) {
    const nextKeys = new Set(
      nextImages
        .map((url) => this.uploadStorageService.getKeyFromUrl(url))
        .filter((key): key is string => Boolean(key)),
    );
    const removedKeys = [
      ...new Set(
        previousImages
          .map((url) => this.uploadStorageService.getKeyFromUrl(url))
          .filter((key): key is string => Boolean(key))
          .filter((key) => !nextKeys.has(key)),
      ),
    ];

    for (const key of removedKeys) {
      try {
        await this.uploadStorageService.deleteImage(key);
      } catch (error) {
        this.logger.warn(
          `Venue image cleanup failed after venue update venueId=${venueId} key=${key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
