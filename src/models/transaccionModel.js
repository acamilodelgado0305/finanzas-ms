import pool from '../database.js';

// Crear una nueva transacción
const createTransaction = async (userId, accountId, categoryId, amount, type, date, note, description) => {
  const result = await pool.query(
    `INSERT INTO transactions (user_id, account_id, category_id, amount, type, date, note, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [userId, accountId, categoryId, amount, type, date, note, description]
  );
  return result.rows[0];
};

// Obtener todas las transacciones
const getTransactions = async () => {
  const result = await pool.query('SELECT * FROM transactions');
  return result.rows;
};

// Obtener una transacción por su ID
const getTransactionById = async (id) => {
  const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
  return result.rows[0];
};

// Actualizar una transacción
const updateTransaction = async (id, userId, accountId, categoryId, amount, type, date, note, description) => {
  const result = await pool.query(
    `UPDATE transactions
     SET user_id = $1, account_id = $2, category_id = $3, amount = $4, type = $5, date = $6, note = $7, description = $8
     WHERE id = $9 RETURNING *`,
    [userId, accountId, categoryId, amount, type, date, note, description, id]
  );
  return result.rows[0];
};

// Eliminar una transacción
const deleteTransaction = async (id) => {
  const result = await pool.query('DELETE FROM transactions WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

export { createTransaction, getTransactions, getTransactionById, updateTransaction, deleteTransaction };
