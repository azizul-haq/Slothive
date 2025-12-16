-- SlotHive Database Schema Updates
-- This script adds missing columns and tables for enhanced functionality

-- Add view_count column to existing Bookings table
ALTER TABLE Bookings ADD (
    view_count NUMBER DEFAULT 0,
    last_viewed TIMESTAMP,
    cancellation_deadline TIMESTAMP,
    booking_status VARCHAR2(20) DEFAULT 'ACTIVE' CHECK (booking_status IN ('ACTIVE', 'CANCELLED', 'COMPLETED', 'NO_SHOW'))
);

-- Create Counseling_History table for teacher-student meeting logs
CREATE TABLE Counseling_History (
    counseling_id NUMBER PRIMARY KEY,
    teacher_id NUMBER NOT NULL,
    student_id VARCHAR2(20) NOT NULL,
    booking_id NUMBER,
    session_date DATE NOT NULL,
    session_duration NUMBER DEFAULT 30, -- in minutes
    meeting_notes CLOB,
    outcome VARCHAR2(100),
    follow_up_required VARCHAR2(1) DEFAULT 'N' CHECK (follow_up_required IN ('Y', 'N')),
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES Teachers(teacher_id),
    FOREIGN KEY (student_id) REFERENCES Students(student_id),
    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
);

-- Create sequence for counseling_id
CREATE SEQUENCE seq_counseling START WITH 1 INCREMENT BY 1;

-- Create trigger for auto-incrementing counseling_id
CREATE OR REPLACE TRIGGER tr_counseling_id
    BEFORE INSERT ON Counseling_History
    FOR EACH ROW
BEGIN
    SELECT seq_counseling.NEXTVAL INTO :NEW.counseling_id FROM DUAL;
END;
/

-- Create password_reset_tokens table for forgot password functionality
CREATE TABLE Password_Reset_Tokens (
    token_id NUMBER PRIMARY KEY,
    email VARCHAR2(100) NOT NULL,
    token_hash VARCHAR2(64) NOT NULL UNIQUE, -- SHA256 hash of the token
    token_type VARCHAR2(20) DEFAULT 'PASSWORD_RESET' CHECK (token_type IN ('PASSWORD_RESET', 'EMAIL_VERIFY')),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    FOREIGN KEY (email) REFERENCES Students(email)
);

-- Add email column to Teachers table if it doesn't exist (should already exist)
-- This is for password reset functionality
ALTER TABLE Teachers ADD CONSTRAINT teachers_email_unique UNIQUE (email);

-- Create sequence for password_reset_tokens
CREATE SEQUENCE seq_password_reset_tokens START WITH 1 INCREMENT BY 1;

-- Create trigger for auto-incrementing token_id
CREATE OR REPLACE TRIGGER tr_password_reset_token_id
    BEFORE INSERT ON Password_Reset_Tokens
    FOR EACH ROW
BEGIN
    SELECT seq_password_reset_tokens.NEXTVAL INTO :NEW.token_id FROM DUAL;
END;
/

-- Create indexes for better query performance
CREATE INDEX idx_bookings_view_count ON Bookings(view_count);
CREATE INDEX idx_bookings_status ON Bookings(booking_status);
CREATE INDEX idx_bookings_cancellation_deadline ON Bookings(cancellation_deadline);
CREATE INDEX idx_counseling_teacher_id ON Counseling_History(teacher_id);
CREATE INDEX idx_counseling_student_id ON Counseling_History(student_id);
CREATE INDEX idx_counseling_session_date ON Counseling_History(session_date);
CREATE INDEX idx_password_reset_email ON Password_Reset_Tokens(email);
CREATE INDEX idx_password_reset_expires ON Password_Reset_Tokens(expires_at);

-- Add comments to document the new schema elements
COMMENT ON COLUMN Bookings.view_count IS 'Number of times the booking token has been viewed';
COMMENT ON COLUMN Bookings.last_viewed IS 'Timestamp of the last token view';
COMMENT ON COLUMN Bookings.cancellation_deadline IS 'Latest time by which booking can be cancelled';
COMMENT ON COLUMN Bookings.booking_status IS 'Current status of the booking (ACTIVE, CANCELLED, COMPLETED, NO_SHOW)';

COMMENT ON TABLE Counseling_History IS 'History of counseling sessions between teachers and students';
COMMENT ON COLUMN Counseling_History.session_duration IS 'Duration of the counseling session in minutes';
COMMENT ON COLUMN Counseling_History.meeting_notes IS 'Detailed notes from the counseling session';
COMMENT ON COLUMN Counseling_History.outcome IS 'Summary of the counseling session outcome';
COMMENT ON COLUMN Counseling_History.follow_up_required IS 'Whether follow-up is required (Y/N)';

COMMENT ON TABLE Password_Reset_Tokens IS 'Tokens for password reset and email verification functionality';
COMMENT ON COLUMN Password_Reset_Tokens.token_type IS 'Type of token (PASSWORD_RESET, EMAIL_VERIFY)';
COMMENT ON COLUMN Password_Reset_Tokens.expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN Password_Reset_Tokens.used_at IS 'Timestamp when token was used';

-- Commit the changes
COMMIT;