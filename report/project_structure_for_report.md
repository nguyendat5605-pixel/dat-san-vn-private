# Cấu trúc và Kiến trúc Dự án DatSanVN

Dự án DatSanVN được tổ chức và phát triển dựa trên mô hình kiến trúc hiện đại, phân tách rõ ràng giữa các phân hệ nhằm đảm bảo tính mở rộng, dễ bảo trì và làm việc cộng tác. Dưới đây là mô tả chi tiết về cấu trúc mã nguồn và luồng xử lý của hệ thống.

## 1. Tổ chức mã nguồn tổng thể (Monorepo)

Dự án áp dụng mô hình **Monorepo** sử dụng công cụ **Turborepo** và **pnpm workspaces**. Phương pháp này cho phép quản lý mã nguồn của nhiều ứng dụng và thư viện dùng chung trong cùng một repository duy nhất. Cấu trúc cấp cao nhất của dự án bao gồm:

*   **`apps/`**: Chứa các ứng dụng thực thi độc lập.
    *   **`apps/web`**: Ứng dụng người dùng cuối (Frontend Web App).
    *   **`apps/api`**: Dịch vụ cung cấp dữ liệu và xử lý nghiệp vụ (Backend API).
*   **`packages/`**: Chứa các thư viện và tài nguyên dùng chung giữa các ứng dụng.
    *   **`packages/types`**: Chứa các định nghĩa kiểu dữ liệu (TypeScript types và interfaces) dùng chung cho cả Frontend và Backend, giúp đảm bảo tính đồng nhất dữ liệu toàn hệ thống.

### Cây thư mục dự án tổng quan
```text
dat-san-vn/
├── apps/
│   ├── api/                              # Backend API (NestJS)
│   │   ├── prisma/
│   │   │   └── schema.prisma             # Định nghĩa cấu trúc cơ sở dữ liệu (Prisma Schema)
│   │   └── src/
│   │       ├── main.ts                   # Điểm khởi chạy của ứng dụng API
│   │       ├── app.module.ts             # Module gốc của hệ thống
│   │       ├── auth/                     # Phân hệ xác thực và phân quyền
│   │       ├── booking/                  # Phân hệ quản lý đặt sân
│   │       ├── payment/                  # Phân hệ thanh toán
│   │       ├── user/                     # Phân hệ quản lý người dùng
│   │       ├── venue/                    # Phân hệ quản lý cơ sở vật chất (Sân)
│   │       └── ...                       # Các phân hệ nghiệp vụ khác
│   └── web/                              # Frontend Web App (Next.js)
│       ├── app/
│       │   ├── (auth)/                   # Các trang xác thực (Đăng nhập/Đăng ký)
│       │   └── (main)/                   # Các trang chính của ứng dụng
│       │       ├── admin/                # Giao diện dành cho Quản trị viên
│       │       ├── owner/                # Giao diện dành cho Chủ sân
│       │       └── ...                   # Các trang dành cho người dùng (Tìm kiếm, Đặt sân)
│       ├── components/                   # Các thành phần giao diện (UI Components) tái sử dụng
│       └── lib/                          # Các hàm tiện ích và cấu hình kết nối API
├── packages/                             # Các thư viện dùng chung (Shared Packages)
│   └── types/                            # Định nghĩa kiểu dữ liệu chung (TypeScript Types)
├── turbo.json                            # Cấu hình Turborepo
└── pnpm-workspace.yaml                   # Cấu hình không gian làm việc của pnpm
```

## 2. Kiến trúc Ứng dụng Frontend (Web App)

Phân hệ Frontend được xây dựng bằng framework **Next.js** (sử dụng App Router) kết hợp với **React** và **Tailwind CSS**. Mã nguồn được tổ chức theo tiêu chuẩn của Next.js, tập trung vào việc tái sử dụng component và phân tách rõ ràng theo chức năng của người dùng.

*   **`app/`**: Thư mục chứa cấu trúc định tuyến (Routing) của ứng dụng.
    *   Sử dụng Route Groups (như `(main)`, `(auth)`) để nhóm các trang có chung layout mà không làm ảnh hưởng đến cấu trúc URL.
    *   Các thư mục con như `admin/`, `owner/` định nghĩa không gian trang riêng biệt cho từng vai trò người dùng (Role-based UI).
*   **`components/`**: Thư mục chứa các thành phần giao diện (Components).
    *   Được phân chia theo miền nghiệp vụ (ví dụ: `booking/`, `venue/`, `admin/`, `owner/`) để dễ dàng quản lý.
    *   Bao gồm thư mục `ui/` chứa các thành phần giao diện cơ bản (dựa trên thư viện shadcn/ui) dùng chung toàn dự án.
*   **`lib/`**: Chứa các module tiện ích, cấu hình, và đặc biệt là các hàm giao tiếp với API backend (API clients) được chia theo đối tượng sử dụng (`admin-api.ts`, `owner-api.ts`, `player-booking-api.ts`).

## 3. Kiến trúc Ứng dụng Backend (API)

