# MA · VietMed Kỹ Thuật Mobile

## Kết nối API

App gọi chung NestJS API và database hiện có của Web. Sao chép `.env.example` thành `.env` rồi đặt `EXPO_PUBLIC_API_BASE_URL`:

- iOS Simulator: `http://localhost:3000/api`
- Android Emulator: `http://10.0.2.2:3000/api`
- Thiết bị thật: `http://<IP-LAN-của-máy-chạy-BE>:3000/api`
- Staging/production: URL HTTPS của BE, có `/api`

Máy chạy BE cần cho phép kết nối LAN và firewall mở port API. Sau khi đổi env, khởi động Metro với `npx expo start --clear`.

## Auth trên app

App gọi `POST /api/auth/mobile-login`; token được lưu trong iOS Keychain/Android Keystore qua `expo-secure-store`. Axios interceptor tự thêm `Authorization: Bearer ...`; 401 xóa token và đưa người dùng về đăng nhập. Web tiếp tục dùng `POST /api/auth/login` với HttpOnly cookie.

## Chạy app

```bash
npx expo start
```

Expo Go không yêu cầu đăng nhập Expo để chạy trên cùng mạng; nếu cần cài dev build thì dùng tài khoản Expo của dự án.
