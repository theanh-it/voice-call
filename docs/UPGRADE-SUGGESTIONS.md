# Đề xuất nâng cấp dự án Voice Call

Tài liệu gợi ý các hướng nâng cấp theo từng nhóm: bảo mật, trải nghiệm, tính năng, kỹ thuật và vận hành.

---

## 1. Bảo mật & ổn định

| Đề xuất            | Mô tả                                                                                                                                                                            | Độ ưu tiên |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Rate limiting**  | Giới hạn số lần join phòng / gửi reaction theo IP hoặc socket (tránh spam, brute-force mật khẩu). Có thể dùng `express-rate-limit` cho HTTP và middleware tự viết cho Socket.IO. | Cao        |
| **Validate input** | Giới hạn độ dài và ký tự cho `roomId`, `userName` (vd: 3–32 ký tự, chỉ chữ/số/gạch ngang). Tránh roomId quá dài hoặc ký tự đặc biệt.                                             | Cao        |
| **Mật khẩu phòng** | Cân nhắc dùng **bcrypt** hoặc **argon2** thay cho SHA-256 để hash mật khẩu (chống brute-force tốt hơn).                                                                          | Trung bình |
| **HTTPS**          | Production bắt buộc HTTPS để `getUserMedia` và WebSocket hoạt động ổn định.                                                                                                      | Cao        |

---

## 2. Trải nghiệm người dùng (UX)

| Đề xuất                            | Mô tả                                                                                                                                                                               | Độ ưu tiên |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Tự join lại phòng khi mất mạng** | Khi Socket.IO reconnect, tự gửi lại `join-room` (roomId, userName, options) để vào lại phòng thay vì bắt user refresh. Lưu roomId/userName/options trong store hoặc sessionStorage. | Cao        |
| **Thông báo khi có người vào/ra**  | Toast hoặc sound ngắn khi `user-joined` / `user-left` (vd: "A đã vào phòng", "B đã rời đi").                                                                                        | Trung bình |
| **Copy mã phòng / Share link**     | Nút "Sao chép mã phòng" và "Chia sẻ link" (vd: `https://yourapp.com/#/call/room123`) để mời người khác nhanh.                                                                       | Trung bình |
| **Lịch sử phòng gần đây**          | Lưu vài phòng gần nhất (roomId, có thể cả type) vào localStorage, hiển thị gợi ý khi nhập mã phòng.                                                                                 | Thấp       |
| **Trạng thái kết nối rõ ràng**     | Khi đang reconnect: hiển thị "Đang kết nối lại..." và disable nút gửi reaction / tắt mic tạm thời nếu cần.                                                                          | Trung bình |

---

## 3. Tính năng mới

| Đề xuất                            | Mô tả                                                                                                                                                                | Độ ưu tiên |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Voice Activity Detection (VAD)** | Dùng Web Audio API (AnalyserNode) hoặc thư viện để phát hiện khi user thật sự đang nói → nhấp nháy / badge "Đang nói" chính xác hơn (thay vì chỉ dựa vào có stream). | Trung bình |
| **Video call (tùy chọn)**          | Thêm toggle "Bật camera"; dùng `getUserMedia({ video: true })` và thêm video track vào RTCPeerConnection; hiển thị `<video>` thay vì chỉ avatar.                     | Trung bình |
| **Chat text trong phòng**          | Socket event `chat-message`; lưu tin nhắn trong room (in-memory hoặc Redis); UI danh sách tin nhắn + ô nhập.                                                         | Trung bình |
| **Giới hạn số người trong phòng**  | Backend: khi join, kiểm tra `room.socketIds.size < MAX_PARTICIPANTS` (vd: 8); nếu đủ thì emit `join-error` "Phòng đã đầy".                                           | Trung bình |
| **Ghi âm cuộc gọi**                | Client-side: MediaRecorder ghi `MediaStream` (local + remote mix). Cần xử lý pháp lý (thông báo, đồng ý) và lưu file.                                                | Thấp       |

---

## 4. Kỹ thuật & chất lượng code

| Đề xuất                 | Mô tả                                                                                                                     | Độ ưu tiên |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **TypeScript**          | Chuyển backend và/hoặc frontend sang TypeScript: type-safe, refactor an toàn hơn, IDE hỗ trợ tốt hơn.                     | Trung bình |
| **Tách module backend** | Tách `server.js` thành: `routes/`, `socket/handlers/`, `services/roomService.js`, config – dễ test và mở rộng.            | Trung bình |
| **Unit test**           | Vitest (frontend) và Node test runner hoặc Jest (backend) cho logic quan trọng: hash password, validate room, join logic. | Trung bình |
| **E2E test**            | Playwright/Cypress: flow vào phòng → thấy nhau trong danh sách → kết thúc. Chạy với backend + frontend local.             | Thấp       |
| **Logging có cấu trúc** | Dùng pino hoặc winston; log JSON với level, timestamp, roomId, socketId – dễ đẩy lên CloudWatch/Datadog sau này.          | Thấp       |
| **Health check**        | Endpoint `GET /health` trả về 200 + { status, uptime }; dùng cho load balancer hoặc monitoring.                           | Trung bình |

---

## 5. WebRTC & mạng

| Đề xuất         | Mô tả                                                                                                                                                            | Độ ưu tiên                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **TURN server** | Khi P2P thất bại (NAT/firewall), cần TURN để relay. Có thể dùng Coturn (self-host) hoặc dịch vụ (Twilio, Xirsys). Thêm `iceServers` với TURN vào `useWebRTC.js`. | Cao (nếu deploy thật, nhiều mạng khác nhau) |
| **ICE restart** | Khi mạng thay đổi (chuyển WiFi ↔ 4G), hỗ trợ ICE restart để thiết lập lại kết nối thay vì chỉ thông báo lỗi.                                                     | Thấp                                        |

---

## 6. Scale & vận hành

| Đề xuất                         | Mô tả                                                                                                       | Độ ưu tiên            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------- |
| **Redis adapter cho Socket.IO** | Khi chạy nhiều instance backend, dùng `@socket.io/redis-adapter` để đồng bộ room và event giữa các process. | Cao (khi scale ngang) |
| **Graceful shutdown**           | Backend: lắng nghe SIGTERM/SIGINT; ngừng nhận connection mới, đợi socket hiện tại xử lý xong rồi exit.      | Trung bình            |
| **Docker / docker-compose**     | Dockerfile cho backend (và frontend build); docker-compose để chạy một lệnh cả app + (nếu có) Redis.        | Trung bình            |
| **Monitoring**                  | PM2 cho Node; Sentry cho lỗi frontend/backend; metric cơ bản (số room, số socket).                          | Thấp                  |

---

## Thứ tự gợi ý triển khai

1. **Nhanh, ít thay đổi:** Validate input (roomId, userName), rate limiting cơ bản, health check, copy/share mã phòng.
2. **Trải nghiệm:** Tự join lại phòng khi reconnect, thông báo vào/ra phòng.
3. **Bảo mật hơn:** Bcrypt/argon2 cho mật khẩu phòng, HTTPS trong production.
4. **Scale sau này:** Redis adapter Socket.IO, TURN server khi cần hỗ trợ nhiều loại mạng.
5. **Tùy nhu cầu:** VAD, video call, chat text, TypeScript, test, Docker.

Nếu bạn muốn ưu tiên một nhóm (vd: chỉ UX, hoặc chỉ bảo mật), có thể bắt đầu từ các mục "Cao" trong nhóm đó rồi mở rộng dần.
