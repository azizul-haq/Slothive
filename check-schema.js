// Check current database schema for TOKEN_CODE column
const { execute } = require('./db/oracle.js');

console.log('=== Checking TOKEN_CODE Column Schema ===\n');

async function checkSchema() {
    try {
        console.log('1. Checking BOOKINGS table structure...');
        const columnsResult = await execute(`
            SELECT column_name, data_type, data_length, char_col_decl_length 
            FROM user_tab_columns 
            WHERE table_name = 'BOOKINGS' 
            ORDER BY column_id
        `);
        
        console.log('BOOKINGS table columns:');
        columnsResult.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}(${col.DATA_LENGTH})`);
        });
        
        // Check specifically for TOKEN_CODE
        const tokenCodeColumn = columnsResult.find(col => col.COLUMN_NAME === 'TOKEN_CODE');
        if (tokenCodeColumn) {
            console.log(`\n🔍 TOKEN_CODE column details:`);
            console.log(`   Data type: ${tokenCodeColumn.DATA_TYPE}`);
            console.log(`   Max length: ${tokenCodeColumn.DATA_LENGTH}`);
            console.log(`   Declared length: ${tokenCodeColumn.CHAR_COL_DECL_LENGTH}`);
        } else {
            console.log('\n❌ TOKEN_CODE column not found');
        }
        
        // Let's also check what token codes are being generated
        console.log('\n2. Sample token code length test...');
        const crypto = require('crypto');
        const token = crypto.randomBytes(16).toString('hex');
        console.log(`   Generated token: ${token}`);
        console.log(`   Token length: ${token.length} characters`);
        
        if (token.length > 20) {
            console.log(`   ❌ Token too long for VARCHAR2(20) column`);
            console.log(`   💡 Solution: Increase column size or generate shorter tokens`);
        }
        
    } catch (error) {
        console.log('❌ Schema check failed:', error.message);
        console.log('Full error:', error);
    }
}

checkSchema();