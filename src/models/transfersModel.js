import pool from "../database.js";

const createTransfer = async (
  userId,
  fromAccountId,
  toAccountId,
  amount,
  note,
  description
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Debitar de la cuenta de origen
    const debitResult = await client.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING *",
      [amount, fromAccountId]
    );

    if (debitResult.rowCount === 0) {
      throw new Error("Cuenta de origen no encontrada");
    }

    // Acreditar a la cuenta de destino
    const creditResult = await client.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2 RETURNING *",
      [amount, toAccountId]
    );

    if (creditResult.rowCount === 0) {
      throw new Error("Cuenta de destino no encontrada");
    }

    // Registrar la transferencia
    const transferResult = await client.query(
      "INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, note, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [userId, fromAccountId, toAccountId, amount, note, description]
    );

    await client.query("COMMIT");
    return transferResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const getTransfers = async () => {
  const result = await pool.query("SELECT * FROM transfers");
  return result.rows;
};

const getTransferById = async (id) => {
  const result = await pool.query("SELECT * FROM transfers WHERE id = $1", [
    id,
  ]);
  return result.rows[0];
};

const updateTransfer = async (
  id,
  userId,
  fromAccountId,
  toAccountId,
  amount,
  date,
  note,
  description
) => {
  const result = await pool.query(
    `UPDATE transfers SET user_id = $1, from_account_id = $2, to_account_id = $3, amount = $4, date = $5, note = $6, description = $7
     WHERE id = $8 RETURNING *`,
    [userId, fromAccountId, toAccountId, amount, date, note, description, id]
  );
  return result.rows[0];
};

const deleteTransfer = async (id) => {
  const result = await pool.query(
    "DELETE FROM transfers WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

export {
  createTransfer,
  getTransfers,
  getTransferById,
  updateTransfer,
  deleteTransfer,
};
