const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL");
}

async function main() {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  console.log("Connecting to database...");
  const client = await pool.connect();
  try {
    console.log("Querying pg_stat_activity...");
    const res = await client.query(`
      SELECT pid, state, query, age(clock_timestamp(), query_start) as age 
      FROM pg_stat_activity 
      WHERE datname = current_database()
      ORDER BY age DESC;
    `);
    console.log("Active Queries:\n");
    console.table(res.rows.map(row => ({
      pid: row.pid,
      state: row.state,
      age: row.age ? row.age.toString() : "",
      query: row.query ? row.query.substring(0, 100) : ""
    })));
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
