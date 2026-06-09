// ============================================================
// DatSanVN — Shared TypeScript Types (FE ↔ BE)
// Phải đồng bộ với Prisma schema enums (v1.2)
// ============================================================

// --- Enums (mirror từ Prisma) ---

export type UserRole = 'PLAYER' | 'OWNER' | 'ADMIN';

export type VenueOwnerStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type SportType =
  | 'FOOTBALL'
  | 'BADMINTON'
  | 'TENNIS'
  | 'BASKETBALL'
  | 'VOLLEYBALL'
  | 'TABLE_TENNIS'
  | 'PICKLEBALL';

export type FieldSize = 'FIELD_5' | 'FIELD_7' | 'FIELD_11' | 'OTHER';

export type SlotStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'REFUNDED_FULL'
  | 'REFUNDED_HALF'
  | 'FAILED';

export type PaymentMethod = 'MOMO' | 'VNPAY' | 'BANK_TRANSFER' | 'CASH';

export type PaymentProvider = 'MOMO' | 'VNPAY' | 'MOMO_MANUAL';

export type PaymentAttemptStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REQUIRES_RECONCILIATION';

export type PaymentWebhookProcessingStatus =
  | 'RECEIVED'
  | 'PROCESSED'
  | 'DUPLICATE'
  | 'IGNORED'
  | 'INVALID_SIGNATURE'
  | 'AMOUNT_MISMATCH'
  | 'FAILED';

// --- Auth Types ---

/**
 * AuthUser — the shape of the authenticated user in the request context.
 *
 * This is attached to `req.user` by ClerkAuthGuard after JWT verification.
 * Frontend can use this type to know what user data is available after login.
 */
export interface AuthUser {
  /** Our database UUID (users.id) */
  id: string;
  /** Clerk user ID (e.g. "user_2abc...") */
  clerkId: string;
  /** User's primary email */
  email: string;
  /** User's role (PLAYER | OWNER | ADMIN) */
  role: UserRole;
}

// --- API Response Format (bắt buộc theo project convention) ---

export interface ApiResponse<T = any> {
  data: T;
  message: string;
  statusCode: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// --- Pagination Meta ---

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// --- Venue DTOs (FE ↔ BE contract) ---

export interface CreateVenuePayload {
  name: string;
  description?: string;
  address: string;
  district: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  pricePerHour?: number | null;
  images?: string[];
  heroImage?: string;
  gallery?: string[];
  amenities?: string[];
}

export interface UpdateVenuePayload extends Partial<CreateVenuePayload> {}

export interface VenueQueryParams {
  city?: string;
  district?: string;
  sportType?: SportType;
  page?: number;
  limit?: number;
}

// --- Field DTOs (FE ↔ BE contract) ---

export interface CreateFieldPayload {
  name: string;
  sportType: SportType;
  size: FieldSize;
}

export interface UpdateFieldPayload extends Partial<CreateFieldPayload> {}

// --- Entity Summaries (for list views / cards) ---

export interface VenueSummary {
  id: string;
  name: string;
  address: string;
  district: string;
  city: string;
  latitude?: number;
  longitude?: number;
  images: string[];
  heroImage?: string;
  coverImage?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  gallery?: string[];
  isActive: boolean;
  pricePerHour?: number;
  fields: FieldSummary[];
  _count: { reviews: number };
}

export interface FieldSummary {
  id: string;
  name: string;
  sportType: SportType;
  size: FieldSize;
}
