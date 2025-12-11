// db/oracle.js
require('dotenv').config({ path: './.env' });
const oracledb = require('oracledb');

// Enable Thick mode for Oracle 11g
oracledb.initOracleClient({ libDir: 'C:\\instantclient-basic-windows\\instantclient_23_8' });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
};

async function getConnection() {
  return oracledb.getConnection(dbConfig);
}

async function execute(query, params = []) {
  let connection;
  try {
    connection = await getConnection();

    // Handle different parameter formats
    let bindParams = params;
    let options = { outFormat: oracledb.OUT_FORMAT_OBJECT };

    // If params is an object, use it directly for named binds
    if (typeof params === 'object' && !Array.isArray(params)) {
      bindParams = params;
    }
    // If params is an array, check if query uses positional binds (:1, :2, etc.)
    else if (Array.isArray(params) && query.includes(':1')) {
      // Convert array to object with positional bind names
      bindParams = {};
      params.forEach((value, index) => {
        bindParams[index + 1] = value;
      });
    }

    const result = await connection.execute(query, bindParams, options);

    // Commit the transaction for INSERT, UPDATE, DELETE operations
    if (query.trim().toUpperCase().startsWith('INSERT') ||
        query.trim().toUpperCase().startsWith('UPDATE') ||
        query.trim().toUpperCase().startsWith('DELETE')) {
      await connection.commit();
    }

    return result.rows;
  } catch (err) {
    console.error('DB Error:', err);
    if (connection) {
      try { await connection.rollback(); } catch (e) { /* ignore */ }
    }
    throw err;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { /* ignore */ }
    }
  }
}

module.exports = { execute };
