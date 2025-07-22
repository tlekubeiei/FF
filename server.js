import express from 'express';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import fs from 'fs';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// ตั้งค่าการอัปโหลดรูป
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// สร้างฐานข้อมูล SQLite และตารางถ้ายังไม่มี
const db = new sqlite3.Database('db.sqlite');
db.run(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    reason TEXT,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// เพิ่มรายงานใหม่ (แจ้งเกรียน)
app.post('/report', upload.single('image'), (req, res) => {
  const { uid, reason } = req.body;
  const imagePath = req.file ? req.file.path : null;

  if (!uid) return res.status(400).json({ error: 'ต้องกรอก UID' });
  if (!reason) return res.status(400).json({ error: 'ต้องแจ้งเหตุผล' });

  db.run(
    'INSERT INTO reports (uid, reason, image_path) VALUES (?, ?, ?)',
    [uid, reason, imagePath],
    function (err) {
      if (err) {
        console.error('DB insert error:', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'แจ้งสำเร็จ', id: this.lastID });
    }
  );
});

// ค้นหารายงานโดย UID (LIKE)
app.get('/search/:uid', (req, res) => {
  const uid = req.params.uid;
  const searchPattern = `%${uid}%`;
  db.all('SELECT * FROM reports WHERE uid LIKE ? ORDER BY created_at DESC', [searchPattern], (err, rows) => {
    if (err) {
      console.error('DB search error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// ดึงรายงานทั้งหมด
app.get('/reports', (req, res) => {
  db.all('SELECT * FROM reports ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('DB fetch all error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// ลบรายงานพร้อมลบไฟล์ภาพ (ถ้ามี)
app.delete('/report/:id', (req, res) => {
  const id = req.params.id;

  db.get('SELECT image_path FROM reports WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('DB get error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!row) return res.status(404).json({ error: 'ไม่พบรายงานนี้' });

    const deleteReportRow = () => {
      db.run('DELETE FROM reports WHERE id = ?', [id], function (delErr) {
        if (delErr) {
          console.error('DB delete error:', delErr.message);
          return res.status(500).json({ error: delErr.message });
        }
        res.json({ message: 'ลบรายงานเรียบร้อย' });
      });
    };

    if (row.image_path) {
      fs.unlink(row.image_path, (unlinkErr) => {
        if (unlinkErr) {
          // แค่แจ้งเตือน แต่ยังลบ DB ต่อ
          console.warn('ไม่สามารถลบไฟล์รูปภาพ:', unlinkErr.message);
        }
        deleteReportRow();
      });
    } else {
      deleteReportRow();
    }
  });
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
