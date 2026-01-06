-- SQL Script to fix cvn_data_iot table
-- Run this in MySQL if the table structure is incorrect

USE cvn;

-- Option 1: Fix existing table (if it has data, this will preserve it)
ALTER TABLE cvn_data_iot MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY;

-- Option 2: If Option 1 fails, drop and recreate the table
-- WARNING: This will delete all existing data!
-- DROP TABLE IF EXISTS cvn_data_iot;
-- CREATE TABLE cvn_data_iot (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   ip_address VARCHAR(255) NOT NULL,
--   protocol VARCHAR(50) NOT NULL,
--   port INT NOT NULL,
--   start_address INT DEFAULT 0,
--   slave_id INT DEFAULT 1,
--   modbus_function VARCHAR(50) DEFAULT 'readCoils',
--   num_inputs INT DEFAULT 4,
--   num_outputs INT DEFAULT 4,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );



