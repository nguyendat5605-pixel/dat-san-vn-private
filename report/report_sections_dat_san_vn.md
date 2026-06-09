# Chương: Các Phần Trình Bày Báo Cáo Đồ Án DatSanVN

Tài liệu này tổng hợp các phần nội dung chính phục vụ cho việc viết báo cáo tốt nghiệp/đồ án môn học dựa trên mã nguồn thực tế của dự án DatSanVN. Ngôn ngữ và phong cách trình bày được tuân thủ theo chuẩn văn bản học thuật.

---

## 1. CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ SỬ DỤNG

### 1.1 Cơ sở lý thuyết
*   **Hệ thống đặt sân trực tuyến:** Là một dạng hệ thống thương mại điện tử đặc thù (e-commerce), trong đó sản phẩm giao dịch là thời gian sử dụng dịch vụ (khung giờ sân) thay vì hàng hóa vật lý. Tính chất cốt lõi của hệ thống này là tính độc quyền về thời gian, yêu cầu quản lý trạng thái khắt khe để tránh trùng lặp.
*   **Kiến trúc Client - Server:** Mô hình mạng phân tán trong đó máy khách (Client - Frontend) gửi yêu cầu và máy chủ (Server - Backend) tiếp nhận, xử lý và phản hồi dữ liệu. Mô hình này giúp phân tách rõ ràng trách nhiệm hiển thị giao diện và xử lý nghiệp vụ.
*   **RESTful API:** Tiêu chuẩn thiết kế giao diện lập trình ứng dụng (API) dựa trên kiến trúc REST (Representational State Transfer). Hệ thống sử dụng các phương thức HTTP (GET, POST, PATCH, DELETE) để thao tác với các tài nguyên (Ví dụ: Venues, Bookings, Users).
*   **Xác thực và Phân quyền người dùng (Authentication & Authorization):** Xác thực là quá trình kiểm tra danh tính người dùng (đăng nhập), trong khi phân quyền là quá trình kiểm soát quyền truy cập tài nguyên dựa trên vai trò (Role-Based Access Control - RBAC). Hệ thống định nghĩa 3 vai trò chính: Khách hàng (PLAYER), Chủ sân (OWNER), và Quản trị viên (ADMIN).
*   **Cơ sở dữ liệu quan hệ và tính chất ACID:** Hệ thống lưu trữ dữ liệu dưới dạng các bảng có quan hệ với nhau. Mọi giao dịch (Transaction) trong CSDL, đặc biệt là đặt sân và thanh toán, đều tuân thủ 4 thuộc tính ACID: Atomicity (Tính nguyên tử), Consistency (Tính nhất quán), Isolation (Tính cô lập), và Durability (Tính bền vững).
*   **Cơ chế xử lý xung đột đặt sân (Concurrency Control):** Hệ thống không sử dụng khóa bi quan ở mức dòng (Pessimistic Locking - `SELECT FOR UPDATE`) để tránh suy giảm hiệu năng và bế tắc (deadlock). Thay vào đó, dự án áp dụng **Cập nhật nguyên tử (Atomic Update)** kết hợp với **Khóa lạc quan (Optimistic Locking)** qua trường `version`. Khi nhiều người dùng cùng đặt một khung giờ, CSDL sẽ chỉ cho phép giao dịch đầu tiên cập nhật thành công trạng thái từ `AVAILABLE` sang `LOCKED`.
*   **Cơ chế tự động hủy booking quá hạn:** Hàng đợi trì hoãn (Delayed Job/Queue) với BullMQ. Thay vì liên tục quét database (polling/cron job), hệ thống đặt một delayed job sẽ thực thi chính xác sau 5 phút kể từ lúc tạo booking. Khi job chạy, hệ thống kiểm tra trạng thái booking; nếu vẫn là `PENDING`, tiến hành hủy và giải phóng khóa sân.
*   **Phương pháp phát triển Agile/Scrum rút gọn:** Quá trình phát triển dự án được chia thành các chu kỳ (Sprint) ngắn hạn, tập trung hoàn thiện từng tính năng từ Backend đến Frontend để liên tục kiểm thử và điều chỉnh theo yêu cầu thực tế.

