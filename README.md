# CV Management Dashboard (Oil & Gas HR)

Welcome to the Oil & Gas CV Management Dashboard source code repository. 

This application lets you parse, manage, cross-reference, and synchronize candidate CVs. 

## Tính năng chính (Key Features)

- **Bảng điều khiển (Dashboard)**: Thống kê số lượng CV xử lý, trạng thái, phân chia theo Discipline và đánh giá AI. 
- **CV Extraction**: Tải lên hàng loạt CV (PDF, DOCX) và trích xuất dữ liệu bằng AI. Có hỗ trợ xem trước (Preview) file PDF kèm văn bản gốc để dễ đối chiếu.
- **Phân quyền người dùng chi tiết (RBAC)**: Chỉ định vai trò Admin (toàn quyền), Recruiter (thêm, sửa đổi CV), và Viewer (làm nhiệm vụ chỉ xem).
- **Cấu hình Discipline**: Hỗ trợ thêm/sửa/xoá Discipline với Description (mô tả) hiển thị theo chiều dọc tại trang Settings.

## Hướng dẫn tải về và chạy app (Setup & Run Guide)

Nếu bạn xuất (export) mã nguồn này từ AI Studio ra GitHub hoặc ZIP, hãy làm theo các bước sau để chạy app trên máy:

### Yêu cầu hệ thống:
1. Bạn cần cài đặt [Node.js](https://nodejs.org) (phiên bản v18 trở lên).
2. Tài khoản GitHub hoặc phần mềm giải nén file ZIP.

### Các bước cài đặt:
1. Trích xuất (Unzip) dự án ra một thư mục. Mở Terminal (Bấm tổ hợp phím Windows + R -> gõ `cmd` hoặc `powershell`).
2. Điều hướng vào thư mục chứa code:
   ```bash
   cd duong_dan_den_thu_muc/tai-ve
   ```
3. Chạy lệnh cài đặt các gói dependencies:
   ```bash
   npm install
   ```
4. Hệ thống yêu cầu cấu hình Firebase hoặc Gemini API. Vui lòng tạo 1 file `.env` theo form từ file `.env.example`.
5. Sau khi hoàn tất cài đặt, khởi chạy dự án:
   ```bash
   npm run dev
   ```
6. Truy cập địa chỉ http://localhost:3000 trên trình duyệt để sử dụng ứng dụng.

## Hướng dẫn sử dụng chi tiết (User Guide)
Tại mục **Settings** -> **Infrastructure & Integrations**, bạn có thể bấm nút **"Download User Guide"** để tải về tệp Word (.docx) chứa hướng dẫn lưu đồ chi tiết của từng chức năng dành cho người dùng nghiệp vụ tuyển dụng (Nhà Tuyển dụng).
