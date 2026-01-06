# 📝 คู่มือการอัพเดทโค้ดบน GitHub และ GitHub Pages

## 🔄 ขั้นตอนการอัพเดทเมื่อมีการแก้ไขโค้ด

### 1. ตรวจสอบการเปลี่ยนแปลง

```bash
# ดูไฟล์ที่ถูกแก้ไข
git status

# ดูรายละเอียดการเปลี่ยนแปลง
git diff
```

### 2. เพิ่มไฟล์ที่แก้ไข

```bash
# เพิ่มไฟล์ทั้งหมดที่แก้ไข
git add .

# หรือเพิ่มไฟล์เฉพาะ
git add src/pages/Monitor.jsx
git add src/components/monitor/DateNode.jsx
```

### 3. สร้าง Commit

```bash
# สร้าง commit พร้อมข้อความอธิบาย
git commit -m "Fix 404 refresh issue for GitHub Pages"

# หรือข้อความภาษาไทย
git commit -m "แก้ไขปัญหา 404 เมื่อ refresh หน้าเว็บ"
```

**ตัวอย่างข้อความ Commit ที่ดี:**
- `"Add Date Node to Monitor page"`
- `"Fix counter node reset button"`
- `"Update login page design"`
- `"Implement role-based access control"`
- `"Fix 404 refresh issue"`

### 4. Push ขึ้น GitHub

```bash
# Push ไปยัง branch main
git push

# หรือระบุ branch และ remote
git push origin main
```

### 5. ตรวจสอบ GitHub Actions

1. ไปที่ repository บน GitHub
2. คลิกแท็บ **Actions**
3. ควรเห็น workflow "Deploy to GitHub Pages" กำลังทำงาน
4. รอให้ workflow เสร็จ (ประมาณ 2-3 นาที)
5. เมื่อเสร็จแล้ว จะมี ✅ เขียวแสดง

### 6. ตรวจสอบเว็บไซต์

หลังจาก deploy สำเร็จ:
- เปิดเว็บไซต์บน GitHub Pages
- ทดสอบฟีเจอร์ที่แก้ไข
- ตรวจสอบ console (F12) ว่ามี error หรือไม่

---

## 🚀 Workflow แบบเต็ม (Quick Reference)

```bash
# 1. ตรวจสอบสถานะ
git status

# 2. เพิ่มไฟล์
git add .

# 3. Commit
git commit -m "คำอธิบายการเปลี่ยนแปลง"

# 4. Push
git push

# 5. รอ GitHub Actions deploy (2-3 นาที)
# 6. ตรวจสอบเว็บไซต์
```

---

## 📋 ตัวอย่างการใช้งาน

### ตัวอย่างที่ 1: แก้ไข Date Node

```bash
git add src/components/monitor/DateNode.jsx
git add src/components/monitor/MonitorNodeConfigModal.jsx
git commit -m "Update Date Node font size configuration"
git push
```

### ตัวอย่างที่ 2: แก้ไขหลายไฟล์

```bash
git add src/pages/Monitor.jsx
git add src/components/monitor/MonitorNodes.jsx
git add src/styles/Monitor.css
git commit -m "Fix counter node and update monitor page styling"
git push
```

### ตัวอย่างที่ 3: แก้ไขปัญหา 404

```bash
git add public/404.html
git add src/App.jsx
git commit -m "Fix 404 refresh issue for GitHub Pages"
git push
```

---

## ⚠️ ข้อควรระวัง

### 1. อย่า Commit ไฟล์ที่ไม่จำเป็น

ตรวจสอบก่อน commit:
```bash
git status
```

ไฟล์ที่ควร ignore:
- `node_modules/`
- `.env` (credentials)
- `dist/` (build files)
- `.vite/` (cache)

### 2. Commit Message ควรชัดเจน

❌ **ไม่ดี:**
```bash
git commit -m "fix"
git commit -m "update"
git commit -m "changes"
```

✅ **ดี:**
```bash
git commit -m "Fix 404 refresh issue for GitHub Pages"
git commit -m "Add Date Node with customizable font size"
git commit -m "Update login page design with blue theme"
```

### 3. Commit บ่อยๆ

- Commit เมื่อแก้ไขเสร็จแต่ละฟีเจอร์
- อย่ารอให้แก้ไขหลายอย่างแล้วค่อย commit
- ทำให้ง่ายต่อการ rollback ถ้ามีปัญหา

---

## 🔍 ตรวจสอบสถานะ

### ดู Commit History

```bash
# ดู commit history
git log

# ดู commit history แบบย่อ
git log --oneline

# ดู commit history พร้อม graph
git log --oneline --graph
```

### ดูการเปลี่ยนแปลง

```bash
# ดูการเปลี่ยนแปลงที่ยังไม่ได้ add
git diff

# ดูการเปลี่ยนแปลงที่ add แล้ว
git diff --staged
```

### ดู Remote Status

```bash
# ดู remote repository
git remote -v

# ดู branch ทั้งหมด
git branch -a
```

---

## 🆘 แก้ไขปัญหา

### ถ้า Commit ผิด

```bash
# แก้ไข commit message (ถ้ายังไม่ได้ push)
git commit --amend -m "ข้อความใหม่"

# ยกเลิก commit (แต่เก็บการเปลี่ยนแปลง)
git reset --soft HEAD~1

# ยกเลิก commit และการเปลี่ยนแปลง
git reset --hard HEAD~1
```

### ถ้า Push ผิด

```bash
# Force push (ระวัง! ใช้เมื่อแน่ใจ)
git push --force

# หรือ force push แบบปลอดภัยกว่า
git push --force-with-lease
```

### ถ้า GitHub Actions Fail

1. ไปที่ repository → **Actions**
2. คลิก workflow ที่ fail
3. ดู error message
4. แก้ไขปัญหา
5. Commit และ push อีกครั้ง

---

## 📚 คำสั่ง Git ที่ใช้บ่อย

```bash
# ดูสถานะ
git status

# เพิ่มไฟล์
git add <file>
git add .

# Commit
git commit -m "message"

# Push
git push

# Pull (ดึงโค้ดล่าสุด)
git pull

# ดู branch
git branch

# สร้าง branch ใหม่
git branch <branch-name>

# เปลี่ยน branch
git checkout <branch-name>

# Merge branch
git merge <branch-name>
```

---

## 🎯 สรุป

1. ✅ **แก้ไขโค้ด** → `git add .` → `git commit -m "message"` → `git push`
2. ✅ **รอ GitHub Actions deploy** (2-3 นาที)
3. ✅ **ตรวจสอบเว็บไซต์** บน GitHub Pages

**หมายเหตุ**: GitHub Actions จะ build และ deploy อัตโนมัติทุกครั้งที่ push code ไปยัง branch `main`

