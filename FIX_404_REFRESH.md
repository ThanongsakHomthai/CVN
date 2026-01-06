# แก้ไขปัญหา 404 เมื่อ Refresh หน้าเว็บ

## สาเหตุของปัญหา

เมื่อ refresh หน้าเว็บบน GitHub Pages จะเกิด 404 เพราะ:
- GitHub Pages จะหาไฟล์ตาม path ที่ระบุใน URL
- แต่ React Router ใช้ client-side routing ซึ่งไม่มีไฟล์จริงๆ อยู่ที่ path นั้น
- เช่น ถ้า URL เป็น `/manual` GitHub Pages จะหาไฟล์ `/manual/index.html` แต่ไม่มี

## วิธีแก้ไข

### 1. ใช้ 404.html Redirect

สร้างไฟล์ `public/404.html` ที่จะ redirect กลับไปที่ `index.html` โดยเก็บ path ไว้ใน query parameter

### 2. React Router จัดการ Redirect

เพิ่ม component `GitHubPagesRedirect` ใน `App.jsx` ที่จะอ่าน query parameter และ navigate ไปที่ path ที่ถูกต้อง

## ไฟล์ที่แก้ไข

1. **`public/404.html`** - Redirect 404 ไปที่ index.html พร้อม query parameter
2. **`src/App.jsx`** - เพิ่ม `GitHubPagesRedirect` component เพื่อจัดการ redirect

## วิธีทดสอบ

### ทดสอบใน Local

1. Build โปรเจค:
   ```bash
   npm run build
   ```

2. Preview build:
   ```bash
   npm run preview
   ```

3. เปิด browser ไปที่ `http://localhost:4173/manual`
4. Refresh หน้าเว็บ (F5)
5. ควรจะไม่เกิด 404 และแสดงหน้า Manual & Operate

### ทดสอบบน GitHub Pages

1. Push โค้ดไปที่ GitHub:
   ```bash
   git add .
   git commit -m "Fix 404 refresh issue"
   git push
   ```

2. รอให้ GitHub Actions build และ deploy เสร็จ

3. เปิดเว็บไซต์บน GitHub Pages

4. ไปที่หน้าใดๆ เช่น `/manual`, `/monitor`, `/logs`

5. Refresh หน้าเว็บ (F5)

6. ควรจะไม่เกิด 404 และแสดงหน้าปกติ

## หมายเหตุ

- ไฟล์ `404.html` จะถูก copy ไปที่ `dist/404.html` อัตโนมัติเมื่อ build
- GitHub Pages จะใช้ `404.html` โดยอัตโนมัติเมื่อมีไฟล์นี้อยู่ใน root directory
- ถ้ายังเกิด 404 หลังจากแก้ไข ให้ตรวจสอบว่า:
  - ไฟล์ `404.html` อยู่ใน `public/` directory
  - GitHub Actions build สำเร็จ
  - ไฟล์ `404.html` ถูก copy ไปที่ `dist/` เมื่อ build

