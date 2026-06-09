# Danh mục Ảnh chụp màn hình (Screenshot Checklist) phục vụ Báo cáo Demo

Tài liệu này cung cấp danh sách kiểm tra (checklist) các ảnh chụp màn hình (screenshot) cần chuẩn bị cho phần phụ lục hoặc phần trình bày kết quả thực nghiệm trong báo cáo đồ án DatSanVN. Các màn hình được liệt kê dựa trên các chức năng đã thực tế được lập trình trong mã nguồn.

> **Ghi chú quan trọng về Ứng dụng Di động (Mobile App):**  
> Hiện tại, hệ thống không bao gồm mã nguồn của ứng dụng di động gốc (như React Native hoặc Flutter). Do đó, các ảnh chụp màn hình dành cho Mobile App là **không khả dụng (Not Applicable - N/A)**. Quá trình demo trên thiết bị di động có thể được thực hiện thông qua giao diện Web đáp ứng (Responsive Web Design) trên trình duyệt điện thoại.

---

## 1. Tìm kiếm và Danh sách Cơ sở vật chất
- **Screenshot file name**: `01_venue_list_search.png`
- **Page/route**: `/` (Trang chủ) hoặc `/search` (Trang tìm kiếm)
- **What the screenshot proves**: Hệ thống có khả năng hiển thị danh sách các sân bãi, có hỗ trợ tìm kiếm và lọc dữ liệu (theo bộ lọc có sẵn).
- **Suggested report caption**: Hình 1: Giao diện trang chủ và tìm kiếm cơ sở vật chất (Venue List & Search).
- **Related feature/test case**: Chức năng Xem danh sách và Tìm kiếm sân.

## 2. Chi tiết Cơ sở vật chất
- **Screenshot file name**: `02_venue_detail.png`
- **Page/route**: `/venues/[id]`
- **What the screenshot proves**: Hiển thị thông tin chi tiết của một sân (tên, địa chỉ, tiện ích, đánh giá, danh sách sân con/field).
- **Suggested report caption**: Hình 2: Giao diện chi tiết cơ sở vật chất và các thông tin liên quan.
- **Related feature/test case**: Chức năng Xem chi tiết sân bãi.

## 3. Lưới chọn Khung giờ (Available Slot Selection)
- **Screenshot file name**: `03_available_slots_grid.png`
- **Page/route**: `/venues/[id]` (Phần danh sách slot)
- **What the screenshot proves**: Minh chứng hệ thống lấy được danh sách khung giờ trống (AVAILABLE) từ cơ sở dữ liệu để cho phép người dùng chọn.
- **Suggested report caption**: Hình 3: Giao diện chọn khung giờ đặt sân.
- **Related feature/test case**: TC-01 (Ngăn chặn đặt trùng lịch) - Bước chọn slot.
- **Limitation / Ghi chú học thuật**: Dựa trên mã nguồn hiện tại, lưới slot này chỉ hiển thị danh sách khung giờ của **một sân con (field) đầu tiên** và chỉ hiển thị cho **ngày hôm nay**. Hệ thống chưa có giao diện lịch (date picker) đa ngày hoặc lưới so sánh nhiều sân con cùng lúc.

## 4. Bảng Xác nhận Đặt sân (Booking Sheet)
- **Screenshot file name**: `04_booking_sheet.png`
- **Page/route**: `/venues/[id]` (Sidebar/Sheet hiện ra sau khi chọn nút "Đặt sân ngay")
- **What the screenshot proves**: Giao diện tóm tắt thông tin đặt sân (tên sân, thời gian, giá tiền) trước khi khách hàng xác nhận và chuyển sang bước thanh toán.
- **Suggested report caption**: Hình 4: Bảng xác nhận thông tin đặt sân và khởi tạo thanh toán.
- **Related feature/test case**: Quy trình Đặt sân (Booking Flow).

## 5. Khởi tạo Thanh toán / Thanh toán Chờ xử lý
- **Screenshot file name**: `05_payment_initiation_pending.png`
- **Page/route**: Giao diện Toast notification khi đang chuyển hướng sang MoMo, hoặc trang `/bookings` hiển thị trạng thái `PENDING`.
- **What the screenshot proves**: Minh chứng việc tạo bản ghi Booking và Payment Attempt thành công, hệ thống đang chờ kết quả thanh toán.
- **Suggested report caption**: Hình 5: Trạng thái chờ xử lý thanh toán (Pending Payment).
- **Related feature/test case**: TC-02 (Tự động hủy đặt sân) - Bước sinh ra Timeout Job.
- **Ghi chú học thuật**: Mã nguồn frontend hiện có giao diện đếm ngược thời gian (Payment countdown UI) cho booking `PENDING`; chụp trạng thái này trong lịch sử đặt sân để minh hoạ timeout 5 phút.

