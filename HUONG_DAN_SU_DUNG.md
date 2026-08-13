# Hướng Dẫn Sử Dụng Hệ Thống VietMed Kỹ Thuật

Tài liệu này hướng dẫn sử dụng website quản lý kỹ thuật VietMed cho Admin, Quản lý và Kỹ sư. Nội dung tập trung vào các thao tác hằng ngày: quản lý khách hàng, thiết bị, phụ kiện, phiếu công việc, lịch làm việc, báo cáo và hồ sơ khách hàng.

## 1. Tổng Quan Hệ Thống

Hệ thống VietMed Kỹ Thuật dùng để quản lý toàn bộ dữ liệu vận hành của phòng kỹ thuật:

- Khách hàng, bệnh viện, phòng ban và người liên hệ.
- Thiết bị/máy đã bán, đã lắp đặt hoặc đang quản lý.
- Model máy, ngành hàng, phụ kiện theo model.
- Phiếu lắp đặt, sửa chữa, bảo trì.
- Lịch làm việc, nhật ký xử lý, vật tư/phụ kiện đã dùng.
- Báo cáo tổng hợp, hiệu suất kỹ sư và lịch sử thay đổi dữ liệu.

Mỗi người dùng sẽ thấy menu khác nhau tùy vai trò được cấp.

## 2. Đăng Nhập Và Giao Diện Chính

1. Mở website hệ thống.
2. Nhập tài khoản được Admin cấp.
3. Bấm **Đăng nhập**.
4. Sau khi đăng nhập, hệ thống chuyển vào màn **Tổng quan**.

Các khu vực chính trên màn hình:

- **Menu bên trái**: nơi chuyển giữa các màn như Tổng quan, Sổ công việc, Khách hàng, Sản phẩm & Thiết bị.
- **Thanh trên cùng**: hiển thị thông tin người dùng và các thao tác tài khoản.
- **Khu vực nội dung**: hiển thị bảng, biểu mẫu, báo cáo hoặc hồ sơ chi tiết.

## 3. Phân Quyền Người Dùng

### Admin

Admin có quyền quản trị dữ liệu nền và điều phối công việc:

- Quản lý khách hàng, thiết bị, ngành hàng, model, phụ kiện.
- Tạo/sửa/xóa phiếu sửa chữa, bảo trì, lắp đặt.
- Quản lý nhân sự, vai trò, khu vực.
- Xem báo cáo tổng hợp, hiệu suất kỹ sư, audit log.
- Điều phối và duyệt công việc.

### Quản lý

Quản lý chủ yếu dùng để theo dõi vận hành:

- Xem tổng quan.
- Xem khách hàng, thiết bị, kho máy.
- Xem sổ công việc.
- Xem báo cáo tổng hợp.
- Xem sản phẩm và thiết bị.

### Kỹ sư

Kỹ sư dùng hệ thống để thực hiện công việc hiện trường:

- Xem việc được giao.
- Cập nhật phiếu sửa chữa, bảo trì, lắp đặt.
- Ghi nhật ký xử lý.
- Ghi vật tư/phụ kiện đã dùng.
- Xem khách hàng phụ trách và lịch sử công việc.
- Xem kho máy, sản phẩm, tài liệu kinh nghiệm.

## 4. Màn Tổng Quan

Màn **Tổng quan** giúp xem nhanh tình hình vận hành:

- Số lượng công việc đang mở.
- Công việc quá hạn hoặc chờ xử lý.
- Tình trạng máy theo nhóm.
- Máy phòng kỹ thuật đang quản lý, phân theo ngành hàng.
- Thống kê nhanh theo kỹ sư hoặc nhóm công việc.

Cách dùng:

1. Vào **Tổng quan**.
2. Xem các thẻ chỉ số ở đầu trang.
3. Kéo xuống để xem danh sách máy, công việc và thống kê chi tiết.
4. Bấm vào các nút hoặc dòng dữ liệu nếu muốn mở màn liên quan.

