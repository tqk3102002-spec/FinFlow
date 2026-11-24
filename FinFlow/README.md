# FinFlow — Quản lý Tài sản & Thu Chi

Ứng dụng React + Vite + Express, đăng nhập/đồng bộ qua Firebase (dự án `finflow-management`).

## Chạy local
```
npm install
npm run dev        # http://localhost:3000
```

## Chuẩn bị Firebase (làm một lần)
1. Firebase Console → Authentication → bật **Google** và **Email/Password**.
2. Authentication → Settings → Authorized domains: thêm domain deploy.
3. Tạo Firestore Database `(default)`.
4. Deploy rules: `npm run deploy:rules` (cần `firebase login`).

## Deploy (cần server Node, không dùng Hosting tĩnh)
```
npm run build
npm start          # đặt NODE_ENV=production và PORT nếu cần
```
Hoặc Docker / Cloud Run:
```
docker build -t finflow .
docker run -p 8080:8080 -v finflow-data:/data finflow
```
Cloud Run: `gcloud run deploy finflow --source . --region asia-southeast1 --allow-unauthenticated`

## Biến môi trường
- `PORT` (mặc định 3000; Docker: 8080)
- `NODE_ENV=production`
- `DATA_DIR`: thư mục lưu dữ liệu tài khoản Email/Mật khẩu của server (Docker: `/data`). **Phải gắn ổ đĩa lưu trữ lâu dài**, nếu không dữ liệu mất khi khởi động lại.
