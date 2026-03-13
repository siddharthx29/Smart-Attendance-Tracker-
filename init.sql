-- Database Initialization Script for Device-Based Tracking

-- We use device_id (UUID/String) instead of users to store data per-device
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL, 
    name VARCHAR(100) NOT NULL,
    weekly_hours INTEGER,
    lecture_days JSONB,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE history (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'attended' or 'missed'
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subjects_device ON subjects(device_id);
