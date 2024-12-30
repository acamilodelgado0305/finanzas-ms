import pool from "../database.js";

const createTransfer = async (
  userId,
  fromAccountId,
  toAccountId,
  amount,
  vouchers,
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
      "INSERT INTO transfers (user_id, from_account_id, to_account_id, amount,vouchers , description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [userId, fromAccountId, toAccountId, amount, vouchers, description]
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
  vouchers,

  description
) => {
  const result = await pool.query(
    `UPDATE transfers SET user_id = $1, from_account_id = $2, to_account_id = $3, amount = $4, date = $5, vouchers = $6, description = $7
     WHERE id = $8 RETURNING *`,
    [userId, fromAccountId, toAccountId, amount, date, vouchers, description, id]
  );
  return result.rows[0];
};

const deleteTransfer = async (id) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Obtener la transferencia a eliminar
    const transferResult = await client.query(
      "SELECT * FROM transfers WHERE id = $1",
      [id]
    );

    const transfer = transferResult.rows[0];

    if (!transfer) {
      throw new Error("Transferencia no encontrada");
    }

    const { from_account_id, to_account_id, amount } = transfer;

    // Revertir el débito en la cuenta de origen (devolver el dinero)
    const revertDebit = await client.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2 RETURNING *",
      [amount, from_account_id]
    );

    if (revertDebit.rowCount === 0) {
      throw new Error("Cuenta de origen no encontrada");
    }

    // Revertir el crédito en la cuenta de destino (retirar el dinero)
    const revertCredit = await client.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING *",
      [amount, to_account_id]
    );

    if (revertCredit.rowCount === 0) {
      throw new Error("Cuenta de destino no encontrada");
    }

    // Eliminar la transferencia
    const deleteResult = await client.query(
      "DELETE FROM transfers WHERE id = $1 RETURNING *",
      [id]
    );

    await client.query("COMMIT");
    return deleteResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export {
  createTransfer,
  getTransfers,
  getTransferById,
  updateTransfer,
  deleteTransfer,
};
