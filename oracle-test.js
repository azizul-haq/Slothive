// Test Oracle Client connectivity step by step
const oracledb = require('oracledb');

console.log('=== Oracle Client Connection Test ===\n');

async function testOracleConnection() {
    try {
        // Test 1: Check if Oracle Client can be initialized
        console.log('1. Testing Oracle Client initialization...');
        console.log('   Oracle Client version:', oracledb.oracleClientVersionString || 'Unknown');
        console.log('   ✅ Oracle Client library loaded successfully');
        
        // Test 2: Try to get connection without database
        console.log('\n2. Testing basic connection configuration...');
        const testConfig = {
            user: 'system',
            password: 'admin1234',
            connectString: 'localhost:1521/XE'
        };
        
        console.log('   Database config:', {
            user: testConfig.user,
            connectString: testConfig.connectString,
            password: testConfig.password ? '***' : 'NOT SET'
        });
        
        // Test 3: Check if we can establish a connection
        console.log('\n3. Testing database connection...');
        let connection;
        try {
            connection = await oracledb.getConnection(testConfig);
            console.log('   ✅ Database connection successful!');
            
            // Test a simple query
            const result = await connection.execute('SELECT 1 as test FROM dual');
            console.log('   ✅ Test query executed:', result.rows);
            
            await connection.close();
            
        } catch (connError) {
            console.log('   ❌ Database connection failed:', connError.message);
            
            // Check if it's a network/credential issue vs Oracle Client issue
            if (connError.message.includes('DPI-1047') || connError.message.includes('Oracle Client')) {
                console.log('   🔍 This is an Oracle Client library issue');
            } else {
                console.log('   🔍 This appears to be a database/network/credential issue');
            }
        }
        
    } catch (error) {
        console.log('❌ Oracle Client initialization failed:', error.message);
        
        // Check specific error codes
        if (error.message.includes('DPI-1047')) {
            console.log('🔍 DPI-1047 Error Analysis:');
            console.log('   - Oracle Client libraries found but not loadable');
            console.log('   - Possible causes:');
            console.log('     * Missing Visual Studio Redistributable');
            console.log('     * Permission issues accessing Oracle Client');
            console.log('     * Oracle Client version incompatibility');
            console.log('     * Corrupted Oracle Client installation');
        }
    }
}

testOracleConnection();