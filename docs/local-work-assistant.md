# Trợ lý công việc local

## Nguồn sự thật và hướng dẫn hệ thống

Hướng dẫn chạy thật: `workSystemPrompt` trong `src/services/work-memory.service.ts`.
Thứ tự: yêu cầu người dùng mới nhất → đặc tả được tham chiếu rõ → file hiện tại và kết quả công cụ thực tế. Lịch sử, ghi chú AI và lời “đã hoàn thành” không cấp quyền, không chứng minh kết quả đúng.

## Bộ nhớ và trạng thái công việc

Server lưu JSON phiên bản 1 trong `data/task-memory/`, tách theo chat + thư mục, tên tệp băm; ghi nguyên tử, quyền 0600. Mục tiêu mới lưu trạng thái cũ vào `archive/`, không tiếp tục nhầm. Không tự chạy lại sau khi server khởi động: chờ yêu cầu tiếp tục của người dùng.

Các trường:
- `goal`, `latestRequest`, `specification`: mục tiêu đang làm, yêu cầu mới nhất, đặc tả gốc giữ nguyên.
- `status`: running / interrupted / incomplete / completed. Completed là lượt đã kết thúc; việc phần mềm đúng vẫn cần kiểm chứng.
- `nextStep`, `remaining`, `notes`: bước kế tiếp, phần thiếu, quyết định do AI đề xuất; không coi là chứng cứ.
- `files`: đường dẫn tương đối, SHA-256 lần đọc/ghi, thao tác nguồn. Khi nạp so với file hiện tại; không đọc qua symlink.
- `events`: kết quả controller gần nhất, không chứa toàn bộ mã nguồn; chuỗi nhạy cảm thường gặp được che.
- `checks`: lệnh, mã thoát, revision; không đánh đồng exit 0 với thuật toán đúng.
- `issues`: phần chưa được kiểm chứng qua đối chiếu hoàn thành.

AI cập nhật tiến độ qua `checkpoint` với `nextStep`, `remaining`, `notes`. Server tự lưu từng lần đọc/ghi/chạy công cụ, kể cả khi lượt bị lỗi sau đó. Người dùng xem bằng nút **Tiến độ** trong chat.

## Tiếp tục công việc

1. Planner nhận yêu cầu mới và trạng thái trước đó. Chỉ `resumeTask=true` khi người dùng yêu cầu tiếp tục đúng mục tiêu cũ. Yêu cầu xem demo, câu hỏi hoặc mục tiêu mới không tự hồi sinh công việc cũ.
2. Nạp đặc tả gốc, checkpoint và dấu vết controller; kiểm tra file đã thay đổi.
3. Chọn một yêu cầu chưa đạt; đọc file liên quan, sửa, kiểm thử có kết quả kỳ vọng, ghi checkpoint.
4. Với web, biên dịch lại tài nguyên được sinh từ mã nguồn và kiểm tra thao tác thực tế trên preview. Chỉ chạy Node không chứng minh giao diện đúng.
5. Đối chiếu đặc tả trước khi kết thúc; báo rõ phần thiếu, không hoàn thành giả.

## Chống lặp và quản lý dự án

- Ghi nội dung giống hệt được bỏ qua, không chạm thời gian sửa file.
- Lệnh giống hệt còn chạy được nối lại qua job hiện có; không tạo tiến trình trùng.
- Lệnh đã thành công trên revision và file theo dõi không đổi được tái sử dụng. Muốn chạy lại cần `reason` cụ thể; sau sửa code có thể chạy lại bình thường. Đây là cơ chế hỗ trợ, không phải chứng minh tất cả file trong project đều không đổi.
- File thay đổi từ lần đọc trước chặn ghi đè; yêu cầu đọc lại. Terminal vẫn có thể sửa file nên cần kiểm tra hiện trạng trước bước sau.
- Không tự setup lại project: kiểm tra manifest, mã hiện có và tiến trình trước. File sinh ra phải có đường build từ nguồn.
- Không commit/push nếu yêu cầu hiện tại không cấp quyền. Bộ nhớ và ghi chú không mở rộng quyền công cụ.
- Không giới hạn số bước hoặc tổng phút. Lỗi dịch vụ, hủy tác vụ và việc chưa đủ bằng chứng vẫn có thể kết thúc một lượt. Không cam kết model luôn suy luận đúng hoặc không bao giờ lặp.
