// Fix TOKEN_CODE column size
const { execute } = require('./db/oracle.js');

console.log('=== Fixing TOKEN_CODE Column Size ===\n');

async function fixTokenColumn() {
    try {
        console.log('1. Current TOKEN_CODE column size: VARCHAR2(20)');
        console.log('2. Increasing column size to VARCHAR2(50)...');
        
        await execute(`ALTER TABLE Bookings MODIFY (TOKEN_CODE VARCHAR2(50))`);
        
        console.log('✅ TOKEN_CODE column size increased to VARCHAR2(50)');
        
        // Verify the change
        console.log('\n3. Verifying the change...');
        const columnsResult = await execute(`
            SELECT column_name, data_type, data_length 
            FROM user_tab_columns 
            WHERE table_name = 'BOOKINGS' AND column_name = 'TOKEN_CODE'
        `);
        
        const tokenCodeColumn = columnsResult[0];
        console.log(`✅ TOKEN_CODE column is now: ${tokenCodeColumn.DATA_TYPE}(${tokenCodeColumn.DATA_LENGTH})`);
        
        // Test token generation
        console.log('\n4. Testing token generation...');
        const crypto = require('crypto');
        const token = crypto.randomBytes(16).toString('hex');
        console.log(`   Generated token: ${token}`);
        console.log(`   Token length: ${token.length} characters`);
        
        if (token.length <= 50) {
            console.log(`   ✅ Token fits in VARCHAR2(50) column`);
        } else {
            console.log(`   ❌ Token still too long`);
        }
        
        console.log('\n🎉 TOKEN_CODE column size fixed successfully!');
        
    } catch (error) {
        console.log('❌ Failed to fix column size:', error.message);
        console.log('Full error:', error);
    }
}

fixTokenColumn();