## 5. Quản Lý Khách Hàng

Menu: **Khách hàng** hoặc **Khách hàng phụ trách**

### Với Admin/Quản lý

Admin và Quản lý dùng màn **Khách hàng** để xem toàn bộ danh sách khách hàng.

Các thao tác chính:

- Tìm khách hàng theo tên, mã, tỉnh/thành, số điện thoại.
- Xem thông tin liên hệ và kỹ sư phụ trách.
- Mở hồ sơ chi tiết khách hàng.
- Tạo hoặc cập nhật thông tin khách hàng nếu có quyền.

### Với Kỹ sư

Kỹ sư dùng màn **Khách hàng phụ trách** để xem các khách hàng liên quan đến mình.

Trong hồ sơ khách hàng, kỹ sư có thể xem:

- Danh sách máy khách đang sử dụng.
- Phụ kiện/máy đã bàn giao.
- Lịch sử sửa chữa, bảo trì, lắp đặt.
- Nhật ký xử lý, checklist và vật tư/phụ kiện đã dùng trong từng phiếu.
- Các công việc đang mở cần cập nhật.

### Xem chi tiết lịch sử công việc

1. Vào hồ sơ khách hàng.
2. Chọn tab hoặc khu vực **Lịch sử công việc**.
3. Dùng ô tìm kiếm để lọc theo mã phiếu, tên máy, trạng thái, kỹ sư hoặc nội dung xử lý.
4. Dùng phân trang để xem thêm nếu lịch sử có nhiều công việc.
5. Bấm **Chi tiết** trên từng dòng để xem:
   - Mã phiếu.
   - Loại việc.
   - Ngày báo/lịch hẹn/ngày hoàn tất.
   - Máy liên quan.
   - Mô tả ban đầu.
   - Kết quả xử lý.
   - Vật tư/phụ kiện đã dùng.
   - Nhật ký xử lý.
   - Checklist công việc.

## 6. Sổ Công Việc

Menu: **Sổ công việc**

Đây là nơi theo dõi các phiếu sửa chữa, bảo trì và lắp đặt.

Các loại công việc chính:

- **Sửa chữa**: xử lý lỗi máy, lỗi phụ kiện, sự cố tại khách hàng.
- **Bảo trì**: lịch bảo trì định kỳ, bảo trì hợp đồng, bảo hành.
- **Lắp đặt**: bàn giao, nghiệm thu, hướng dẫn vận hành.

Cách tìm công việc:

1. Vào **Sổ công việc**.
2. Dùng bộ lọc trạng thái, loại việc, kỹ sư hoặc khách hàng.
3. Dùng ô tìm kiếm để tìm theo mã phiếu, tên khách hàng, tên máy hoặc nội dung.
4. Bấm vào phiếu để xem/cập nhật chi tiết.

## 7. Cập Nhật Công Việc Của Kỹ Sư

Menu: **Việc của tôi**

Kỹ sư dùng màn này để xử lý các công việc được giao.

Quy trình cơ bản:

1. Vào **Việc của tôi**.
2. Chọn phiếu cần xử lý.
3. Kiểm tra thông tin khách hàng, máy và mô tả lỗi.
4. Ghi **Nhật ký xử lý**.
5. Tick **Checklist công việc**.
6. Chọn **Phụ kiện/vật tư đã dùng** nếu có.
7. Cập nhật kết quả xử lý và trạng thái phiếu.
8. Lưu lại.

### Ghi phụ kiện/vật tư đã dùng

Khi mở phiếu sửa chữa hoặc bảo trì:

1. Tìm khu vực vật tư/phụ kiện.
2. Chọn phụ kiện từ danh sách theo model máy.
3. Hệ thống tự điền tên phụ kiện và số lượng tiêu chuẩn.
4. Kỹ sư có thể chỉnh số lượng thực tế nếu dùng khác số lượng mặc định.
5. Nhập serial number nếu phụ kiện yêu cầu S/N.
6. Lưu phiếu.

