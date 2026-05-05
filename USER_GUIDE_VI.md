# HƯỚNG DẪN SỬ DỤNG VÀ CÀI ĐẶT ỨNG DỤNG QUẢN TRỊ CV (CV MANAGEMENT DASHBOARD)

Tài liệu này bao gồm hướng dẫn chi tiết từng tính năng của ứng dụng quản trị CV dành cho lĩnh vực Dầu khí, Điện gió, và Offshore. Bạn có thể tải, in hoặc lưu trữ làm Cẩm nang nội bộ cho team (User Manual).

---

## PHẦN 1: CÁC THÔNG SỐ CẤU HÌNH (KEY SETTINGS) QUAN TRỌNG

Để hệ thống hoạt động đầy đủ tính năng AI và lưu trữ đám mây, các thông số sau cần được thiết lập và quản lý bởi Admin trong mục **System > Settings**:

*   **Google Gemini API Key**: Dùng để AI bóc tách CV và phân tích dữ liệu. (Nên dùng model `gemini-2.5-flash` hoặc cao hơn).
*   **Google Drive Root Folder ID**: Nhập ID thư mục gốc trên Google Drive nơi tất cả CV PDF sẽ được tự động phân loại và lưu trữ theo từng thư mục chuyên ngành (Discipline).
*   **Google Sheets ID**: Nhập ID của file Google Sheets để hệ thống tự động backup và log log các hoạt động quan trọng (như log extraction).

> **Lưu ý Security:** Đừng để lộ các API key này ra bên ngoài. Bạn có thể điền thông tin vào dưới đây và lưu file này lại một cách bảo mật:
> - Gemini API Key: `[Nhập Gemini API Key của bạn vào đây]`
> - Drive Root Folder ID: `[Nhập Folder ID của bạn vào đây]`
> - Backup Google Sheet ID: `[Nhập Google Sheet ID của bạn vào đây]`

---

## PHẦN 2: HƯỚNG DẪN SỬ DỤNG ỨNG DỤNG

### 1. Đăng Nhập & Phân Quyền (Authentication)
- Ứng dụng tích hợp với Google Workspace, chỉ cho phép đăng nhập qua tài khoản Google. (Click "Sign in with Google"). Màn hình đăng nhập an toàn bảo vệ dữ liệu nội bộ.
- Phân quyền gồm: **Admin** (Quản lý toàn quyền), **Recruiter** (Người tuyển dụng - extract và tìm kiếm CV), và **Viewer** (Người xem - có thể xem CV). Admin có thể thay đổi trong mục Settings.

### 2. Trang Tổng Quan (Dashboard) (Real-time)
- **Mục Đích**: Cung cấp cái nhìn bao quát về toàn bộ kho dữ liệu CV.
- **Tính năng**:
  - **KPI Cards**: Hiển thị tổng số CV hiện có, tỉ lệ phân bổ ứng viên.
  - **Biểu Đồ Recharts**: Phân bổ cấu trúc nhân sự theo từng chuyên ngành, giúp HR ra quyết định tuyển dụng. Lắng nghe dữ liệu (onSnapshot) từ bộ Firebase Firestore.
  - **Recent Activity**: Hiển thị hoạt động hệ thống.

### 3. Tìm Kiếm Thông Minh (Smart Search)
- **Mục Đích**: Giới thiệu giao diện Data Grid để đối chiếu và tìm chuyên gia.
- **Tính năng**: Tìm kiếm tức thì, lọc theo *Chuyên ngành* (Discipline) hoặc *Số năm kinh nghiệm*. Click trực tiếp vào kết quả để xem phân tích AI.

