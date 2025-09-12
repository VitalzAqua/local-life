const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  // Get the SQL file from command line argument
  const sqlFile = process.argv[2] || './sql/create_tables.sql';
  
  try {
    const sql = fs.readFileSync(sqlFile, 'utf8');
    await pool.query(sql);
    console.log(`✅ Successfully executed ${sqlFile}!`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
})();