# Hướng dẫn viết prompt cho Chatlocal

Prompt là tin nhắn bạn gửi cho AI. Prompt càng rõ thì kết quả càng đúng ý, ít phải sửa đi sửa lại.

## 1. Chọn đúng chế độ trước khi gửi

| Chế độ | Dùng khi | AI làm được |
|---|---|---|
| **Chat** | Hỏi đáp, giải thích, viết đoạn văn, dịch, lên ý tưởng | Chỉ trả lời bằng chữ trong khung chat |
| **Công việc** | Cần **tệp tải về** (Word, PDF, Excel, PowerPoint, ảnh) hoặc thao tác trên máy (sửa code, chạy lệnh trong thư mục đã chọn) | Tạo tệp, đọc tệp đính kèm, sửa code, chạy lệnh |

Cần ra file thì chọn **Công việc**. Ở chế độ Chat, AI chỉ viết nội dung ra màn hình.

## 2. Công thức một prompt tốt

Viết đủ 5 ý sau. Không cần dài, chỉ cần rõ:

1. **Mục tiêu**: bạn cần cái gì.
2. **Bối cảnh**: dùng cho ai, để làm gì.
3. **Nội dung bắt buộc**: các phần, số liệu, ý phải có.
4. **Định dạng đầu ra**: Word, PDF, Excel, PowerPoint, ảnh, hay chỉ trả lời trong chat; độ dài; giọng văn.
5. **Giới hạn**: những gì không được làm, không được bịa.

Mẫu:

```
Mục tiêu: <bạn cần gì>
Bối cảnh: <dùng cho ai, để làm gì>
Nội dung phải có:
- <ý 1>
- <ý 2>
Định dạng: <Word và PDF / Excel / chỉ trả lời trong chat>, khoảng <độ dài>, giọng <trang trọng / thân mật>
Lưu ý: <không bịa số liệu, giữ nguyên thuật ngữ…>
```

## 3. Ví dụ theo từng việc

### Báo cáo Word và PDF (chế độ Công việc)

Chưa tốt:

> làm báo cáo về Pebbles

Tốt:

```
Làm báo cáo so sánh Pebbles Việt Nam và Doctor Network cho ban giám đốc MCV.
Nội dung phải có:
- Tổng quan hai doanh nghiệp
- Bảng SWOT cho từng bên
- Ma trận TOWS
- 3 đề xuất chiến lược cho MCV, mỗi đề xuất có lý do và bước triển khai
Định dạng: xuất cả file Word và file PDF, khoảng 8–10 trang, giọng trang trọng.
Lưu ý: số liệu nào không chắc thì ghi rõ "cần kiểm chứng", không tự bịa.
```

Muốn có cả hai định dạng thì ghi rõ **"cả Word và PDF"**. App tự áp dụng giao diện chuẩn: tiêu đề, heading có màu, bảng có hàng tiêu đề tô màu, số trang.

### Chỉnh lại tài liệu đã tạo

Nói rõ **sửa chỗ nào** và **sửa thành gì**, đừng chỉ nói "làm lại đẹp hơn":

```
Sửa file Word vừa tạo:
- Gộp phần 2 và phần 3 thành một phần "Phân tích đối thủ"
- Chuyển danh sách điểm mạnh, điểm yếu thành bảng 2 cột
- Thêm phần "Kết luận" ở cuối, khoảng nửa trang
Xuất lại file Word và PDF.
```

Giao diện (màu, font, số trang) do app tự lo. Muốn tài liệu đẹp hơn thì yêu cầu **bố cục rõ hơn**: thêm heading, chuyển đoạn văn dài thành gạch đầu dòng hoặc bảng.

### Bảng tính Excel

```
Tạo file Excel chấm công tháng 10/2026 cho 15 nhân viên.
Cột: Họ tên, Phòng ban, các ngày 1–31, Tổng công.
Cột Tổng công dùng công thức đếm số ngày có ký hiệu "x".
Hàng tiêu đề in đậm.
```

### Slide PowerPoint

```
Làm slide PowerPoint 8 trang tóm tắt báo cáo benchmark vừa tạo, dùng để thuyết trình 10 phút.
Mỗi slide tối đa 4 gạch đầu dòng, có ghi chú người nói ở từng slide.
```

### Tạo và sửa ảnh (chế độ Công việc)

App có 2 model ảnh chạy trên máy, đều cho ảnh 1024×1024:

