const { Client } = require('pg');
console.log('Testing pooler connection...');
const client = new Client({
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.btwandiwqwesbppwtbuh',
  password: 'SurevyConnectHub_123#$',
  ssl: { rejectUnauthorized: false },
});
client.connect().then(() => {
  console.log('Connected successfully');
  return client.query('SELECT current_database(), version()');
}).then(res => {
  console.log('DB:', res.rows[0]);
  return client.end();
}).catch(err => {
  console.error('Error:', err.message);
});
