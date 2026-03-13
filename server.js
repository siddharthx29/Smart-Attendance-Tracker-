const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware to ensure a Device-ID is present in headers
const ensureDeviceId = (req, res, next) => {
  const deviceId = req.headers['x-device-id'];
  if (!deviceId) {
    return res.status(400).json({ message: 'Device-ID header (x-device-id) is required.' });
  }
  req.deviceId = deviceId;
  next();
};

// --- SUBJECT ENDPOINTS ---

app.get('/api/subjects', ensureDeviceId, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subjects WHERE device_id = $1', [req.deviceId]);
    const subjects = result.rows;
    
    // Fetch history for each subject
    for (let subject of subjects) {
      const historyResult = await pool.query('SELECT * FROM history WHERE subject_id = $1 ORDER BY date DESC', [subject.id]);
      subject.history = historyResult.rows;
    }
    
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching subjects', error: err.message });
  }
});

app.post('/api/subjects', ensureDeviceId, async (req, res) => {
  const { name, weekly_hours, lecture_days, start_date, end_date } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO subjects (device_id, name, weekly_hours, lecture_days, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.deviceId, name, weekly_hours, JSON.stringify(lecture_days), start_date, end_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ message: 'Error adding subject', error: err.message });
  }
});

app.post('/api/attendance', ensureDeviceId, async (req, res) => {
  const { subject_id, date, status, note } = req.body;
  try {
    // Verify subject belongs to this device
    const subjectCheck = await pool.query('SELECT id FROM subjects WHERE id = $1 AND device_id = $2', [subject_id, req.deviceId]);
    if (subjectCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Subject not found for this device.' });
    }

    const result = await pool.query(
      'INSERT INTO history (subject_id, date, status, note) VALUES ($1, $2, $3, $4) RETURNING *',
      [subject_id, date, status, note]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ message: 'Error recording attendance', error: err.message });
  }
});

app.delete('/api/subjects/:id', ensureDeviceId, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM subjects WHERE id = $1 AND device_id = $2', [req.params.id, req.deviceId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Subject not found or access denied.' });
    }
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting subject', error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
