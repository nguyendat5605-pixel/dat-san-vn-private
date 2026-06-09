@"
# DatSanVN — Project Context

## Stack
- Frontend: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Backend: NestJS + TypeScript + Prisma ORM + PostgreSQL
- Auth: Clerk (ưu tiên) hoặc JWT
- Storage: Cloudinary
- Realtime: Socket.IO
- Cache/Locking: Redis (Upstash hoặc Railway)
- Infra: Docker Compose (dev), Vercel (web) + Railway (api + db + redis)

## Project Structure
- apps/web          → Next.js frontend
- apps/api          → NestJS backend
- packages/types    → Shared TypeScript types (FE ↔ BE)
- packages/utils    → Shared utilities
- .agents/skills/   → Các skill chuyên biệt cho Antigravity
- .agents/brain/    → Persistent knowledge base

## Strict Conventions
- API Response: { data: any, message: string, statusCode: number }
- Error Format: { error: string, message: string, statusCode: number }
- Database: snake_case
- Code: camelCase
- Branch naming: feat/*, fix/*, chore/*
- Roles: USER, OWNER, ADMIN (OWNER phải được ADMIN duyệt mới active)

## Business Rules (tuân thủ tuyệt đối)
- Booking states: PENDING → CONFIRMED → COMPLETED / CANCELLED
- Slot lock 5 phút khi user bắt đầu checkout (dùng Redis TTL)
- Chủ sân chỉ được CANCEL trước 24h
- Refund: 100% nếu huỷ trước 12h, 50% nếu trước 6h
- Không được phép thêm tính năng ngoài spec khi làm Mission