Sau khi lưu, phụ kiện đã dùng sẽ xuất hiện trong:

- Chi tiết công việc.
- Hồ sơ khách hàng.
- Lịch sử công việc của máy/khách hàng.
- Báo cáo vật tư/phụ kiện nếu có thống kê liên quan.

## 8. Quản Lý Sản Phẩm, Model Và Phụ Kiện

Menu: **Sản phẩm & Thiết bị**, **Ngành hàng**, **Phụ kiện**

### Ngành hàng

Admin dùng **Ngành hàng** để khai báo nhóm ngành chính, ví dụ:

- Chẩn đoán hình ảnh.
- Xét nghiệm.
- Nội soi.
- Phục hồi chức năng.
- Khác.

Ngành hàng giúp dashboard và báo cáo phân loại máy rõ hơn.

### Sản phẩm / Model máy

Model máy là dữ liệu chuẩn dùng để quản lý thiết bị và phụ kiện.

Khi tạo model cần nhập:

- Mã model.
- Tên model.
- Hãng sản xuất.
- Ngành hàng/nhóm sản phẩm.
- Loại thiết bị.
- Mô tả nếu cần.

### Phụ kiện

Phụ kiện được gắn trực tiếp theo model máy. Admin nhập phụ kiện một lần, sau đó kỹ sư có thể chọn phụ kiện đó khi sửa chữa/bảo trì cho khách.

Thông tin phụ kiện gồm:

- **Model máy**: model áp dụng.
- **Mã phụ kiện**: hệ thống tự sinh, người dùng không cần sửa.
- **Tên phụ kiện**: ví dụ Kim hút mẫu, Đầu dò Convex, Cáp kết nối.
- **Số lượng tiêu chuẩn**: số lượng thường đi kèm hoặc thường dùng.
- **Cần nhập Serial Number**: chọn Có/Không.
- **Nhóm phụ kiện**: tùy chọn, dùng khi cần phân nhóm.
- **Trạng thái**: ACTIVE/INACTIVE.
- **Mô tả**: ghi chú thêm.

Ví dụ:

| Model | Phụ kiện | Số lượng tiêu chuẩn | Ghi chú |
| --- | --- | ---: | --- |
| CL-1000I | Kim hút mẫu | 1 | Phụ kiện thay thế |
| AUTOSPIRO-AS-407 | Dây nguồn y tế | 2 | Phụ kiện đi kèm |
| X-CUBE-70 | Đầu dò Convex | 2 | Dùng cho siêu âm |

## 9. Quản Lý Thiết Bị Và Máy Khách Đang Dùng

Menu: **Sản phẩm & Thiết bị** hoặc **Kho máy**

Thiết bị là từng máy cụ thể có serial number, mã máy và trạng thái quản lý.

Các trạng thái thường gặp:

- **IN_STOCK**: đang trong kho.
- **INSTALLED**: đã lắp đặt cho khách.
- **RESERVED**: đã giữ chỗ.
- **RETURNED**: đã trả về.
- **SOLD**: đã bán.
- **ACCESSORY_SPLIT**: tách phụ kiện.

Admin có thể:

- Tạo máy mới.
- Sửa thông tin máy.
- Gắn máy với khách hàng.
- Khai báo phụ kiện thực tế của máy.
- Theo dõi lịch sử kho.

Kỹ sư có thể:

- Xem máy liên quan đến khách hàng phụ trách.
- Mở nhanh phiếu sửa chữa/bảo trì từ máy.
- Xem phụ kiện và lịch sử công việc của máy.

## 10. Lắp Đặt

Phiếu lắp đặt dùng cho quy trình bàn giao máy cho khách hàng.

Thông tin thường có:

