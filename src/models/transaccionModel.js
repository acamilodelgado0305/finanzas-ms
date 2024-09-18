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
  description,
  recurrent,
  tax_type
) => {
  // Iniciar una transacción
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

 //-----------------------------------------------------------CREAR TRANSACCION-----------------------------------------------//
 
    const transactionResult = await client.query(
      `INSERT INTO transactions (user_id, account_id, category_id, amount, type, date, note, description, recurrent, tax_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        userId,
        accountId,
        categoryId,
        amount,
        type,
        date,
        note,
        description,
        recurrent,
        tax_type
      ]
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
        throw new Error(
          "Fondos insuficientes para realizar la transacción de gasto"
        );
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

//----------------------------------------- ACTUALIZAR TRANSACCION--------------------------------------------------------------//
const updateTransaction = async (
  id,
  userId,
  accountId,
  categoryId,
  amount,
  type,
  date,
  note,
  description,
  recurrent,
  tax_type
) => {
  const result = await pool.query(
    `UPDATE transactions
     SET user_id = $1, account_id = $2, category_id = $3, amount = $4, type = $5, date = $6, note = $7, description = $8, recurrent = $9, tax_type = $10
     WHERE id = $11 RETURNING *`,
    [
      userId,
      accountId,
      categoryId,
      amount,
      type,
      date,
      note,
      description,
      recurrent,
      id,
      tax_type
     
    ]
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
const getTotalExpensesByDate = async (date) => {
  const result = await pool.query(
    `SELECT SUM(amount) AS total_expenses 
     FROM transactions 
     WHERE type = 'expense' AND date::date = $1::date`,
    [date]
  );
  return result.rows[0].total_expenses || 0; // Devolver 0 si no hay gastos
};

const getTotalIncomeByDate = async (date) => {
  const result = await pool.query(
    `SELECT SUM(amount) AS total_income 
     FROM transactions 
     WHERE type = 'income' AND date::date = $1::date`,
    [date]
  );
  return result.rows[0].total_income || 0; // Devolver 0 si no hay ingresos
};
const getDailyBalanceByDate = async (date) => {
  const totalIncome = await getTotalIncomeByDate(date);
  const totalExpenses = await getTotalExpensesByDate(date);

  return totalIncome - totalExpenses;
};

const getTotalExpensesByMonth = async (month) => {
  const result = await pool.query(
    `SELECT SUM(amount) AS total_expenses 
     FROM transactions 
     WHERE type = 'expense' AND to_char(date, 'YYYY-MM') = $1`,
    [month]
  );
  return result.rows[0].total_expenses || 0; // Devolver 0 si no hay gastos
};

const getTotalIncomeByMonth = async (month) => {
  const result = await pool.query(
    `SELECT SUM(amount) AS total_income 
     FROM transactions 
     WHERE type = 'income' AND to_char(date, 'YYYY-MM') = $1`,
    [month]
  );
  return result.rows[0].total_income || 0; // Devolver 0 si no hay ingresos
};

const getMonthlyBalanceByMonth = async (month) => {
  const totalIncome = await getTotalIncomeByMonth(month);
  const totalExpenses = await getTotalExpensesByMonth(month);

  return totalIncome - totalExpenses;
};

export {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTotalExpensesByDate,
  getTotalIncomeByDate,
  getDailyBalanceByDate,
  getTotalExpensesByMonth,
  getTotalIncomeByMonth,
  getMonthlyBalanceByMonth,
};
