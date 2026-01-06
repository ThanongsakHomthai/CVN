# 🔧 แก้ไขปัญหา GitHub Pages Deployment

## ❌ ปัญหาที่พบบ่อย

### 1. Workflow Fail - "Pages build and deployment"

**สาเหตุที่เป็นไปได้:**
- GitHub Pages ยังไม่ได้เปิดใช้งาน
- Permissions ไม่เพียงพอ
- Build error

**วิธีแก้ไข:**

#### ขั้นตอนที่ 1: เปิดใช้งาน GitHub Pages
1. ไปที่ repository → **Settings** → **Pages**
2. ใต้ **Source**: เลือก **"GitHub Actions"** (ไม่ใช่ "Deploy from a branch")
3. บันทึกการตั้งค่า

#### ขั้นตอนที่ 2: ตรวจสอบ Permissions
1. ไปที่ repository → **Settings** → **Actions** → **General**
2. ใต้ **Workflow permissions**:
   - เลือก **"Read and write permissions"**
   - Check ✅ **"Allow GitHub Actions to create and approve pull requests"**
3. บันทึกการตั้งค่า

#### ขั้นตอนที่ 3: Re-run Workflow
1. ไปที่ **Actions** tab
2. คลิก workflow run ที่ fail
3. คลิก **"Re-run all jobs"** หรือ **"Re-run failed jobs"**

### 2. Build Error - "npm ci failed"

**สาเหตุ:**
- `package-lock.json` ไม่ sync กับ `package.json`
- Dependencies มีปัญหา

**วิธีแก้ไข:**
```bash
# ใน local
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
git push
```

### 3. 404 Error เมื่อเข้าถึงเว็บไซต์

**สาเหตุ:**
- Base path ไม่ถูกต้อง
- React Router ไม่ได้ตั้งค่า basename

**วิธีแก้ไข:**
- ตรวจสอบว่า `src/App.jsx` มี `basename={basename}` ใน BrowserRouter
- ตรวจสอบว่า `vite.config.js` ตั้งค่า base path ถูกต้อง

### 4. Routes ไม่ทำงาน (404 เมื่อ refresh)

**สาเหตุ:**
- GitHub Pages ไม่รองรับ client-side routing โดยตรง

**วิธีแก้ไข:**
สร้างไฟล์ `404.html` ใน public folder เพื่อ redirect กลับไปที่ index.html

