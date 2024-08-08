import pool from '../database.js';

const createAccount = async (userId, name, balance) => {
  const result = await pool.query(
    'INSERT INTO accounts (user_id, name, balance) VALUES ($1, $2, $3) RETURNING *',
    [userId, name, balance]
  );
  return result.rows[0];
};

const getAccounts = async () => {
  const result = await pool.query('SELECT * FROM accounts');
  return result.rows;
};

const getAccountById = async (id) => {
  const result = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
  return result.rows[0];
};

const updateAccount = async (id, name, balance) => {
  const result = await pool.query(
    'UPDATE accounts SET name = $1, balance = $2 WHERE id = $3 RETURNING *',
    [name, balance, id]
  );
  return result.rows[0];
};

const deleteAccount = async (id) => {
  const result = await pool.query('DELETE FROM accounts WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

export { createAccount, getAccounts, getAccountById, updateAccount, deleteAccount };