## 6. Trang Kết quả Thanh toán (Payment Return)
- **Screenshot file name**: `06_payment_return.png`
- **Page/route**: `/payments/return`
- **What the screenshot proves**: Hệ thống tiếp nhận kết quả trả về từ cổng thanh toán MoMo sau khi người dùng hoàn tất giao dịch.
- **Suggested report caption**: Hình 6: Giao diện thông báo kết quả giao dịch từ cổng thanh toán.
- **Related feature/test case**: Tích hợp Cổng thanh toán (Payment Gateway Integration).

## 7. Lịch sử Đặt sân của Khách hàng
- **Screenshot file name**: `07_user_booking_history.png`
- **Page/route**: `/bookings`
- **What the screenshot proves**: Khách hàng (Role: PLAYER) có thể xem lại toàn bộ các phiên đặt sân của mình cùng với trạng thái (`PENDING`, `CONFIRMED`, `CANCELLED`).
- **Suggested report caption**: Hình 7: Giao diện quản lý lịch sử đặt sân dành cho khách hàng.
- **Related feature/test case**: Chức năng Quản lý Đặt sân cá nhân.

## 8. Bảng điều khiển Chủ sân (Owner Dashboard)
- **Screenshot file name**: `08_owner_dashboard.png`
- **Page/route**: `/owner`
- **What the screenshot proves**: Chủ sân (Role: OWNER) có một giao diện tổng quan chuyên biệt (dashboard) chứa các thẻ thống kê (Stats Cards) về doanh thu, số lượng booking.
- **Suggested report caption**: Hình 8: Bảng điều khiển tổng quan dành cho Chủ sở hữu sân.
- **Related feature/test case**: Phân quyền (Role-based Access Control - RBAC).

## 9. Quản lý Đặt sân của Chủ sân
- **Screenshot file name**: `09_owner_booking_management.png`
- **Page/route**: `/owner/bookings`
- **What the screenshot proves**: Giao diện dạng bảng (Table) cho phép Chủ sân xem danh sách đặt sân thuộc các cơ sở của mình, hỗ trợ lọc theo trạng thái (Filter Tabs).
- **Suggested report caption**: Hình 9: Giao diện quản lý các phiên đặt sân dành cho Chủ sở hữu.
- **Related feature/test case**: Chức năng Xác nhận/Hủy đặt sân bởi Chủ sân (Owner booking management).

## 10. Bảng điều khiển Quản trị viên (Admin Dashboard)
- **Screenshot file name**: `10_admin_dashboard.png`
- **Page/route**: `/admin`
- **What the screenshot proves**: Quản trị viên (Role: ADMIN) có cái nhìn toàn cảnh về toàn bộ hệ thống thông qua các số liệu thống kê tổng hợp (Stats Overview).
- **Suggested report caption**: Hình 10: Bảng điều khiển tổng quan dành cho Quản trị viên hệ thống.
- **Related feature/test case**: Phân quyền (Role-based Access Control - RBAC).

## 11. Phê duyệt Cơ sở vật chất (Admin Venue Approval)
- **Screenshot file name**: `11_admin_venue_approval.png`
- **Page/route**: `/admin/venues`
- **What the screenshot proves**: Quản trị viên có giao diện bảng (Venue Approval Table) để duyệt hoặc từ chối các sân bãi mới do Chủ sân đăng ký.
- **Suggested report caption**: Hình 11: Giao diện phê duyệt cơ sở vật chất mới.
- **Related feature/test case**: Quy trình Xét duyệt Cơ sở vật chất (Venue approval workflow).

## 12. Quản lý Toàn bộ Đặt sân (Admin Booking Management)
- **Screenshot file name**: `12_admin_booking_management.png`
- **Page/route**: `/admin/bookings`
- **What the screenshot proves**: Quản trị viên có quyền truy cập toàn bộ lịch sử đặt sân của hệ thống (Admin Bookings Table) phục vụ mục đích giám sát và đối soát.
- **Suggested report caption**: Hình 12: Giao diện giám sát toàn bộ giao dịch đặt sân trên hệ thống.
- **Related feature/test case**: Chức năng Quản lý Đặt sân toàn hệ thống (Admin booking management).