- Khách hàng nhận máy.
- Model/máy lắp đặt.
- Kỹ sư lắp đặt.
- Ngày lắp đặt.
- Địa chỉ lắp đặt.
- Đại diện tiếp nhận.
- Danh sách thiết bị và phụ kiện bàn giao.
- Ghi chú bảo hành.

Mã phiếu lắp đặt được hệ thống tự sinh theo dạng ngắn gọn, ví dụ:

`LD-110826-001`

Người dùng không cần tự nhập hoặc sửa mã phiếu.

## 11. Sửa Chữa

Phiếu sửa chữa dùng khi khách hàng báo lỗi máy hoặc cần kỹ thuật xử lý sự cố.

Quy trình gợi ý:

1. Tạo phiếu sửa chữa.
2. Chọn khách hàng và máy liên quan.
3. Nhập mô tả lỗi ban đầu.
4. Chọn mức ưu tiên.
5. Giao kỹ sư phụ trách.
6. Kỹ sư cập nhật nhật ký xử lý, checklist, vật tư/phụ kiện đã dùng.
7. Cập nhật trạng thái đến khi hoàn tất.

Các trạng thái thường gặp:

- **PENDING**: mới tạo/chờ xử lý.
- **ASSIGNED**: đã giao kỹ sư.
- **IN_PROGRESS**: đang xử lý.
- **WAITING_PARTS**: chờ linh kiện/phụ kiện.
- **COMPLETED**: hoàn tất.
- **CANCELLED**: hủy.

## 12. Bảo Trì

Phiếu bảo trì dùng cho công việc định kỳ, bảo hành, hợp đồng hoặc kiểm tra nội bộ.

Quy trình tương tự sửa chữa:

1. Tạo phiếu bảo trì.
2. Chọn khách hàng, máy và loại bảo trì.
3. Chọn lịch hẹn.
4. Giao kỹ sư.
5. Kỹ sư cập nhật checklist, nhật ký, kết quả và vật tư sử dụng.
6. Hoàn tất phiếu.

Các loại bảo trì thường gặp:

- **PERIODIC**: định kỳ.
- **WARRANTY**: bảo hành.
- **CONTRACT**: theo hợp đồng.
- **INTERNAL**: nội bộ.
- **OTHER**: khác.

## 13. Lịch Làm Việc

Menu: **Lịch làm việc**

Màn này dùng để xem lịch công việc theo ngày/tuần.

Kỹ sư nên kiểm tra lịch làm việc hằng ngày để biết:

- Công việc hôm nay.
- Công việc sắp đến hạn.
- Việc đang xử lý.
- Việc cần cập nhật báo cáo.

Admin dùng lịch làm việc để theo dõi tải công việc và điều phối kỹ sư.

## 14. Báo Cáo Và Thống Kê

### Báo cáo tổng hợp

Menu: **Báo cáo tổng hợp**

Dùng để xem tình hình công việc theo khoảng thời gian:

- Số lượng phiếu sửa chữa/bảo trì/lắp đặt.
- Công việc theo trạng thái.
- Công việc theo kỹ sư.
- Công việc theo khách hàng.
- Tổng quan vận hành phòng kỹ thuật.

### Phân tích kỹ thuật

Menu: **Phân tích kỹ thuật**

Dùng để xem các chỉ số phục vụ cải thiện kỹ thuật:

- Nhóm lỗi thường gặp.
- Máy/model phát sinh nhiều công việc.
- Công việc quá hạn.
- Xu hướng xử lý theo thời gian.

### Hiệu suất kỹ sư

Menu: **Hiệu suất kỹ sư**

Dùng để theo dõi:

- Số việc được giao.
- Số việc hoàn tất.
- Tỷ lệ hoàn tất.
- Công việc quá hạn hoặc chờ duyệt.
- Vật tư/phụ kiện sử dụng nếu có thống kê liên quan.

## 15. Chia Sẻ Kinh Nghiệm

