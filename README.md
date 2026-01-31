# Voice Call

Ứng dụng gọi thoại P2P sử dụng WebRTC, với signaling qua Socket.IO.

## Công nghệ

- **Backend:** Node.js, Express, Socket.IO (signaling server)
- **Frontend:** Vue 3, Vue Router, Pinia, Vite
- **Gọi thoại:** WebRTC (chỉ audio)

## Cấu trúc

```
voice-call/
├── backend/          # Signaling server (Express + Socket.IO)
│   ├── package.json
│   └── server.js
├── frontend/         # Vue 3 SPA
│   ├── src/
│   │   ├── views/    # Home, Call
│   │   ├── stores/   # Pinia (callStore)
│   │   ├── router/
│   │   ├── composables/  # useWebRTC
│   │   └── ...
│   └── ...
└── README.md
```

## Biến môi trường

Không hardcode cấu hình; dùng file `.env` (copy từ `.env.example`).

**Backend** (`backend/.env`):

- `PORT` – cổng server (mặc định 3000)
- `CORS_ORIGIN` – origin CORS (`*` hoặc URL cụ thể)
- `SOCKET_PING_TIMEOUT`, `SOCKET_PING_INTERVAL` – tùy chọn Socket.IO

**Frontend** (`frontend/.env`):

- `VITE_SOCKET_URL` – URL backend Socket.IO (để trống = cùng origin khi dev/build chung backend)
- `VITE_DEV_SERVER_PORT` – cổng Vite dev (mặc định 5173)
- `VITE_DEV_PROXY_TARGET` – proxy `/socket.io` khi dev (mặc định http://localhost:3000)

```bash
# Tạo .env từ mẫu
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Chạy ứng dụng

### 1. Backend (bắt buộc chạy trước)

```bash
cd backend
npm install
cp .env.example .env   # chỉnh nếu cần
npm run dev
```

Server chạy tại: **http://localhost:3000** (hoặc theo `PORT` trong `.env`).

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # chỉnh nếu cần
npm run dev
```

Ứng dụng mở tại: **http://localhost:5173** (hoặc theo `VITE_DEV_SERVER_PORT`). Proxy `/socket.io` dùng `VITE_DEV_PROXY_TARGET`.

### 3. Cách dùng

1. Mở **http://localhost:5173** trên hai tab (hoặc hai trình duyệt / hai máy).
2. Nhập **cùng mã phòng** (vd: `room1`) và tên mỗi bên.
3. Bấm **Vào phòng**.
4. Cho phép microphone khi trình duyệt hỏi.
5. Hai bên sẽ nghe được giọng nhau qua WebRTC (P2P).

Có thể **Tắt mic** / **Bật mic** và **Kết thúc** để rời phòng.

## Lưu ý

- Cần **HTTPS** hoặc **localhost** để `getUserMedia` (microphone) hoạt động.
- Nếu gọi giữa hai máy khác mạng, có thể cần TURN server (hiện chỉ dùng STUN của Google).
- Backend chỉ làm signaling (offer/answer/ICE), không chuyển tiếp âm thanh.