### 4. Bóc Tách CV Đám Mây (Cloud CV Extraction)
- **Mục Đích**: Tự động bóc tách ứng viên từ file PDF CV và import vào kho cơ sở dữ liệu.
- **Tính năng**:
  - **Kéo thả Upload**: Bạn kéo một hoặc nhiều file PDF CV vào vùng Dropzone. Hệ thống hỗ trợ xử lý đa nhiệm (chạy ẩn) nên bạn có thể sang mục khác trong lúc ứng dụng xử lý.
  - Tại đây, hệ thống gửi nội dung thô (raw text) về hệ thống Gemini AI để bóc tách thành chuẩn dữ liệu (Tên, Email, Số điện thoại, Lĩnh vực chuyên môn, Bằng cấp...). 
  - **Cảnh báo trùng lặp (Duplicate Detection)**: Tự động cảnh báo nếu ứng viên đã có mặt trên hệ thống.
  - Sau khi bóc tách cơ bản, bạn có thể sang mục **Company Templates** để dùng tính năng **Re-extract Details (AI)** bóc tách toàn bộ lịch sử làm việc chi tiết.

### 5. AI Tools & Phân Tích Chuyên Sâu
- **Mục Đích**: Ứng dụng AI phân tích CV ở mức độ cao cấp.
- **Tính năng**:
  - **Spellcheck**: Proofread toàn bộ CV và xuất ra mã Markdown sửa lỗi ngữ pháp. Bạn dùng tính năng này để dịch thuật và tối ưu hồ sơ cho ứng viên cực kì chính xác, sau copy dán cấu trúc được nâng cấp.
  - **AI Review**: Chấm điểm phù hợp với một Job Description (JD).
  - **Candidate Matcher**: Tìm trong CSDL các CV phù hợp nhất với một JD. Xuất báo cáo dưới dạng Word.

### 6. Khớp Dữ Liệu Form Công Ty (Company Templates)
- **Mục Đích**: Xuất (Export) thông tin vừa bóc tách sang chuẩn CV/Profile của Công ty bạn bằng file Word (.docx) mà vẫn giữ nguyện định dạng, bảng biểu, fonts chữ bản gốc.
- **Hướng Dẫn Thiết Lập Template Word (Quan Trọng)**:
  1. Mở file MS Word Form của công ty (Ví dụ chuẩn của PTSC, Vietsopetro...).
  2. Tại giao diện, hãy điền các thẻ định dạng (Biến - Variables) được bọc trong cặp ngoặc nhọn `{ }` vào vị trí tương ứng. Dưới đây là các thẻ phổ biến thường dùng:
     - `{CANDIDATE_NAME}` : Chỗ điền Tên ứng viên
     - `{DISCIPLINE}` : Chỗ điền Vị trí/Chuyên ngành
     - `{EMAIL}` , `{PHONE}` : Thông tin liên hệ
     - `{YEARS_EXP}` : Số năm làm việc
     - `{WORK_EXPERIENCE}` : Lịch sử làm việc
     - `{EDUCATION}` : Quá trình đào tạo/Bằng cấp
  3. AI hỗ trợ xuất bất kỳ thông tin nào bạn muốn. Bạn có thể tự đặt một thẻ ngữ cảnh, VD: `{PROJECTS_LIST}`, AI sẽ tự động phân tích và lấy đúng mảng dự án của ứng viên điền vào.
  4. Bắt buộc lưu ở dạng file `.docx`. Tải file lên công cụ và chọn "New Template".
  
- Ở phần này hỗ trợ màn hình **Side-by-side** chia hai nửa màn hình: Một bên là File định dạng gốc và một bên là Dữ liệu ứng viên mà AI đọc được để đối chiếu sửa lỗi tự động.

### 7. Quản Lý Thư Mục (Folder Management) & Google Drive Backup
- **Mục Đích**: Phân loại tự động các CV PDF đã xử lý vào Google Drive.
- **Tính năng**: 
  - Hệ thống tự động tạo các Folder chuyên ngành con bên trong Drive Root.
  - Giao diện cung cấp cho Admin tính năng Share lại Drive Link để Viewer, HR khác có thể vào copy/download trực tiếp CVs file gốc.

