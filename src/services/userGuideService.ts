import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType, ExternalHyperlink } from 'docx';
import { saveAs } from 'file-saver';

export async function generateUserGuide() {
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    new Paragraph({
                        text: "HƯỚNG DẪN SỬ DỤNG PHẦN MỀM QUẢN LÝ CV (Dành cho người không rành máy tính)",
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                    }),
                    new Paragraph({
                        text: "Lời nói đầu",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 200, after: 200 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Chào mừng bạn đến với ứng dụng quản lý CV bằng Trí tuệ Nhân tạo (AI). Tài liệu này sẽ hướng dẫn bạn chi tiết từng bước để sử dụng phần mềm, cài đặt kết nối và chia sẻ quyền cho nhân viên khác một cách dễ hiểu nhất.", size: 24 })
                        ],
                        spacing: { after: 200 },
                    }),
                    
                    new Paragraph({
                        text: "1. Trích xuất CV và xử lý lỗi (CV Extraction)",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 200 },
                        border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Tại thẻ ", size: 24 }),
                            new TextRun({ text: "CV Extraction", bold: true, size: 24 }),
                            new TextRun({ text: ", bạn có thể kéo thả nhiều file PDF hoặc tải CV trực tiếp từ thư mục Google Drive (Drive Inbox) và nhờ AI đọc chúng.", size: 24 })
                        ],
                        spacing: { after: 120 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Cách xử lý lỗi: ", bold: true, size: 24 }),
                            new TextRun({ text: "Trong trường hợp AI xử lý thất bại (hiện chữ Error màu đỏ - có thể do mạng, hoặc máy chủ AI đang quá tải), bạn chỉ cần ", size: 24 }),
                            new TextRun({ text: "Rê chuột (Hover)", bold: true, italics: true, size: 24 }),
                            new TextRun({ text: " vào file bị lỗi đó trong danh sách hàng đợi chờ trích xuất. Một biểu tượng ", size: 24 }),
                            new TextRun({ text: "Thùng rác (Trash) màu đỏ", bold: true, size: 24 }),
                            new TextRun({ text: " sẽ hiện ra ở góc phải. Hãy bấm vào đó để xóa file lỗi này ra khỏi danh sách, tránh làm gián đoạn các file khác.", size: 24 })
                        ],
                        spacing: { after: 120 },
                    }),

                    new Paragraph({
                        text: "2. Phân quyền và Cài đặt cho Nhân sự khác (Non-admin)",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 300, after: 200 },
                        border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Bởi vì \"chất xám\" và Dữ liệu (Cloud Firestore) được lưu nội bộ trong nền tảng Database của App, nhưng Files PDF và trang tính Google Sheet lại thuộc về hạ tầng bảo mật của Google. Do đó, tài khoản Google của nhân sự khác không tự nhiên mà có quyền vào file hệ thống của bạn.", size: 24 })
                        ],
                        spacing: { after: 120 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Để thiết lập cho một nhân viên hoặc người tuyển dụng khác, vui lòng làm theo đúng 3 bước sau:", bold: true, size: 24 })
                        ],
                        spacing: { after: 120 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Bước 1 (Dành cho Admin): ", bold: true, size: 24 }),
                            new TextRun({ text: "Bạn (Admin) truy cập trang web thư mục Google Drive của công ty, và file trang tính Google Sheets -> Nhấn nút ", size: 24 }),
                            new TextRun({ text: "Share (Chia sẻ)", bold: true, size: 24 }),
                            new TextRun({ text: " -> Điền email Google của nhân viên đó vào và cấp quyền ưu tiên ở cấp độ ", size: 24 }),
                            new TextRun({ text: "Editor (Người chỉnh sửa)", bold: true, size: 24 }),
                            new TextRun({ text: ".", size: 24 })
                        ],
                        spacing: { after: 120 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Bước 2 (Dành cho Nhân viên): ", bold: true, size: 24 }),
                            new TextRun({ text: "Nhân viên đó truy cập App bằng link hệ thống, nhấn nút ", size: 24 }),
                            new TextRun({ text: "Sign In With Google", bold: true, size: 24 }),
                            new TextRun({ text: " ở thanh điều hướng để cấp quyền đăng nhập an toàn vào App.", size: 24 })
                        ],
                        spacing: { after: 120 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Bước 3 (Dành cho Nhân viên): ", bold: true, size: 24 }),
                            new TextRun({ text: "Nhân viên đó vào thẻ ", size: 24 }),
                            new TextRun({ text: "Settings (Cài đặt)", bold: true, size: 24 }),
                            new TextRun({ text: " của App. Dán đúng chuỗi ID Google Drive và ID Google Sheets mà bạn (Admin) cung cấp vào trong các ô thiết lập. Sau đó kéo xuống và nhấn nút ", size: 24 }),
                            new TextRun({ text: "Connect Google Account", bold: true, size: 24 }),
                            new TextRun({ text: " để hoàn tất tích hợp.", size: 24 })
                        ],
                        spacing: { after: 120 }
                    }),

                    new Paragraph({
                        text: "3. Truy cập hệ thống (Đường dẫn Link App)",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 300, after: 200 },
                        border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Tất cả mọi người (cả Admin lẫn Non-admin) đều có chung một đường dẫn truy cập duy nhất vào ứng dụng: ", size: 24 }),
                            new ExternalHyperlink({
                                children: [
                                    new TextRun({
                                        text: "https://ais-dev-bwjpoqgejqn2jylvu5smsf-43531591235.asia-east1.run.app/",
                                        style: "Hyperlink",
                                        color: "0563C1",
                                        underline: {
                                            type: "single",
                                            color: "0563C1"
                                        }
                                    }),
                                ],
                                link: "https://ais-dev-bwjpoqgejqn2jylvu5smsf-43531591235.asia-east1.run.app/"
                            }),
                        ],
                        spacing: { after: 120 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Bạn không cần cung cấp các đường link riêng biệt cho từng người. ", bold: true, size: 24 }),
                            new TextRun({ text: "Sau khi người dùng Log in bằng Google, cơ sở hạ tầng phân quyền tự động của hệ thống sẽ tự kiểm tra xem email của họ đang mang vai trò gì (Admin, Recruiter hay Viewer). App sẽ tự khắc thay đổi giao diện, ẩn hoặc hiện các cài đặt cũng như giới hạn quyền hành tương ứng cho từng người.", size: 24 })
                        ],
                        spacing: { after: 120 }
                    }),

                    new Paragraph({
                        text: "4. Tính an toàn khi Di chuyển Google Sheet & Drive",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 300, after: 200 },
                        border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Câu hỏi: Khi di chuyển file tính Google Sheets hay Folder ra chỗ khác thì App có bị lỗi không?", bold: true, size: 24 })
                        ],
                        spacing: { after: 120 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Trả lời: App vẫn sẽ hoạt động bình thường, không xảy ra vấn đề gì!", bold: true, color: "008800", size: 24 })
                        ],
                        spacing: { after: 120 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Tính năng của Google APIs đối với Google Sheets và Drive xác định dữ liệu và thư mục bằng một chuỗi ", size: 24 }),
                            new TextRun({ text: "định danh duy nhất (ID)", bold: true, size: 24 }),
                            new TextRun({ text: " (ví dụ: 1n1eM3BkMeO26...). Việc thao tác bạn thay thế hay đưa file Sheet này vào một thư mục khác bên trong giao diện Google Drive (như đổi vào thư mục OilGas_CV_Management_2026) ", size: 24 }),
                            new TextRun({ text: "KHÔNG làm thay đổi ID nội bộ của Sheet đó", bold: true, underline: { type: "single", color: "auto" }, size: 24 }),
                            new TextRun({ text: ". Do đó máy chủ (server) của App vẫn sẽ ghi nhớ đúng ID của file và tự động đổ data vào Sheet đó một cách chính xác mà không gặp bất cứ lỗi mất kết nối nào.", size: 24 })
                        ],
                        spacing: { after: 120 }
                    })
                ],
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "Huong_Dan_Su_Dung_Quan_Ly_CV.docx");
}
