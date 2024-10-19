import pool from "../database.js";

// Crear un pago pendiente
const createPagoPending = async (descripcion, amount, date, favorite) => {
  const result = await pool.query(
    'INSERT INTO pagospending (descripcion, amount, date, favorite) VALUES ($1, $2, $3, $4) RETURNING *',
    [descripcion, amount, date, favorite]
  );
  return result.rows[0];
};

// Obtener todos los pagos pendientes
const getAllPagosPending = async () => {
  const result = await pool.query('SELECT * FROM pagospending');
  return result.rows;
};

// Obtener un pago pendiente por ID
const getPagoPendingById = async (id) => {
  const result = await pool.query('SELECT * FROM pagospending WHERE id = $1', [id]);
  return result.rows[0];
};

// Actualizar un pago pendiente
const updatePagoPending = async (id, descripcion, amount, date, favorite) => {
  const result = await pool.query(
    'UPDATE pagospending SET descripcion = $1, amount = $2, date = $3, favorite = $4 WHERE id = $5 RETURNING *',
    [descripcion, amount, date, favorite, id]
  );
  return result.rows[0];
};

// Eliminar un pago pendiente
const deletePagoPending = async (id) => {
  const result = await pool.query('DELETE FROM pagospending WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

export { createPagoPending, getAllPagosPending, getPagoPendingById, updatePagoPending, deletePagoPending };
