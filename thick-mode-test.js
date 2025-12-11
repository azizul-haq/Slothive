// Debug Oracle Client Thick mode initialization
const oracledb = require('oracledb');

console.log('=== Testing Oracle Client Thick Mode ===\n');

async function testThickMode() {
    try {
        console.log('1. Current oracledb version:', oracledb.versionString);
        
        // Try to initialize Thick mode with explicit settings
        console.log('2. Attempting to initialize Thick mode...');
        
        // Check if Thick mode is already enabled
        console.log('3. Is Thick mode supported?', oracledb.oracleClientVersionString ? 'Yes' : 'Unknown');
        
        // Try the initialization that was failing in db/oracle.js
        try {
            oracledb.initOracleClient({ libDir: 'C:\\instantclient-basic-windows\\instantclient_23_8' });
            console.log('4. ✅ Thick mode initialization successful!');
            console.log('   Oracle Client version:', oracledb.oracleClientVersionString);
            
        } catch (initError) {
            console.log('4. ❌ Thick mode initialization failed:', initError.message);
            console.log('   Error code:', initError.code);
            
            // This is the DPI-1047 error we were seeing
            if (initError.message.includes('DPI-1047')) {
                console.log('   🔍 DPI-1047 indicates Oracle Client library loading failure');
                console.log('   Possible solutions:');
                console.log('   - Check Oracle Client directory permissions');
                console.log('   - Verify all Oracle Client DLL dependencies are present');
                console.log('   - Install missing Visual Studio Redistributables');
                console.log('   - Try using Thin mode with compatible database');
            }
        }
        
    } catch (error) {
        console.log('❌ General error:', error.message);
    }
}

testThickMode();