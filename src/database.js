import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Usar UTC en lugar de America/Bogota
  timezone: 'UTC'
});

// Configurar la zona horaria al conectar
pool.on('connect', async (client) => {
  try {
    await client.query("SET TIME ZONE 'UTC';");
    console.log('Conectado a la base de datos PostgreSQL con zona horaria UTC');
  } catch (err) {
    console.error('Error al configurar la zona horaria:', err);
  }
});

pool.on('error', (err) => {
  console.error('Error en la conexión con PostgreSQL', err);
  process.exit(-1);
});

// Función para probar la conexión y verificar la zona horaria
const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('Conexión exitosa a la base de datos PostgreSQL');
    console.log('Hora actual en la base de datos:', result.rows[0].current_time);
  } catch (err) {
    console.error('Error probando la conexión con PostgreSQL', err);
  }
};

testConnection();

export default pool;