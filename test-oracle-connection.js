require('dotenv').config({ path: './.env' });

const oracledb = require('oracledb');
// Enable Thick mode for Oracle 11g
oracledb.initOracleClient({ libDir: 'C:\\instantclient_23_9' }); 

async function testConnection() {
  try {
    await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });
    const connection = await oracledb.getConnection();
    const result = await connection.execute('SELECT 1 FROM DUAL');
    console.log('Connection successful:', result.rows);
    await connection.close();
    await oracledb.getPool().close();
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

testConnection();