Menu: **Chia sẻ kinh nghiệm**

Đây là kho kiến thức nội bộ của phòng kỹ thuật.

Có thể dùng để lưu:

- Cách xử lý lỗi thường gặp.
- Kinh nghiệm theo model máy.
- Checklist kiểm tra nhanh.
- Ghi chú cài đặt, vận hành, bảo trì.

Kỹ sư nên tìm trong kho kinh nghiệm trước khi xử lý các lỗi quen thuộc.

## 16. Hỗ Trợ App

Menu: **Hỗ trợ app**

Kỹ sư dùng màn này để gửi hoặc theo dõi các vấn đề liên quan đến ứng dụng, ví dụ:

- Lỗi thao tác.
- Cần bổ sung chức năng.
- Dữ liệu chưa đúng.
- Cần hỗ trợ nhập liệu hoặc xử lý phiếu.

Khi gửi hỗ trợ, nên mô tả rõ:

- Màn hình đang dùng.
- Công việc đang thao tác.
- Lỗi gặp phải.
- Ảnh chụp màn hình nếu có.

## 17. Quản Trị Nhân Sự, Vai Trò Và Khu Vực

Menu: **Nhân sự**, **Vai trò**, **Khu vực**

Chỉ Admin sử dụng các màn này.

### Nhân sự

Dùng để:

- Tạo tài khoản người dùng.
- Cập nhật thông tin nhân sự.
- Gán vai trò Admin/Manager/Engineer.
- Gán khu vực phụ trách.
- Khóa hoặc mở tài khoản.

### Vai trò

Dùng để quản lý nhóm quyền trong hệ thống.

Không nên tự ý sửa vai trò nếu chưa rõ ảnh hưởng, vì có thể làm người dùng mất quyền truy cập.

### Khu vực

Dùng để phân vùng dữ liệu theo địa bàn hoặc khu vực phụ trách.

## 18. Audit Log

Menu: **Audit log**

Audit log ghi lại lịch sử thay đổi dữ liệu quan trọng:

- Ai tạo dữ liệu.
- Ai sửa dữ liệu.
- Ai xóa dữ liệu.
- Thời điểm thao tác.
- Loại đối tượng bị thay đổi.

Admin dùng audit log để kiểm tra khi cần truy vết dữ liệu.

## 19. Nguyên Tắc Nhập Dữ Liệu

Để dữ liệu sạch và dễ tìm, nên thống nhất các nguyên tắc sau:

- Tên khách hàng nên nhập đầy đủ, đúng tên bệnh viện/phòng khám.
- Số điện thoại nhập liền mạch, hạn chế ký tự lạ.
- Model máy chọn từ danh sách có sẵn, không tự gõ sai tên model.
- Serial number nhập đúng tem máy.
- Mô tả lỗi nên ghi rõ hiện tượng, thời điểm xảy ra và phòng/khoa sử dụng.
- Kết quả xử lý nên ghi rõ đã làm gì, còn tồn tại gì, có cần theo dõi không.
- Khi dùng phụ kiện/vật tư, chọn từ danh sách nếu có để dữ liệu báo cáo chuẩn hơn.

## 20. Các Mã Tự Sinh

Hệ thống tự sinh các mã quan trọng để tránh nhập sai:

- Mã phiếu lắp đặt.
- Mã phiếu sửa chữa.
- Mã phiếu bảo trì.
- Mã máy.
- Mã phụ kiện.

Ví dụ:

- Phiếu lắp đặt: `LD-110826-001`
- Phiếu sửa chữa: `SC-110826-001`
- Phiếu bảo trì: `BT-110826-001`
- Mã máy theo model: `CL-1000I-001`
- Mã phụ kiện theo model: `CL-1000I-PK-001`

Các mã này thường bị khóa trên giao diện, người dùng không cần sửa.

## 21. Quy Trình Đề Xuất Hằng Ngày

