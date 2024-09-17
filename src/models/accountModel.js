import pool from "../database.js";

const createAccount = async (name, balance, type, plus) => {
  const result = await pool.query(
    'INSERT INTO accounts (name, balance, type, plus) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, balance, type, plus]
  );
  return result.rows[0];
};

const getAccounts = async () => {
  const result = await pool.query("SELECT * FROM accounts");
  return result.rows;
};

const getAccountById = async (id) => {
  const result = await pool.query("SELECT * FROM accounts WHERE id = $1", [id]);
  return result.rows[0];
};

const updateAccount = async (id, name, balance, type, plus) => {
  const result = await pool.query(
    "UPDATE accounts SET name = $1, balance = $2, type = $3, plus = $4 WHERE id = $5 RETURNING *",
    [name, balance, type, plus, id]
  );
  return result.rows[0];
};


const deleteAccount = async (id) => {
  const result = await pool.query(
    "DELETE FROM accounts WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

const getTotalBalance = async () => {
  const result = await pool.query(
    "SELECT SUM(balance) AS total_balance FROM accounts WHERE plus = TRUE"
  );
  return result.rows[0].total_balance;
};

export {
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  getTotalBalance,
};
