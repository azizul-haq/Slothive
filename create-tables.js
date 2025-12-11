// Create database tables step by step
const { execute } = require('./db/oracle.js');

console.log('=== Creating Database Tables Step by Step ===\n');

async function createTables() {
    try {
        // Create tables in proper dependency order
        
        console.log('1. Creating TEACHERS table...');
        await execute(`
            CREATE TABLE Teachers (
                teacher_id NUMBER PRIMARY KEY,
                name VARCHAR2(100) NOT NULL,
                email VARCHAR2(100) UNIQUE NOT NULL,
                password VARCHAR2(100) NOT NULL
            )
        `);
        console.log('✅ TEACHERS table created');
        
        console.log('\n2. Creating STUDENTS table...');
        await execute(`
            CREATE TABLE Students (
                student_id VARCHAR2(20) PRIMARY KEY,
                name VARCHAR2(100) NOT NULL,
                batch VARCHAR2(20),
                dept VARCHAR2(50),
                email VARCHAR2(100) UNIQUE NOT NULL,
                password VARCHAR2(100) NOT NULL
            )
        `);
        console.log('✅ STUDENTS table created');
        
        console.log('\n3. Creating ROOMS table...');
        await execute(`
            CREATE TABLE Rooms (
                room_id NUMBER PRIMARY KEY,
                room_no VARCHAR2(10) NOT NULL,
                date_available DATE NOT NULL,
                time_from TIMESTAMP NOT NULL,
                time_to TIMESTAMP NOT NULL
            )
        `);
        console.log('✅ ROOMS table created');
        
        console.log('\n4. Creating SLOTS table...');
        await execute(`
            CREATE TABLE Slots (
                slot_id NUMBER PRIMARY KEY,
                room_id NUMBER REFERENCES Rooms(room_id),
                slot_start TIMESTAMP NOT NULL,
                slot_end TIMESTAMP NOT NULL,
                is_booked CHAR(1) DEFAULT 'N'
            )
        `);
        console.log('✅ SLOTS table created');
        
        console.log('\n5. Creating BOOKINGS table...');
        await execute(`
            CREATE TABLE Bookings (
                booking_id NUMBER PRIMARY KEY,
                slot_id NUMBER REFERENCES Slots(slot_id),
                student_id VARCHAR2(20) REFERENCES Students(student_id),
                booking_time TIMESTAMP DEFAULT SYSTIMESTAMP,
                token_code VARCHAR2(50) UNIQUE NOT NULL
            )
        `);
        console.log('✅ BOOKINGS table created');
        
        console.log('\n6. Creating SESSIONS table...');
        await execute(`
            CREATE TABLE Sessions (
                session_id VARCHAR2(50) PRIMARY KEY,
                user_id VARCHAR2(50),
                role VARCHAR2(10),
                created_at TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        `);
        console.log('✅ SESSIONS table created');
        
        // Create sequences for auto-incrementing IDs
        console.log('\n7. Creating sequences...');
        await execute('CREATE SEQUENCE seq_teachers START WITH 1 INCREMENT BY 1');
        await execute('CREATE SEQUENCE seq_rooms START WITH 1 INCREMENT BY 1');
        await execute('CREATE SEQUENCE seq_slots START WITH 1 INCREMENT BY 1');
        await execute('CREATE SEQUENCE seq_bookings START WITH 1 INCREMENT BY 1');
        console.log('✅ Sequences created');
        
        // Create triggers
        console.log('\n8. Creating triggers...');
        await execute(`
            CREATE OR REPLACE TRIGGER tr_teachers_id
                BEFORE INSERT ON Teachers
                FOR EACH ROW
            BEGIN
                SELECT seq_teachers.NEXTVAL INTO :NEW.teacher_id FROM DUAL;
            END;
        `);
        
        await execute(`
            CREATE OR REPLACE TRIGGER tr_rooms_id
                BEFORE INSERT ON Rooms
                FOR EACH ROW
            BEGIN
                SELECT seq_rooms.NEXTVAL INTO :NEW.room_id FROM DUAL;
            END;
        `);
        
        await execute(`
            CREATE OR REPLACE TRIGGER tr_slots_id
                BEFORE INSERT ON Slots
                FOR EACH ROW
            BEGIN
                SELECT seq_slots.NEXTVAL INTO :NEW.slot_id FROM DUAL;
            END;
        `);
        
        await execute(`
            CREATE OR REPLACE TRIGGER tr_bookings_id
                BEFORE INSERT ON Bookings
                FOR EACH ROW
            BEGIN
                SELECT seq_bookings.NEXTVAL INTO :NEW.booking_id FROM DUAL;
            END;
        `);
        console.log('✅ Triggers created');
        
        console.log('\n🎉 All database tables created successfully!');
        
        // Verify all tables
        console.log('\n9. Verifying all tables...');
        const tablesResult = await execute(`
            SELECT table_name 
            FROM user_tables 
            WHERE table_name IN ('STUDENTS', 'TEACHERS', 'ROOMS', 'SLOTS', 'BOOKINGS', 'SESSIONS')
            ORDER BY table_name
        `);
        console.log('✅ Created tables:', tablesResult.map(row => row.TABLE_NAME));
        
    } catch (error) {
        console.log('❌ Table creation failed:', error.message);
        console.log('Full error:', error);
    }
}

createTables();