### Kỹ sư

1. Đăng nhập đầu ngày.
2. Vào **Việc của tôi** để xem việc được giao.
3. Kiểm tra **Lịch làm việc**.
4. Mở từng phiếu cần xử lý.
5. Ghi nhật ký, checklist, vật tư/phụ kiện đã dùng.
6. Cập nhật trạng thái phiếu.
7. Cuối ngày kiểm tra lại các phiếu chưa hoàn tất.

### Admin

1. Vào **Tổng quan** để xem tình hình chung.
2. Kiểm tra công việc mới/chờ điều phối.
3. Giao kỹ sư cho các phiếu cần xử lý.
4. Theo dõi công việc quá hạn hoặc chờ phụ kiện.
5. Kiểm tra báo cáo tổng hợp.
6. Cập nhật dữ liệu nền nếu có model/phụ kiện/khách hàng mới.

### Quản lý

1. Xem **Tổng quan**.
2. Kiểm tra **Báo cáo tổng hợp**.
3. Theo dõi tiến độ theo khách hàng/kỹ sư.
4. Phối hợp Admin xử lý các công việc tồn đọng.

## 22. Lỗi Thường Gặp Và Cách Xử Lý

### Không thấy menu cần dùng

Nguyên nhân thường gặp:

- Tài khoản chưa được cấp đúng vai trò.
- Chức năng đó chỉ dành cho Admin hoặc Quản lý.

Cách xử lý:

- Liên hệ Admin để kiểm tra quyền tài khoản.

### Không tìm thấy khách hàng hoặc máy

Cách xử lý:

- Thử tìm bằng tên ngắn hơn.
- Tìm bằng mã khách hàng, serial number hoặc mã máy.
- Kiểm tra xem dữ liệu đã được tạo chưa.
- Nếu là kỹ sư, kiểm tra khách hàng/máy có thuộc phạm vi phụ trách không.

### Không thấy phụ kiện khi cập nhật công việc

Nguyên nhân thường gặp:

- Model máy chưa có phụ kiện được khai báo.
- Máy chưa gắn đúng model.
- Phụ kiện đang ở trạng thái INACTIVE.

Cách xử lý:

- Admin vào **Phụ kiện** để kiểm tra phụ kiện theo model.
- Kiểm tra model của máy trong hồ sơ thiết bị.

### Lưu phiếu không được

Cách xử lý:

- Kiểm tra các trường bắt buộc.
- Kiểm tra định dạng ngày tháng.
- Kiểm tra dữ liệu chọn từ danh sách có còn hợp lệ không.
- Nếu vẫn lỗi, chụp màn hình và gửi qua **Hỗ trợ app** hoặc báo Admin.

## 23. Khuyến Nghị Khi Triển Khai Cho Phòng Kỹ Thuật

Trước khi cho nhiều người dùng cùng lúc, nên chuẩn bị:

- Danh sách tài khoản kỹ sư.
- Danh sách khách hàng đang quản lý.
- Danh sách model máy chuẩn.
- Danh sách phụ kiện theo từng model.
- Quy ước trạng thái phiếu.
- Quy định ai được tạo phiếu, ai được duyệt, ai được đóng phiếu.

Nên hướng dẫn kỹ sư nhập nhật ký xử lý và vật tư/phụ kiện ngay trong ngày để dữ liệu báo cáo chính xác.

## 24. Checklist Nhanh Cho Người Mới

- Đăng nhập được vào hệ thống.
- Biết menu nào mình được dùng.
- Tìm được khách hàng phụ trách.
- Mở được hồ sơ khách hàng.
- Xem được máy và lịch sử công việc.
- Mở được phiếu được giao.
- Cập nhật được nhật ký xử lý.
- Chọn được phụ kiện/vật tư đã dùng.
- Lưu được trạng thái công việc.
- Biết gửi hỗ trợ khi gặp lỗi.