### 1.2 Công nghệ sử dụng
*   **Next.js và React:** Next.js (sử dụng kiến trúc App Router) là framework React mạnh mẽ dùng để xây dựng Frontend, tối ưu hóa hiệu suất hiển thị (SSR/CSR/RSC) và thân thiện với SEO.
*   **NestJS:** Framework backend Node.js phát triển theo kiến trúc hướng module (Modular Architecture), cung cấp nền tảng vững chắc để xây dựng RESTful API với định dạng TypeScript, hỗ trợ tiêm phụ thuộc (Dependency Injection) mạnh mẽ.
*   **PostgreSQL:** Hệ quản trị cơ sở dữ liệu quan hệ mã nguồn mở có hiệu năng cao, được sử dụng làm nơi lưu trữ dữ liệu chính của toàn bộ hệ thống.
*   **Prisma ORM:** Công cụ ánh xạ dữ liệu quan hệ đối tượng (Object-Relational Mapping), cung cấp Type-safe API để giao tiếp với PostgreSQL, giúp đơn giản hóa và bảo mật các truy vấn cơ sở dữ liệu, quản lý lịch sử thông qua Migrations.
*   **Redis và BullMQ:** Redis là cơ sở dữ liệu NoSQL lưu trữ trên RAM. BullMQ là thư viện quản lý hàng đợi (Queue) dựa trên Redis, được dùng để xử lý các tác vụ nền (Background jobs) như hẹn giờ tự động hủy lịch đặt sân hoặc đồng bộ hóa.
*   **Clerk:** Dịch vụ quản lý định danh (Identity as a Service - IDaaS), cung cấp giải pháp đăng nhập, đăng ký và quản lý phiên làm việc bảo mật cao (sử dụng JWT) và tích hợp Webhook.

---

## 2. KIẾN TRÚC TỔ CHỨC MÃ NGUỒN

Mã nguồn dự án DatSanVN được tổ chức theo mô hình **Monorepo** sử dụng công cụ Turborepo và pnpm workspaces. Kiến trúc này cho phép quản lý mã nguồn của nhiều ứng dụng và thư viện dùng chung trong cùng một kho lưu trữ, bao gồm:
*   `apps/web`: Ứng dụng người dùng cuối (Frontend Web App).
*   `apps/api`: Dịch vụ cung cấp dữ liệu trung tâm (Backend API).
*   `packages/types`: Khối thư viện chứa các định nghĩa kiểu dữ liệu (TypeScript Types & Interfaces) dùng chung cho cả Frontend và Backend.

### 2.1 Cấu trúc Frontend (Web App)
Frontend tuân thủ cấu trúc của Next.js (App Router):
*   **`app/`**: Chứa hệ thống định tuyến (Routing). Bao gồm các thư mục Route Groups như `(auth)` (xác thực), và `(main)` phân tầng thành các không gian riêng biệt như `admin/` (Quản trị viên), `owner/` (Chủ sân) và các trang dành cho Khách hàng.
*   **`components/`**: Chứa các thành phần giao diện (UI Components) tái sử dụng, được chia theo miền nghiệp vụ (Domain-driven) như `booking`, `venue`, `owner`, và khối `ui` chứa các thành phần cơ bản (shadcn/ui).
*   **`lib/`**: Chứa các hàm cấu hình và các API Clients (`owner-api.ts`, `player-booking-api.ts`,...) dùng để giao tiếp với hệ thống Backend.

### 2.2 Cấu trúc Backend (API)
Backend tuân thủ kiến trúc Modular của NestJS. Mỗi phân hệ nghiệp vụ (như `booking`, `payment`, `venue`) bao gồm các thành phần:
*   **Module**: Nơi đóng gói, quản lý dependencies và khởi tạo phân hệ.
*   **Controller**: Tầng tiếp nhận yêu cầu HTTP từ Client, kiểm tra quyền truy cập (Guards) và tính hợp lệ của dữ liệu đầu vào.
*   **Service**: Tầng cốt lõi xử lý các logic nghiệp vụ (Business Logic) phức tạp.
*   **Provider**: Tầng giao tiếp với các dịch vụ hoặc nền tảng của bên thứ ba (Ví dụ: `momo-payment.provider.ts`).

### 2.3 Tầng Cơ sở dữ liệu (Database Layer)
*   **Prisma Schema (`schema.prisma`)**: Tệp cấu hình trung tâm định nghĩa cấu trúc các bảng thực thể (Models) như `User`, `Venue`, `Field`, `VenueSlot`, `Booking`, `Payment`, `Review` và các khóa ngoại liên kết.
*   **Migrations**: Lưu trữ các kịch bản SQL thay đổi cấu trúc dữ liệu theo thời gian, đảm bảo triển khai an toàn trên các môi trường.