Phân hệ Backend được xây dựng bằng framework **NestJS**, áp dụng kiến trúc hướng mô-đun (Modular Architecture) chặt chẽ và Dependency Injection. Mỗi tính năng nghiệp vụ được đóng gói thành một Module độc lập.

Cấu trúc chuẩn của một phân hệ (Ví dụ: `booking`, `payment`, `venue`):

*   **Module (`*.module.ts`)**: Nơi cấu hình và liên kết các thành phần Controller, Service và Provider của phân hệ đó lại với nhau.
*   **Controller (`*.controller.ts`)**: Đóng vai trò là tầng giao tiếp, tiếp nhận các yêu cầu HTTP từ client (Frontend), kiểm tra quyền truy cập (thông qua Guards), gọi các Service tương ứng để xử lý logic, và trả về kết quả (Response).
*   **Service (`*.service.ts`)**: Tầng chứa các logic nghiệp vụ cốt lõi (Business Logic). Tầng này không giao tiếp trực tiếp với HTTP mà chỉ nhận dữ liệu đầu vào, xử lý, và tương tác với cơ sở dữ liệu.
*   **Provider (`*.provider.ts`)**: Được sử dụng để đóng gói các logic tích hợp với dịch vụ bên ngoài (Ví dụ: `momo-payment.provider.ts` để giao tiếp với hệ thống thanh toán MoMo).
*   **Prisma ORM (`prisma.service.ts`)**: Lớp trung gian chịu trách nhiệm giao tiếp với hệ thống cơ sở dữ liệu, thực thi các truy vấn dữ liệu theo yêu cầu của các Service.

## 4. Tầng Cơ sở dữ liệu (Database Layer)

Hệ thống sử dụng **PostgreSQL** làm cơ sở dữ liệu chính, được quản lý thông qua **Prisma ORM**.

*   **Prisma Schema (`schema.prisma`)**: Là file cấu hình trung tâm định nghĩa toàn bộ cấu trúc cơ sở dữ liệu (các bảng/models, các cột, và mối quan hệ giữa các bảng). Schema này đóng vai trò là nguồn chân lý duy nhất (Single Source of Truth) cho cấu trúc dữ liệu của toàn bộ dự án.
*   **Migrations**: Prisma quản lý việc thay đổi cấu trúc cơ sở dữ liệu thông qua cơ chế migration, đảm bảo quá trình nâng cấp hoặc thay đổi schema diễn ra an toàn, có phiên bản và có thể kiểm toán.
*   **PostgreSQL**: Hệ quản trị cơ sở dữ liệu quan hệ mạnh mẽ, lưu trữ toàn bộ dữ liệu nghiệp vụ bao gồm người dùng, cơ sở vật chất, lịch đặt sân và giao dịch thanh toán.

## 5. Luồng xử lý yêu cầu tiêu chuẩn (Request Processing Flow)

Khi người dùng thực hiện một thao tác trên ứng dụng (ví dụ: Đặt sân), hệ thống sẽ xử lý theo luồng dữ liệu một chiều như sau:

1.  **Client (Browser)**: Người dùng tương tác trên **Next.js Page/Component** (Ví dụ: bấm nút "Xác nhận đặt sân").
2.  **API Request**: Frontend (thông qua các hàm trong thư mục `lib/`) tạo và gửi một yêu cầu HTTP (có kèm theo Token xác thực) đến Backend API.
3.  **NestJS Controller**: Tầng Controller của Backend tiếp nhận yêu cầu, xác thực quyền (Auth Guards), kiểm tra tính hợp lệ của dữ liệu đầu vào (Validation Pipes).
4.  **Service**: Nếu dữ liệu hợp lệ, Controller sẽ chuyển yêu cầu xuống tầng Service để xử lý logic nghiệp vụ cụ thể (Ví dụ: kiểm tra xem sân còn trống không, tính toán giá tiền).
5.  **Prisma ORM**: Service gọi các hàm của Prisma để thực hiện truy vấn cơ sở dữ liệu.
6.  **PostgreSQL**: Cơ sở dữ liệu thực thi các câu lệnh SQL được sinh ra bởi Prisma, áp dụng các cơ chế đảm bảo tính toàn vẹn dữ liệu (như Optimistic Locking).
7.  **Response**: Kết quả từ cơ sở dữ liệu được trả ngược lại qua ORM -> Service -> Controller, và cuối cùng Controller trả về HTTP Response cho Frontend để cập nhật giao diện người dùng.

---

> **Ghi chú về phạm vi triển khai**
> Hiện tại, hệ thống tập trung hoàn thiện và triển khai hai phân hệ chính yếu là **Web Application (Frontend)** và **Backend API**.
> Dự án **không** bao gồm ứng dụng di động gốc (Native Mobile App) như Flutter hay React Native trong phạm vi mã nguồn hiện tại. Việc sử dụng trên thiết bị di động được đáp ứng thông qua thiết kế giao diện đáp ứng (Responsive Design) của Web App.
