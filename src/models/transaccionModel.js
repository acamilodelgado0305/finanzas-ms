import pool from "../database.js";

// Crear una nueva transacción
const createTransaction = async (
  userId,
  accountId,
  categoryId,
  amount,
  type,
  date,
  note,
  description
) => {
  // Iniciar una transacción
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Crear la transacción en la base de datos
    const transactionResult = await client.query(
      `INSERT INTO transactions (user_id, account_id, category_id, amount, type, date, note, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId, accountId, categoryId, amount, type, date, note, description]
    );

    const transaction = transactionResult.rows[0];

    // Verificar si la transacción fue creada correctamente
    if (!transaction) {
      throw new Error("No se pudo crear la transacción");
    }

    // Obtener el saldo actual de la cuenta con un bloqueo de fila
    const accountResult = await client.query(
      `SELECT balance FROM accounts WHERE id = $1 FOR UPDATE`,
      [accountId]
    );

    // Verificar si la cuenta existe
    if (accountResult.rowCount === 0) {
      throw new Error("Cuenta no encontrada");
    }

    let currentBalance = parseFloat(accountResult.rows[0].balance);

    // Actualizar el saldo de la cuenta basado en el tipo de transacción
    if (type === "income") {
      currentBalance += amount;
    } else if (type === "expense") {
      if (currentBalance < amount) {
        throw new Error("Fondos insuficientes para realizar la transacción de gasto");
      }
      currentBalance -= amount;
    } else {
      throw new Error("Tipo de transacción no válido");
    }

    // Guardar el nuevo saldo en la base de datos
    await client.query(`UPDATE accounts SET balance = $1 WHERE id = $2`, [
      currentBalance,
      accountId,
    ]);

    // Confirmar la transacción
    await client.query("COMMIT");
    return transaction;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};



// Obtener todas las transacciones
const getTransactions = async () => {
  const result = await pool.query("SELECT * FROM transactions");
  return result.rows;
};

// Obtener una transacción por su ID
const getTransactionById = async (id) => {
  const result = await pool.query("SELECT * FROM transactions WHERE id = $1", [
    id,
  ]);
  return result.rows[0];
};

// Actualizar una transacción
const updateTransaction = async (
  id,
  userId,
  accountId,
  categoryId,
  amount,
  type,
  date,
  note,
  description
) => {
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
  const result = await pool.query(
    "DELETE FROM transactions WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

export {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction
}
