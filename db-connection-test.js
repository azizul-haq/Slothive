// Test actual database connection with Thick mode
const oracledb = require('oracledb');

console.log('=== Database Connection Test with Thick Mode ===\n');

async function testDatabaseConnection() {
    try {
        // Initialize Thick mode first
        console.log('1. Initializing Thick mode...');
        oracledb.initOracleClient({ libDir: 'C:\\instantclient-basic-windows\\instantclient_23_8' });
        console.log('✅ Thick mode initialized');
        console.log('   Oracle Client version:', oracledb.oracleClientVersionString);
        
        // Test database connection
        console.log('\n2. Testing database connection...');
        const connection = await oracledb.getConnection({
            user: 'system',
            password: 'admin1234',
            connectString: 'localhost:1521/XE'
        });
        
        console.log('✅ Database connection successful!');
        
        // Test a query
        console.log('\n3. Testing database query...');
        const result = await connection.execute('SELECT version FROM v$instance');
        console.log('✅ Query successful!');
        console.log('   Database version:', result.rows[0].VERSION);
        
        // Test another query
        const result2 = await connection.execute('SELECT 1 as test FROM dual');
        console.log('✅ Test query successful:', result2.rows);
        
        await connection.close();
        console.log('\n🎉 ALL TESTS PASSED! The database connection is working perfectly.');
        
    } catch (error) {
        console.log('❌ Connection failed:', error.message);
        
        if (error.message.includes('ORA-')) {
            console.log('🔍 This is an Oracle database error (connection, credentials, or database status)');
        } else if (error.message.includes('DPI-')) {
            console.log('🔍 This is an Oracle Client library error');
        } else {
            console.log('🔍 This is a general connection error');
        }
        
        console.log('\nFull error details:', error);
    }
}

testDatabaseConnection();