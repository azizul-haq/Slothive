// Test loading the db/oracle.js module as the app does
console.log('=== Testing db/oracle.js Module Load ===\n');

try {
    console.log('1. Loading db/oracle.js module...');
    const dbOracle = require('./db/oracle.js');
    console.log('✅ db/oracle.js module loaded successfully');
    
    console.log('\n2. Testing database execution through the module...');
    
    // Test the execute function from the module
    (async () => {
        try {
            const result = await dbOracle.execute('SELECT 1 as test FROM dual');
            console.log('✅ Database query through module successful:', result);
            console.log('\n🎉 THE MODULE WORKS FINE! No issues found.');
        } catch (queryError) {
            console.log('❌ Query through module failed:', queryError.message);
            console.log('Error details:', queryError);
        }
    })();
    
} catch (loadError) {
    console.log('❌ Failed to load db/oracle.js module:', loadError.message);
    console.log('Error code:', loadError.code);
    
    // This should show us the DPI-1047 error
    if (loadError.message.includes('DPI-1047')) {
        console.log('\n🔍 Found the original DPI-1047 error!');
        console.log('This confirms the issue is in the module loading process.');
    }
}