### 8. Nhóm Chuyên Trách & Các Chuyên Ngành Được AI Đào Tạo (Disciplines)
Hệ thống sử dụng AI để tự động định danh CV của ứng viên vào các nhóm nghiệp vụ (Discipline). Đây là danh sách các nhóm bắt buộc trong CSDL để AI đọc:
- Subsea
- Project Management
- Process Engineering
- Piping QA/QC Inspector / Piping Field Engineer Class II
- Structure QA/QC Inspector / Senior Structure Inspector – Class I / Structural Field Engineer Class II
- Senior Welding Inspector – Class I / Senior Welding Engineer – Class I
- Senior NDT Inspector – Class I
- Dimensional Control Inspector – Class I
- Senior Mechanical Inspector – Class I
- Senior Painting & Coating Inspector – Class I
- Material Inspector – Class I
- Electrical Field Engineer Class II / Senior Electrical Inspector – Class I
- Senior HVAC Inspector – Class I
- Architectural Inspector Class I2

---

## PHẦN 3: HƯỚNG DẪN CÀI ĐẶT TRÊN MÔI TRƯỜNG MÁY CHỦ (HOẶC MÁY LÀM VIỆC CÁ NHÂN)

Ứng dụng của bạn là Single Page Application xây dựng trên nền tảng React + TypeScript + Firebase. Để chạy độc lập hãy làm thứ tự các bước:

### BƯỚC 1: TẢI SOURCODE VÀ CÀI ĐẶT MÔI TRƯỜNG
1. Nhấn nút Tải Về ở góc ứng dụng AI Studio. File chứa trọn bộ Sourcecode.
2. Cài trình soạn thảo **Visual Studio Code** và khung chạy **Node.js (LTS version)** mới nhất.
3. Giải nén Sourcecode và mở trên Visual Studio Code.

### BƯỚC 2: CẬP NHẬT FIREBASE CLOUD VÀ AUTHENTICATION (BẮT BUỘC)
Nếu đây là ứng dụng gốc, bộ CSDL đã có sẵn cấu hình tại `firebase-applet-config.json`. Nếu bạn tự lập một Project cho tổ chức của riêng bạn:
1. Đăng nhập [Firebase Console](https://console.firebase.google.com/), tạo một Project mới.
2. Bật tính năng **Firestore Database** (để chế độ Test hoặc Production và dán nội dung ở thư mục `firestore.rules` vào phần Rules).
3. Bật Firebase **Authentication** > **Sign-in method** > Thêm **Google**.
4. Truy cập Web setup, chèn các Parameter (ApiKey, ProjectId) vào `/src/lib/firebase.ts`.

### BƯỚC 3: CẤU HÌNH OAUTH 2 CHO GOOGLE (CHỨNG CHỈ TRUY CẬP DRIVE/SHEET)
1. Truy cập [Google Cloud Console](https://console.cloud.google.com).
2. Tìm API & Services > Lựa chọn Project tương ứng của Firebase.
3. Bật (Enable) APIs: **Google Drive API** và **Google Sheets API**.
4. Setup OAuth Consent Screen, mục **Scopes** thêm hai quyền `.../auth/drive` và `.../auth/spreadsheets`.
5. Tạo Credentials -> **OAuth client ID** (chọn loại ứng dụng Web). 
6. Thêm URI trang Web hiện tại của bạn vào Authorized redirect URIs. (Nếu làm ở localhost, thêm `http://localhost:3000`).

### BƯỚC 4: KHỞI CHẠY (RUNNING)
1. Tại thư mục sourcecode (Visual Studio Code Terminal), gõ:
   ```bash
   npm install
   ```
2. Khởi động Web App ảo trên máy:
   ```bash
   npm run dev
   ```
3. Mở địa chỉ `http://localhost:3000` trên trình duyệt. Đăng nhập tài khoản Admin đầu tiên và tại mục Settings nhúng **Client ID OAuth 2** được tạo ở Bước 3.
4. Cấu hình các Key quan trọng (Nêu ở đầu hướng dẫn). Xong!

**Bộ Tài Liệu Kỹ Thuật (Modern Stack Info):**
- Core: React + Vite + Typescript. Tailwind CSS (Styling), Recharts.
- UI Toolkit: Shadcn. Icons: Lucide React.
- AI Framework: Google Gemini 2.0 Flash thông qua '@google/genai'.
- Xử lý File thô: PDF.js & Mammoth.js.
- CSDL Tĩnh: Firebase Cloud Firestore.
