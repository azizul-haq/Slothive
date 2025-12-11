// Setup Oracle database schema
const { execute } = require('./db/oracle.js');
const fs = require('fs');

console.log('=== Setting up Oracle Database Schema ===\n');

async function setupDatabase() {
    try {
        console.log('1. Reading schema SQL file...');
        const schemaSQL = fs.readFileSync('./db/schema-oracle11g.sql', 'utf8');
        console.log('✅ Schema file loaded');
        
        console.log('\n2. Executing schema setup...');
        
        // Split the SQL into individual statements
        const statements = schemaSQL
            .split('/')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`Found ${statements.length} SQL statements to execute`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim().length === 0) continue;
            
            try {
                console.log(`Executing statement ${i + 1}...`);
                await execute(statement);
                console.log(`✅ Statement ${i + 1} executed successfully`);
            } catch (stmtError) {
                // Some statements might fail (like dropping non-existent objects), which is OK
                if (stmtError.message.includes('does not exist') || 
                    stmtError.message.includes('ORA-00942')) {
                    console.log(`⚠️  Statement ${i + 1} failed (expected): ${stmtError.message}`);
                } else {
                    console.log(`❌ Statement ${i + 1} failed: ${stmtError.message}`);
                    throw stmtError;
                }
            }
        }
        
        console.log('\n🎉 Database schema setup completed successfully!');
        
        // Verify tables were created
        console.log('\n3. Verifying table creation...');
        try {
            const tablesResult = await execute(`SELECT table_name FROM user_tables WHERE table_name IN ('STUDENTS', 'TEACHERS', 'ROOMS', 'SLOTS', 'BOOKINGS', 'SESSIONS') ORDER BY table_name`);
            console.log('✅ Created tables:', tablesResult.map(row => row.TABLE_NAME));
        } catch (verifyError) {
            console.log('⚠️  Could not verify tables:', verifyError.message);
        }
        
    } catch (error) {
        console.log('❌ Database setup failed:', error.message);
        console.log('Full error:', error);
    }
}

setupDatabase();