- **Flux** (FLUX.2 Klein Q8): tạo ảnh mới, và sửa ảnh theo 1 hoặc 2 ảnh tham chiếu, ví dụ đổi khuôn mặt.
- **Z-Image-Turbo Q8**: tạo ảnh mới nhanh, hoặc vẽ lại từ đúng 1 ảnh nguồn.

Mô tả đủ: **chủ thể, hành động, bối cảnh, phong cách, ánh sáng, góc chụp**.

```
Tạo ảnh bằng Flux: một con mèo mặc vest đen ngồi làm việc ở văn phòng hiện đại,
ánh nắng chiều qua cửa sổ, phong cách ảnh chụp chân thực, góc ngang tầm mắt.
```

Dùng 2 ảnh thì nói rõ ảnh nào là **ảnh gốc** (cảnh cần giữ), ảnh nào là **ảnh tham chiếu** (khuôn mặt cần lấy):

```
Dùng Flux. Ảnh thứ nhất là ảnh gốc, giữ nguyên cảnh và trang phục.
Ảnh thứ hai là khuôn mặt tham chiếu. Thay khuôn mặt người đứng giữa trong ảnh gốc bằng khuôn mặt ở ảnh thứ hai.
```

Việc đơn giản như xoay, cắt, đổi kích thước, làm mờ, chèn chữ lên ảnh thì cứ nói thẳng. App xử lý ngay, không cần model AI.

### Code trong thư mục trên máy (chế độ Công việc)

Chọn thư mục trong **Repo và thư mục trên máy** trước, rồi viết:

```
Trong trang index.html, thêm nút "Đăng ký" ở góc phải thanh menu.
Bấm vào thì mở form có Họ tên, Email, Số điện thoại; Email phải đúng định dạng.
Không đổi màu sắc và font hiện có. Làm xong mở bản xem trước cho tôi xem.
```

Muốn commit hoặc push thì phải nói rõ "commit" hoặc "push". AI không tự làm.

## 4. Nội dung dài

- **Chế độ Chat**: dán được nội dung dài khoảng vài chục nghìn ký tự. Dài hơn thì app báo và gợi ý chuyển sang Công việc.
- **Chế độ Công việc**: dán được đề bài rất dài, cả trăm nghìn ký tự. App giữ bản đầy đủ trên máy, AI đọc từng đoạn khi cần, bạn không phải tự chia nhỏ.
- **Tệp đính kèm** (PDF, Word, Excel, PowerPoint, ảnh): tối đa 5 tệp mỗi lần gửi, 10 tệp mỗi chat, mỗi tệp tối đa 8 MB. Ở chế độ Công việc, AI đọc được toàn bộ tệp dài. Ở chế độ Chat, AI chỉ thấy phần đầu.
- Tài liệu dài thì nên **đính kèm tệp** thay vì dán, và nói rõ cần làm gì với nó:

```
Đọc file báo cáo đính kèm. Tóm tắt mỗi chương trong 3 câu, rồi liệt kê 5 rủi ro lớn nhất kèm số trang.
```

## 5. Tiếp tục và sửa kết quả

- Câu trả lời bị dừng giữa chừng: gõ **"tiếp tục"**. AI viết tiếp đúng chỗ dừng, không lặp lại.
- Công việc đang làm dở bị gián đoạn: gõ **"tiếp tục công việc vừa rồi"**.
- Kết quả chưa đúng: nói rõ **sai ở đâu** và **muốn thế nào**, ví dụ "phần 3 thiếu số liệu năm 2025, bổ sung bảng doanh thu 2023–2025".
- Muốn làm việc mới, không liên quan: bấm **Cuộc trò chuyện mới**, để AI không lẫn với việc cũ.
- Đang có việc chạy vẫn chuyển qua chat khác được. Kết quả tự về đúng chat gốc.

## 6. Nên và không nên

**Nên:**
- Mỗi tin nhắn tập trung một việc chính.
- Ghi rõ định dạng tệp cần nhận.
- Đưa ví dụ mẫu nếu bạn muốn đúng một kiểu trình bày.
- Yêu cầu AI ghi "cần kiểm chứng" với số liệu không chắc chắn.

**Không nên:**
- Gửi mật khẩu, token, số thẻ ngân hàng hay thông tin nhạy cảm vào chat.
- Viết quá chung chung như "làm đẹp hơn", "làm lại đi" mà không nói sửa gì.
- Gộp nhiều việc khác nhau vào một tin nhắn, ví dụ vừa viết báo cáo, vừa tạo ảnh, vừa sửa code.
- Tin tuyệt đối vào số liệu, giá cả, tin tức mới: AI có thể không có dữ liệu mới nhất, hãy kiểm tra lại.
