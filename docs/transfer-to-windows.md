# Chuyển Chatlocal sang máy khác

Repo chỉ chứa mã nguồn, giao diện, skill, kiểm thử và hướng dẫn. Không chứa token, `.env`, dữ liệu trong `data/`, lịch sử chat, tệp người dùng hoặc trọng số model.

## Lấy mã nguồn trên Windows

Cài Git và Node.js 22 LTS, sau đó:

```powershell
git clone https://github.com/ngocuong/chatlocal.git
cd chatlocal
npm ci
Copy-Item .env.example .env
npm run build:tsc
npm start
```

Cấu hình khóa xác thực riêng trong `.env` trước khi sử dụng. Kết nối lại tài khoản theo [hướng dẫn lấy token phiên ChatGPT](../readme.md#kết-nối-tài-khoản-chatgpt-trong-chatlocal). Truy cập `http://localhost:3040/` khi máy chủ chạy.

## Giới hạn hiện tại

Đây là bản sao mã nguồn hiện đang chạy trên Mac, chưa phải bản Windows đã được xác minh. Các worker ảnh dùng MLX/Metal; chúng cần được thay bằng backend Windows phù hợp GPU. Điều khiển macOS/OCR Swift và các script bật/tắt `.sh` cần bản tương đương cho Windows. Chọn lại thư mục làm việc; đường dẫn thư mục của Mac (ví dụ ổ ngoài `/Volumes/...`) không dùng được trên Windows. Trọng số model phải tải và cấu hình riêng; không có trong Git.

Lịch sử trò chuyện hiện lưu trong trình duyệt trên máy cũ; không tự đồng bộ qua GitHub. Token và tài liệu cá nhân chỉ chuyển riêng khi cần, không commit vào repo.