### 2.4 Luồng xử lý yêu cầu tiêu chuẩn (Request Processing Flow)
Quy trình thực thi khi người dùng gửi một yêu cầu diễn ra theo luồng dữ liệu tuần tự (Unidirectional flow) như sau:
1. **Client**: Người dùng tương tác trên giao diện Next.js Page hoặc Component.
2. **API Request**: Hàm xử lý trong thư mục `lib/` sẽ đóng gói dữ liệu và gửi HTTP Request (kèm JWT Token) đến máy chủ.
3. **NestJS Controller**: Hệ thống tiếp nhận yêu cầu, thực thi xác thực danh tính (Authentication) và quyền hạn (Authorization).
4. **Service**: Dữ liệu được chuyển xuống tầng Service để tiến hành kiểm tra nghiệp vụ logic.
5. **Prisma ORM**: Tầng Service gọi các hàm của Prisma để thao tác dữ liệu.
6. **PostgreSQL**: CSDL thực thi câu lệnh truy vấn (áp dụng Atomic Update hoặc mở Transaction nếu cần).
7. **Response**: Kết quả xử lý từ CSDL được trả ngược lại tuần tự qua ORM → Service → Controller và phản hồi HTTP Response về cho Client để cập nhật giao diện.

---

## 3. DEMO HỆ THỐNG

Phần này trình bày kết quả chạy thực tế của hệ thống (các hình ảnh minh họa sẽ được chèn vào bản in cuối cùng). 

