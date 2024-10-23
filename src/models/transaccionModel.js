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
  tax_type,
  timerecurrent
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createSingleTransaction = async (transactionDate, isOriginal = false) => {
      const { rows } = await client.query(
        `INSERT INTO transactions 
         (user_id, account_id, category_id, amount, type, date, note, description, recurrent, tax_type, estado, timerecurrent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
         RETURNING *`,
        [userId, accountId, categoryId, amount, type, transactionDate, note, description, recurrent, tax_type, isOriginal, timerecurrent]
      );

      if (rows.length === 0) {
        throw new Error("No se pudo crear la transacción");
      }

      return rows[0];
    };

    const updateAccountBalance = async () => {
      const { rows } = await client.query(
        "SELECT balance FROM accounts WHERE id = $1 FOR UPDATE",
        [accountId]
      );

      if (rows.length === 0) {
        throw new Error("Cuenta no encontrada");
      }

      let currentBalance = parseFloat(rows[0].balance);

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

      await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [currentBalance, accountId]);
    };

    const transaction = await createSingleTransaction(date, true);
    await updateAccountBalance();

    if (recurrent && timerecurrent > 0) {
      const createRecurrentTransactions = async () => {
        const promises = Array.from({ length: timerecurrent }, (_, i) => {
          const nextDate = new Date(date);
          nextDate.setMonth(nextDate.getMonth() + i + 1);
          return createSingleTransaction(nextDate);
        });

        await Promise.all(promises);
      };

      await createRecurrentTransactions();
    }

    await client.query("COMMIT");
    return transaction;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
//----------------------------------- Obtener todas las transacciones
const getTransactions = async () => {
  const result = await pool.query("SELECT * FROM transactions");
  return result.rows;
};

// Obtener todas las transacciones con estado false
const getTransactionsByEstadoFalse = async () => {
  const result = await pool.query(
    "SELECT * FROM transactions WHERE estado = false"
  );
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
  tax_type,
  estado,       // Añadido
  timerecurrent // Añadido
) => {
  const result = await pool.query(
    `UPDATE transactions
     SET user_id = $1, account_id = $2, category_id = $3, amount = $4, type = $5, date = $6, note = $7, description = $8, recurrent = $9, tax_type = $10, estado = $11, timerecurrent = $12
     WHERE id = $13 RETURNING *`,
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
      tax_type,
      estado,          // Añadido
      timerecurrent,   // Añadido
      id
    ]
  );
  return result.rows[0];
};


//--------------------------------ELIMINAR TRANSACCION--------------------------------------------//

const deleteTransaction = async (id) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Obtener la información de la transacción
    const transactionResult = await client.query(
      "SELECT * FROM transactions WHERE id = $1",
      [id]
    );

    if (transactionResult.rows.length === 0) {
      throw new Error("Transacción no encontrada");
    }

    const transaction = transactionResult.rows[0];

    // Si la transacción es un gasto, devolver el dinero a la cuenta
    if (transaction.type === "expense") {
      const accountResult = await client.query(
        "SELECT balance FROM accounts WHERE id = $1 FOR UPDATE",
        [transaction.account_id]
      );

      if (accountResult.rows.length === 0) {
        throw new Error("Cuenta no encontrada");
      }

      const currentBalance = parseFloat(accountResult.rows[0].balance);
      const newBalance = currentBalance + parseFloat(transaction.amount); // Asegurar que `transaction.amount` sea un número

      await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [
        newBalance,
        transaction.account_id,
      ]);
    }

    // Eliminar la transacción
    const deleteResult = await client.query(
      "DELETE FROM transactions WHERE id = $1 RETURNING *",
      [id]
    );

    await client.query("COMMIT");
    return deleteResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
  getTransactionsByEstadoFalse
};
