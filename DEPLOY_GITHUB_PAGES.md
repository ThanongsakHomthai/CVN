# 🚀 คำแนะนำการ Deploy บน GitHub Pages

## ✅ สิ่งที่เตรียมไว้แล้ว

1. ✅ **GitHub Actions Workflow** (`.github/workflows/deploy.yml`)
   - Auto-deploy เมื่อ push code ไปยัง branch `main`
   - Build และ deploy อัตโนมัติ

2. ✅ **Vite Config** - รองรับ base path สำหรับ GitHub Pages
3. ✅ **React Router** - รองรับ basename สำหรับ GitHub Pages

## 📋 ขั้นตอนการ Deploy

### 1. เปิดใช้งาน GitHub Pages

1. ไปที่ repository บน GitHub
2. คลิก **Settings** → **Pages** (ในเมนูซ้าย)
3. ใต้ **Source**:
   - เลือก **"GitHub Actions"** แทน "Deploy from a branch"
4. บันทึกการตั้งค่า

### 2. Push Code ขึ้น GitHub

```bash
# เพิ่ม remote (ถ้ายังไม่ได้ทำ)
git remote add origin https://github.com/username/demo-vn-control.git

# เปลี่ยน branch เป็น main (ถ้าใช้ master)
git branch -M main

# Push code
git push -u origin main
```

### 3. ตรวจสอบ GitHub Actions

1. ไปที่ repository → คลิกแท็บ **Actions**
2. ควรเห็น workflow "Deploy to GitHub Pages" กำลังทำงาน
3. รอให้ workflow เสร็จ (ประมาณ 2-3 นาที)
4. เมื่อเสร็จแล้ว จะมี ✅ เขียวแสดง

### 4. เข้าถึงเว็บไซต์

หลังจาก deploy สำเร็จ:
- URL จะเป็น: `https://username.github.io/demo-vn-control/`
- หรือ `https://username.github.io/repository-name/` (ตามชื่อ repository)

## ⚙️ การตั้งค่า Base Path

### ถ้า Repository ชื่อ "demo-vn-control"

URL จะเป็น: `https://username.github.io/demo-vn-control/`

ไฟล์ `.github/workflows/deploy.yml` จะตั้งค่า base path อัตโนมัติตามชื่อ repository

### ถ้าต้องการใช้ Root Domain (Custom Domain)

1. ไปที่ repository → **Settings** → **Pages**
2. ใส่ **Custom domain** (เช่น: `yourdomain.com`)
3. แก้ไข `.github/workflows/deploy.yml`:
   ```yaml
   VITE_BASE_PATH: /
   ```

## 🔄 การอัปเดตเว็บไซต์

เมื่อแก้ไขโค้ดและ push ขึ้น GitHub:

```bash
git add .
git commit -m "อัปเดตฟีเจอร์..."
git push
```

GitHub Actions จะ build และ deploy อัตโนมัติ (ใช้เวลาประมาณ 2-3 นาที)

## ⚠️ ข้อจำกัดของ GitHub Pages

1. **Static Files Only** - GitHub Pages รองรับเฉพาะ static files
   - ✅ Frontend (React) ทำงานได้
   - ❌ Backend API (`proxy-server.js`) **ไม่ทำงาน** บน GitHub Pages

2. **Backend API ต้อง Deploy แยก**
   - ใช้บริการอื่น เช่น:
     - **Vercel** (รองรับ serverless functions)
     - **Railway**
     - **Render**
     - **Heroku**
     - **DigitalOcean App Platform**

## 🔧 แก้ไขปัญหา

### ถ้าเว็บไซต์ไม่แสดงผล

1. ตรวจสอบ GitHub Actions → ดูว่ามี error หรือไม่
2. ตรวจสอบ base path ใน URL
3. ตรวจสอบ console ใน browser (F12) → ดู error messages

### ถ้า Routes ไม่ทำงาน

- ตรวจสอบว่า `basename` ใน `App.jsx` ถูกต้อง
- ตรวจสอบ `VITE_BASE_PATH` ใน workflow file

## 📝 หมายเหตุ

- **Development**: ใช้ `npm run dev` (base path = `/`)
- **Production (GitHub Pages)**: base path = `/repository-name/`
- **Custom Domain**: base path = `/`

## 🎯 สรุป

1. ✅ Push code ขึ้น GitHub
2. ✅ เปิดใช้งาน GitHub Pages → เลือก "GitHub Actions"
3. ✅ รอ GitHub Actions deploy (2-3 นาที)
4. ✅ เข้าถึงเว็บไซต์ที่ `https://username.github.io/repository-name/`

---

**หมายเหตุ**: Backend API (`proxy-server.js`) ต้อง deploy แยกบนบริการอื่น เพราะ GitHub Pages รองรับเฉพาะ static files

