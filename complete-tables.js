// Complete database setup (handle existing tables)
const { execute } = require('./db/oracle.js');

console.log('=== Completing Database Setup ===\n');

async function completeSetup() {
    try {
        // Handle BOOKINGS table (might already exist)
        console.log('1. Creating BOOKINGS table...');
        try {
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
        } catch (error) {
            if (error.message.includes('name is already used')) {
                console.log('⚠️  BOOKINGS table already exists (expected)');
            } else {
                throw error;
            }
        }
        
        // Handle SESSIONS table
        console.log('\n2. Creating SESSIONS table...');
        try {
            await execute(`
                CREATE TABLE Sessions (
                    session_id VARCHAR2(50) PRIMARY KEY,
                    user_id VARCHAR2(50),
                    role VARCHAR2(10),
                    created_at TIMESTAMP DEFAULT SYSTIMESTAMP
                )
            `);
            console.log('✅ SESSIONS table created');
        } catch (error) {
            if (error.message.includes('name is already used')) {
                console.log('⚠️  SESSIONS table already exists (expected)');
            } else {
                throw error;
            }
        }
        
        // Create sequences (handle existing)
        console.log('\n3. Creating sequences...');
        try {
            await execute('CREATE SEQUENCE seq_teachers START WITH 1 INCREMENT BY 1');
            console.log('✅ seq_teachers created');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  seq_teachers already exists');
            } else {
                throw error;
            }
        }
        
        try {
            await execute('CREATE SEQUENCE seq_rooms START WITH 1 INCREMENT BY 1');
            console.log('✅ seq_rooms created');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  seq_rooms already exists');
            } else {
                throw error;
            }
        }
        
        try {
            await execute('CREATE SEQUENCE seq_slots START WITH 1 INCREMENT BY 1');
            console.log('✅ seq_slots created');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  seq_slots already exists');
            } else {
                throw error;
            }
        }
        
        try {
            await execute('CREATE SEQUENCE seq_bookings START WITH 1 INCREMENT BY 1');
            console.log('✅ seq_bookings created');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  seq_bookings already exists');
            } else {
                throw error;
            }
        }
        
        // Create triggers
        console.log('\n4. Creating triggers...');
        try {
            await execute(`
                CREATE OR REPLACE TRIGGER tr_teachers_id
                    BEFORE INSERT ON Teachers
                    FOR EACH ROW
                BEGIN
                    SELECT seq_teachers.NEXTVAL INTO :NEW.teacher_id FROM DUAL;
                END;
            `);
            console.log('✅ tr_teachers_id created/replaced');
        } catch (error) {
            console.log('⚠️  tr_teachers_id error:', error.message);
        }
        
        try {
            await execute(`
                CREATE OR REPLACE TRIGGER tr_rooms_id
                    BEFORE INSERT ON Rooms
                    FOR EACH ROW
                BEGIN
                    SELECT seq_rooms.NEXTVAL INTO :NEW.room_id FROM DUAL;
                END;
            `);
            console.log('✅ tr_rooms_id created/replaced');
        } catch (error) {
            console.log('⚠️  tr_rooms_id error:', error.message);
        }
        
        try {
            await execute(`
                CREATE OR REPLACE TRIGGER tr_slots_id
                    BEFORE INSERT ON Slots
                    FOR EACH ROW
                BEGIN
                    SELECT seq_slots.NEXTVAL INTO :NEW.slot_id FROM DUAL;
                END;
            `);
            console.log('✅ tr_slots_id created/replaced');
        } catch (error) {
            console.log('⚠️  tr_slots_id error:', error.message);
        }
        
        try {
            await execute(`
                CREATE OR REPLACE TRIGGER tr_bookings_id
                    BEFORE INSERT ON Bookings
                    FOR EACH ROW
                BEGIN
                    SELECT seq_bookings.NEXTVAL INTO :NEW.booking_id FROM DUAL;
                END;
            `);
            console.log('✅ tr_bookings_id created/replaced');
        } catch (error) {
            console.log('⚠️  tr_bookings_id error:', error.message);
        }
        
        console.log('\n🎉 Database setup completed!');
        
        // Verify all tables
        console.log('\n5. Verifying all tables...');
        const tablesResult = await execute(`
            SELECT table_name 
            FROM user_tables 
            WHERE table_name IN ('STUDENTS', 'TEACHERS', 'ROOMS', 'SLOTS', 'BOOKINGS', 'SESSIONS')
            ORDER BY table_name
        `);
        console.log('✅ All tables created:', tablesResult.map(row => row.TABLE_NAME));
        
        // Test inserting a teacher to verify everything works
        console.log('\n6. Testing teacher insertion...');
        try {
            await execute(`INSERT INTO Teachers (name, email, password) VALUES ('Test Teacher', 'test@example.com', 'hashedpassword')`);
            console.log('✅ Teacher insertion test successful');
            
            // Clean up test data
            await execute(`DELETE FROM Teachers WHERE email = 'test@example.com'`);
            console.log('✅ Test data cleaned up');
        } catch (testError) {
            console.log('⚠️  Teacher insertion test failed:', testError.message);
        }
        
        console.log('\n🎉 DATABASE SETUP COMPLETE! The application should now work properly.');
        
    } catch (error) {
        console.log('❌ Setup failed:', error.message);
        console.log('Full error:', error);
    }
}

completeSetup();