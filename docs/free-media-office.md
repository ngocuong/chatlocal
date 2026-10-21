# Chỉnh ảnh và Office miễn phí trong chatlocal

Chọn **Công việc**, nhấn **＋** đính kèm file rồi yêu cầu sửa. Không cần repo hoặc API key ảnh cho các thao tác local. Kết quả là bản mới có nút tải xuống, file gốc giữ nguyên.

- Ảnh PNG/JPEG/WebP: cắt, xoay, lật, thu nhỏ, trắng đen, mờ, sáng/màu, chuyển PNG/JPEG/WebP và chất lượng nén.
- Word DOCX: tạo tài liệu; thay chữ trong đoạn văn, bảng, đầu/chân trang và chú thích. Giữ các thành phần ZIP khác; định dạng chữ mới theo run chứa đầu chuỗi được thay. Không thay xuyên đoạn văn.
- PowerPoint PPTX: tạo slide; thay chữ trong slide/notes, giữ các thành phần ZIP khác. Không chỉnh tùy ý bố cục hoặc animation.
- Excel XLSX: đọc sheet; tạo workbook; sửa ô, lưu công thức. Không tính công thức trên server. ExcelJS không bảo toàn mọi tính năng nâng cao.
- PDF: đọc nội dung theo chức năng sẵn có. Chưa chỉnh PDF, .doc, .xls, .ppt hoặc file mã hóa.

Ví dụ: “Cắt ảnh này vùng x=20 y=20 rộng 300 cao 200, chuyển WebP”; “Trong Word này thay Công ty A thành Công ty B”; “Sửa ô B2 sheet Doanh thu thành 250000”; “Trong PowerPoint này thay năm 2025 thành 2026”.

## Nguồn GitHub

| Thành phần | Repo | Giấy phép | Sử dụng |
|---|---|---|---|
| Sharp | https://github.com/lovell/sharp | Apache-2.0 | Chỉnh ảnh local |
| ExcelJS | https://github.com/exceljs/exceljs | MIT | Đọc/tạo/sửa XLSX |
| docx | https://github.com/dolanmiu/docx | MIT | Tạo Word (đã có) |
| PptxGenJS | https://github.com/gitbrent/PptxGenJS | MIT | Tạo PowerPoint (đã có) |
| AdmZip | https://github.com/cthackers/adm-zip | MIT | Sửa XML trong DOCX/PPTX (đã có) |

Skill nằm trong web/skills; controller thực thi nằm trong document-files.service.ts và chat-artifacts.service.ts. Không cài repo lạ hoặc chạy script từ skill bên ngoài. Công cụ local miễn phí; model chat vẫn dùng kết nối ChatGPT hiện có. Tạo/chỉnh ảnh AI chỉ dùng model local đã chọn; phần ảnh OpenAI và cấu hình API key đã được gỡ.

## Tạo ảnh AI local

Diffusers (Apache-2.0): https://github.com/huggingface/diffusers
SD-Turbo chính thức: https://huggingface.co/stabilityai/sd-turbo

Runtime riêng tại data/image-runtime, model cache tại data/image-models. Chạy `data/image-runtime/bin/python scripts/local-image.py --setup` để tải và kiểm tra model. Sau cài đặt, tạo ảnh không cần mạng hoặc API key; dùng GPU MPS trên Apple Silicon, ảnh 512×512. Model nhỏ có thể bỏ sót chi tiết, vẽ sai người/khuôn mặt và không tạo chữ rõ; chèn chữ bằng công cụ transform. Quyền dùng model theo model card/giấy phép của Stability AI, cần xem điều kiện riêng khi dùng thương mại. Python dependencies nằm trong scripts/local-image-requirements.txt.

## Chọn model ảnh local

Trong **Ảnh và tài liệu → Model tạo ảnh miễn phí trên máy**, chọn **SD-Turbo** (512×512) hoặc **Z-Image-Turbo Q4** (768×768), rồi bấm **Dùng model này**. Lựa chọn được lưu ở `data/local-image-settings.json`. Controller chụp lựa chọn ở đầu mỗi lượt; thay đổi cài đặt không đổi model của lượt đang chạy. Không tự chuyển sang model khác khi model đã chọn gặp lỗi. Mỗi ảnh có tên model và thời gian tạo phía dưới.

Q4 dùng MFLUX/MLX, `--low-ram`, cache 0.5 GB, giải mã VAE theo ô và float16, 9 bước. Model Q4 là bản chuyển đổi của cộng đồng: https://huggingface.co/mflux-community/z-image-turbo-mflux-q4. Vị trí model lưu tại `data/q4-model.json`; ổ chứa model phải được kết nối. Trạng thái sẵn sàng chỉ bật sau khi chạy thử thành công, lưu ở `data/q4-ready.json`.

Cài lại: tạo venv `data/mflux-runtime`, cài `scripts/mflux-requirements.txt` rồi chạy `data/mflux-runtime/bin/python scripts/setup-q4.py --model-dir /duong-dan-o-dia/z-image-turbo-q4`. Script tải model, tạo ảnh kiểm tra và ghi trạng thái. Pillow được ghim 12.3.0 để tương thích Python 3.12.

Nếu câu trả lời ở Trò chuyện đề nghị chuyển chế độ, nút **Thực hiện trong Công việc** chuyển sang Work và gửi lại yêu cầu ngay phía trên. Khi ô nhập có bản nháp, nút chỉ chuyển chế độ và giữ nguyên bản nháp.
