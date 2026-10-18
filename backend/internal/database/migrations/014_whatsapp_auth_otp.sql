-- 014: WhatsApp passwordless auth OTP table
CREATE TABLE IF NOT EXISTS whatsapp_auth_otps (
    phone TEXT PRIMARY KEY,
    otp_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_expires ON whatsapp_auth_otps(expires_at);
