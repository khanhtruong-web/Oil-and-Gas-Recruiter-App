# HƯỚNG DẪN SỬ DỤNG VÀ CÀI ĐẶT ỨNG DỤNG QUẢN TRỊ CV (CV MANAGEMENT DASHBOARD)

Tài liệu này bao gồm hướng dẫn chi tiết từng tính năng của ứng dụng quản trị CV dành cho lĩnh vực Dầu khí, Điện gió, và Offshore. Phần cuối của tài liệu sẽ hướng dẫn bạn cách tải về và chạy ứng dụng.

Bạn có thể copy (sao chép) toàn bộ nội dung này vào file Microsoft Word và chèn thêm hình ảnh màn hình (screenshot) sau khi tự trải nghiệm app để làm cuốn Cẩm nang nội bộ cho team.

---

## PHẦN 1: HƯỚNG DẪN SỬ DỤNG

### 1. Đăng Nhập & Phân Quyền (Authentication & IAM Role Management)
- Khi mở ứng dụng, màn hình đăng nhập an toàn xuất hiện. Ứng dụng tích hợp với Google Workspace, chỉ cho phép đăng nhập qua tài khoản Google. (Click "Sign in with Google").
- Ứng dụng phân quyền với 3 vai trò: **Admin** (Quản lý cấp cao), **Recruiter** (Người tuyển dụng), và **Viewer** (Người xem). Bạn có thể dễ dàng quản lý quyền của người khác trong mục Settings.

### 2. Trang Tổng Quan (Dashboard)
- **Mục Đích**: Cung cấp cái nhìn bao quát về toàn bộ kho dữ liệu CV.
- **Tính năng**:
  - **KPI Cards**: Hiển thị nhanh tổng số ứng viên, số lượng được duyệt (Shortlisted) hoặc đã được tuyển (Hired), và trung bình số năm kinh nghiệm.
  - **Biểu Đồ (Charts)**: Mô tả trực quan phân bổ nhân sự theo từng chuyên ngành (Discipline Distribution) bằng biểu đồ tròn và thanh ngang.
  - **Recent Activity**: Hiển thị hoạt động mới nhất trên hệ thống (Ví dụ: "User A vừa đăng nhập", "User B vừa extract một CV", ...).

### 3. Tìm Kiếm Thông Minh (Smart Search & Catalog)
- **Mục Đích**: Giúp lọc nhanh ứng viên theo các tiêu chí chuyên sâu.
- **Tính năng**: Thao tác ở trang chính hoặc khi click vào Catalog. Nhập từ khóa (tên, chức danh, kỹ năng) và sử dụng dropdown lọc Discipline để thu hẹp kết quả. Dữ liệu sẽ update theo thời gian thực nhờ React.

### 4. Bóc Tách Thông Tin CV bằng AI (CV Extraction & AI Preview)
- **Mục Đích**: Tự động lấy thông tin từ các tệp CV (hiện hỗ trợ PDF, DOCX) và đưa vào hệ thống cơ sở dữ liệu.
- **Tính năng**:
  - **Upload Panel**: Kéo-thả (Drag & Drop) hoặc chọn File CV.
  - **Queue (Hàng đợi)**: Sau khi chọn, danh sách các file đang đợi sẽ hiện ra. Bạn click "Run AI Extraction". AI (Google Gemini) sẽ đọc nội dung và tự động trích xuất các trường thông tin: "Tên ứng viên", "Kinh nghiệm", "Ngành nghề", "Lĩnh vực chuyên môn".
  - **Preview & Reivew**: Sau khi hệ thống bóc tách xong, bạn có thể ấn vào biểu tượng "Tách màn hình (Split)" để xem lại thông tin bóc tách so với tệp PDF Gốc ngay trên một màn hình! Điều này giúp bạn kiểm tra chéo (Cross-reference) với độ chính xác tuyệt đối mà không cần tải file về máy.
  - Sau khi kiểm duyệt, bấm **Confirm Selected** để đưa dữ liệu ứng viên thẳng vào hệ thống.

