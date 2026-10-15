-- 008: validade configurável dos links de booking (período + datas específicas).
ALTER TABLE booking_types ADD COLUMN valid_from DATETIME;
ALTER TABLE booking_types ADD COLUMN valid_until DATETIME;
ALTER TABLE booking_types ADD COLUMN allowed_dates TEXT;
