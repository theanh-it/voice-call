# Khả năng chịu tải và mở rộng (server hiện tại)

Phân tích dựa trên cấu trúc backend hiện tại: **một process Node.js**, **Express + Socket.IO**, **lưu phòng trong RAM (Map)**.

---

## 1. Server hiện tại làm gì?

- **Không** chuyển tiếp âm thanh/video. WebRTC truyền media **P2P** (trực tiếp giữa các trình duyệt).
- Server chỉ làm **signaling**: nhận/gửi các event như `join-room`, `offer`, `answer`, `ice-candidate`, `reaction`, `mic-state`, `user-left`.
- Mỗi event là **tin nhắn nhỏ** (vài KB, chủ yếu text/JSON). Tần suất: cao lúc join + thiết lập WebRTC, sau đó thấp (reaction, mic-state thỉnh thoảng).

→ Server chủ yếu **I/O (mạng)**, ít tốn CPU. Giới hạn thường là **số kết nối** và **RAM**, không phải băng thông media.

---

## 2. Tài nguyên tiêu thụ (ước lượng)

| Tài nguyên          | Mức dùng                             | Ghi chú                                                                                                                         |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **CPU**             | Thấp                                 | Xử lý event Socket.IO + Express; không encode/decode media. Một core là đủ cho hàng nghìn connection nếu message rate vừa phải. |
| **RAM**             | ~ vài KB mỗi socket + metadata phòng | Mỗi socket: buffer Socket.IO + object trong `rooms` Map. 10k socket có thể ~100–200 MB (tùy Node/OS).                           |
| **Mạng**            | Rất thấp                             | Chỉ signaling: vài KB/s cho mỗi phòng khi ổn định; cao hơn lúc join (offer/answer/ICE).                                         |
| **File descriptor** | 1 socket = 1 fd                      | OS giới hạn số fd (vd: `ulimit -n` 1024–65535). Nhiều connection cần tăng limit.                                                |

---

## 3. Giới hạn với cấu trúc hiện tại

### 3.1. Một process, một máy

- **Một instance Node.js** = dùng **một nhân CPU** cho event loop.
- **Rooms lưu trong `Map` (RAM)** → không chia sẻ state giữa nhiều process/máy.
- **Không dùng Redis/DB** → không chạy nhiều instance cùng lúc mà vẫn “thấy” chung phòng.

### 3.2. Số kết nối đồng thời (ước lượng)

- **Cùng lúc 1k–5k connection** trên một máy 2–4 GB RAM thường ổn nếu:
  - Message rate vừa phải (như app hiện tại: join, offer/answer/ICE, thỉnh thoảng reaction/mic-state).
  - Không có logic blocking (đồng bộ, vòng lặp nặng).
- **5k–20k+ connection** có thể đạt được trên máy mạnh hơn (RAM 8 GB+, tăng `ulimit`), nhưng cần đo thực tế (stress test).
- **Giới hạn cứng**: số file descriptor (`ulimit -n`), RAM, và khả năng Socket.IO/Node trên từng phiên bản.

### 3.3. Số phòng và số người/phòng

- **Số phòng**: Chỉ bị giới hạn bởi RAM (mỗi phòng vài trăm byte metadata).
- **Số người mỗi phòng**: Về signaling thì server chỉ gửi event tới đúng socket trong room. WebRTC P2P thường **N–1** kết nối mỗi user (N = số người). Ví dụ 8 người/phòng: mỗi client giữ 7 peer connection; server vẫn chỉ xử lý event cho 8 socket trong room → server chịu được, nhưng **client và mạng** sẽ là nút thắt trước (CPU/mạng trên trình duyệt, NAT/firewall).

---

## 4. Các nút thắt chính

| Nút thắt             | Mô tả                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Một process**      | Chỉ dùng một core; không tận dụng đa nhân trên một máy.                                                      |
| **State trong RAM**  | Restart = mất hết phòng; không chạy nhiều instance “cùng một hệ thống phòng” mà không thêm thành phần ngoài. |
| **Không rate limit** | Một client gửi rất nhiều event (join, reaction…) có thể làm event loop bận hoặc tốn tài nguyên.              |
| **Giới hạn OS**      | `ulimit` (số fd), số process, bộ nhớ ảo.                                                                     |

---

## 5. Server “chịu tải” như thế nào? (tóm tắt)

- **Quy mô nhỏ / vừa (vài trăm đến vài nghìn user đồng thời, vài trăm phòng)**  
  Một máy, một process như hiện tại **có thể đủ**, nếu:

  - RAM đủ (vd: 2–4 GB cho vài nghìn socket),
  - Tăng `ulimit -n` (vd: 65535),
  - Đặt CORS/origin đúng, bật HTTPS khi production.

- **Quy mô lớn hơn (nhiều nghìn connection, nhiều phòng, cần sẵn sàng mở rộng)**  
  Cần thay đổi kiến trúc:
  - **Nhiều instance** + **Redis adapter** cho Socket.IO (đồng bộ room/event giữa các instance).
  - **Cluster** (vd: `cluster` module) để dùng nhiều core trên một máy (vẫn cần Redis hoặc cơ chế chia sẻ state nếu muốn scale ngang nhiều máy).
  - Rate limiting, health check, logging để vận hành ổn định.

---

## 6. Cách kiểm tra thực tế

- Dùng công cụ **load test** cho WebSocket/Socket.IO (vd: `socket.io-client` + script tạo nhiều connection, join phòng, gửi offer/answer/ICE giả lập).
- Đo trên máy thật hoặc máy gần giống production: số connection tối đa, RAM, CPU, số message/giây trước khi latency tăng hoặc lỗi.
- Kiểm tra **giới hạn fd**: `ulimit -n`; nếu cần, tăng trong systemd hoặc môi trường chạy server.

---

## 7. Kết luận ngắn gọn

| Câu hỏi                                  | Trả lời                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Server có chuyển media không?            | Không. Chỉ signaling; media đi P2P.                                                                   |
| Giới hạn chính?                          | Một process, state trong RAM, số fd và RAM.                                                           |
| Cùng lúc khoảng bao nhiêu user thì “ổn”? | Cỡ **1k–5k** connection trên một máy 2–4 GB RAM là mức tham khảo; cần stress test để có số cụ thể.    |
| Muốn chịu tải cao hơn / nhiều máy?       | Thêm **Redis adapter** Socket.IO + chạy **nhiều instance**, có **rate limiting** và **health check**. |

Nếu bạn có mục tiêu cụ thể (vd: “cần 10k user đồng thời” hoặc “chạy 2 instance phía sau load balancer”), có thể triển khai từng bước: trước hết stress test một instance, sau đó thêm Redis + nhiều instance khi cần.