### 5. Quản Lý Thư Mục Google Drive (Drive Sync)
- **Mục Đích**: Thay vì tải file CV lẻ tẻ, hệ thống cho phép quét và đồng bộ dữ liệu vào Google Drive.
- **Tính năng**: Ở menu Quản Trị Folder, bạn gắn Token và Folder ID để hệ thống có thể tạo thư mục chia theo các chuyên ngành, hoặc kết nối ổ đĩa nội bộ trong doanh nghiệp.

### 6. Cài Đặt và Quản Trị Danh Mục (Settings & IAM)
- Tại mục Settings, có 2 tính năng quan trọng nhất dành riêng cho Admin:
  1. **Discipline Catalog (Quản lý Chuyên Ngành)**: Ở đây hiển thị danh sách các chuyên ngành dọc theo màn hình. Bạn có thể thay đổi tên hoặc sửa các từ khóa (Keywords) nhận diện chuyên ngành. Việc này báo cho AI biết "từ nào sẽ thuộc ngành Nào". Nút xóa dạng dấu X sẽ giúp gỡ bỏ các discipline không dùng tới.
  2. **IAM Role Management (Phân Quyền)**: Ở khối này hiển thị danh sách nhân thành viên đã đăng nhập vào hệ thống. Admin có thể trực tiếp đổi quyền thành viên thành Recruiter hoặc Admin tùy ý.

---

## PHẦN 2: HƯỚNG DẪN TẢI VỀ VÀ CHẠY APP TRÊN MÁY (LOCAL)

Do dự án được viết theo cấu trúc file SPA hiện đại kết hợp với cơ sở dữ liệu bảo mật, bạn cần làm theo các bước sau để có thể khởi chạy ứng dụng trọn vẹn trong máy của doanh nghiệp:

### BƯỚC 1: TẢI SOURCODE (MÃ NGUỒN) TỪ AI STUDIO
1. Ở giao diện AI Studio, hãy bấm vào nút mũi tên (xuất) hoặc **Download ZIP** ở góc trên cùng bên phải giao diện để tải toàn bộ mã nguồn về máy tính.
2. Giải nén (Unzip) file thành một thư mục trên máy.

### BƯỚC 2: CÀI ĐẶT MÔI TRƯỜNG CHẠY BẮT BUỘC
Ứng dụng đang chạy bằng Node.js và TypeScript, do đó máy bạn cần cài phần mềm cấu hình trước:
1. Vào trang web [Node.js (https://nodejs.org)](https://nodejs.org/) tải bản `LTS` mới nhất rồi tiến hành cài đặt.
2. Cài trình soạn thảo code (Khuyên dùng: **Visual Studio Code**).

### BƯỚC 3: CÀI ĐẶT FIREBASE TRONG MÁY (Optional: nếu app của bạn đã kết nối Firebase Cloud)
Cơ sở dữ liệu đám mây (Database, Rules, Auth) quản trị ứng dụng đã được tạo khi bạn dựng app tại đây. Trong tệp mã nguồn sẽ có file `firebase-applet-config.json` sẵn cấu hình của dự án. 
Nếu bạn muốn Firebase có kết nối bảo mật hoàn toàn, hãy vào https://console.firebase.google.com/ để tạo Project của riêng bạn, sau đó update Credentials vào file tương ứng `/src/lib/firebase.ts`.

### BƯỚC 4: LỆNH KHỞI CHẠY (RUNNING)
1. Mở thư mục chứa source code đã được giải nén bằng Visual Studio Code.
2. Tại Visual Studio Code -> Bật Terminal (`Ctrl + ~`) hoặc mở cửa sổ giao diện Terminal độc lập.
3. Chạy lệnh cài đặt các gói hỗ trợ của Ứng dụng:
   ```bash
   npm install
   ```
4. Khi thư viện đã tải xong (Node Modules), hãy khởi động Server máy ảo của App:
   ```bash
   npm run dev
   ```
5. Hệ thống sẽ trả về đường dẫn trình duyệt `http://localhost:3000` hoặc tương tự. Click vào link để mở Web Dashboard làm việc lên. Khởi chạy là thành công!

> **Lưu Ý Security:** Đối với app sử dụng Firebase Auth như chúng ta đang có, do bạn chạy dưới localhost, Google có thể bật cảnh báo Unauthorised. Bạn cần vào Firebase Console > Authentication > Settings > Authorized Domains: thêm `localhost` vào danh sách.