*(Ghi chú giới hạn kỹ thuật: Hệ thống hiện tại tập trung toàn diện vào nền tảng Web App trên trình duyệt. Việc phát triển ứng dụng di động gốc (Mobile App) không nằm trong phạm vi của giai đoạn phát triển hiện tại. Trải nghiệm trên thiết bị di động được đảm bảo bằng thiết kế hiển thị tương thích (Responsive Web Design).*

1.  **[Vị trí chèn Hình 1: `01_venue_list_search.png`]**
    *   *Mô tả học thuật (Caption):* Hình 1: Giao diện trang chủ và tính năng tìm kiếm, lọc cơ sở vật chất.
2.  **[Vị trí chèn Hình 2: `02_venue_detail.png`]**
    *   *Mô tả học thuật (Caption):* Hình 2: Giao diện chi tiết thông tin cơ sở vật chất, bao gồm tiện ích và đánh giá.
3.  **[Vị trí chèn Hình 3: `03_available_slots_grid.png`]**
    *   *Mô tả học thuật (Caption):* Hình 3: Giao diện hiển thị các khung giờ trống để người dùng lựa chọn. *(Lưu ý: Lưới khung giờ hiện tại được thiết kế tối ưu để hiển thị danh sách slot của một sân con cụ thể trong giới hạn ngày hiện tại).*
4.  **[Vị trí chèn Hình 4: `04_booking_sheet.png`]**
    *   *Mô tả học thuật (Caption):* Hình 4: Bảng tóm tắt xác nhận thông tin đặt sân và khởi tạo giao dịch (Booking Sheet).
5.  **[Vị trí chèn Hình 5: `05_payment_initiation_pending.png`]**
    *   *Mô tả học thuật (Caption):* Hình 5: Giao diện theo dõi trạng thái chờ xử lý thanh toán (Pending Payment) trong lịch sử giao dịch với đồng hồ đếm ngược theo `expiresAt`.*
6.  **[Vị trí chèn Hình 6: `06_payment_return.png`]**
    *   *Mô tả học thuật (Caption):* Hình 6: Giao diện thông báo kết quả trả về từ cổng thanh toán trực tuyến MoMo.
7.  **[Vị trí chèn Hình 7: `07_user_booking_history.png`]**
    *   *Mô tả học thuật (Caption):* Hình 7: Giao diện quản lý lịch sử các phiên đặt sân cá nhân (Dành cho vai trò Khách hàng).
8.  **[Vị trí chèn Hình 8: `08_owner_dashboard.png`]**
    *   *Mô tả học thuật (Caption):* Hình 8: Bảng điều khiển tổng quan (Dashboard) hiển thị số liệu thống kê (Dành cho vai trò Chủ sân).
9.  **[Vị trí chèn Hình 9: `09_owner_booking_management.png`]**
    *   *Mô tả học thuật (Caption):* Hình 9: Giao diện bảng quản lý và theo dõi các trạng thái đặt sân tại cơ sở (Dành cho vai trò Chủ sân).
10. **[Vị trí chèn Hình 10: `10_admin_dashboard.png`]**
    *   *Mô tả học thuật (Caption):* Hình 10: Bảng điều khiển giám sát tổng quan tình hình kinh doanh của toàn nền tảng (Dành cho Quản trị viên).
11. **[Vị trí chèn Hình 11: `11_admin_venue_approval.png`]**
    *   *Mô tả học thuật (Caption):* Hình 11: Giao diện quản lý quy trình xét duyệt cơ sở vật chất mới đăng ký tham gia nền tảng.
12. **[Vị trí chèn Hình 12: `12_admin_booking_management.png`]**
    *   *Mô tả học thuật (Caption):* Hình 12: Giao diện bảng dữ liệu giám sát toàn bộ giao dịch đặt sân trên hệ thống.

---

## 4. PHỤ LỤC CODE: CƠ CHẾ XỬ LÝ ĐỒNG THỜI VÀ TỰ ĐỘNG HÓA

*(Chi tiết các đoạn mã nguồn và chú giải được trình bày trong Phụ lục đính kèm của Báo cáo)*

### 4.1 Tóm tắt TC-01: Cơ chế chống đặt trùng khung giờ (Double Booking Prevention)
Giải pháp giải quyết bài toán tương tranh (concurrency) khi hệ thống có nhiều người dùng cùng lúc muốn đặt một khung giờ trống. 

Hệ thống kết hợp cài đặt trường `version` trên cấu trúc CSDL làm cờ hiệu cho **Khóa lạc quan (Optimistic Locking)** (trong file `apps/api/prisma/schema.prisma`). 
Tại tầng xử lý logic nghiệp vụ, hàm `createBookingOnce` (thuộc tệp `apps/api/src/booking/booking.service.ts`) không sử dụng các lệnh khóa ở mức dòng cồng kềnh. Thay vào đó, hệ thống thực thi một lệnh **Cập nhật nguyên tử (Atomic Update)** nghiêm ngặt bên trong Database Transaction: nỗ lực cập nhật trạng thái slot thành `LOCKED` đi kèm điều kiện `WHERE status = 'AVAILABLE'`. 

Nếu một truy vấn đồng thời khác đã khóa sân trước đó một phần nghìn giây, lệnh cập nhật này sẽ trả về số lượng bản ghi bị thay đổi là `0`. Sự kiện này sẽ bị bắt bởi hàm `assertOptimisticUpdate` (trong tệp `apps/api/src/common/optimistic-lock.guard.ts`), khiến hệ thống ngay lập tức nhận diện lỗi tương tranh, hủy bỏ hoàn toàn tiến trình Transaction và từ chối yêu cầu thứ hai, đảm bảo tính toàn vẹn độc quyền của mỗi khung giờ.

### 4.2 Tóm tắt TC-02: Cơ chế tự động hủy và thu hồi (Timeout Rollback / Booking Expiration)
Giải quyết yêu cầu nghiệp vụ về việc tự động giải phóng khung giờ nếu Khách hàng không hoàn thành tiến trình thanh toán trong vòng 5 phút. 

Hệ thống thiết kế giải pháp sử dụng công nghệ Hàng đợi phân tán. Ngay sau khi quy trình khởi tạo đặt sân được hoàn thành, hàm `addExpirationJob` (thuộc tệp `apps/api/src/queues/booking-expiration/booking-expiration.service.ts`) sẽ trực tiếp đẩy một công việc (job) mang theo định danh đặt sân vào Hàng đợi trì hoãn (Delayed Job queue) của BullMQ được vận hành bởi Redis. 

Khi kết thúc chu kỳ chờ 5 phút, một worker ẩn sẽ thức dậy và chạy hàm `process` (thuộc tệp `apps/api/src/queues/booking-expiration/booking-expiration.processor.ts`). Worker này thực hiện các bước kiểm tra an toàn theo thời gian thực (để loại bỏ rủi ro Webhook thanh toán đến cùng lúc với hạn chót). Nếu giao dịch thực sự chưa hoàn tất (trạng thái vẫn là `PENDING` và chưa `PAID`), hệ thống mới tiến hành các thao tác Cập nhật nguyên tử để chuyển trạng thái hóa đơn thành `CANCELLED`, và quan trọng nhất là phục hồi (rollback) trạng thái của khung giờ từ `LOCKED` về lại `AVAILABLE`, cho phép người dùng khác tiến hành đặt lại. Cơ chế này đạt hiệu năng vượt trội so với các công cụ quét theo lô định kỳ (cron jobs).
