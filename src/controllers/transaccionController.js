import {
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
  getMonthlyBalanceByMonth
} from "../models/transaccionModel.js";

const createTransactionController = async (req, res) => {
  const {
    userId,
    accountId,
    categoryId,
    amount,
    type,
    date,
    note,
    description,
    recurrent,
  } = req.body;

  // Validación de entrada
  if (!userId || !accountId || !categoryId || !amount || !type || !date) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  if (typeof amount !== "number" || amount <= 0) {
    return res
      .status(400)
      .json({ error: "El monto debe ser un número positivo" });
  }

  if (type !== "income" && type !== "expense") {
    return res
      .status(400)
      .json({ error: 'El tipo de transacción debe ser "income" o "expense"' });
  }

  try {
    const transaction = await createTransaction(
      userId,
      accountId,
      categoryId,
      amount,
      type,
      date,
      note,
      description,
      recurrent,
    );
    res.status(201).json(transaction);
  } catch (err) {
    console.error("Error creando transacción", err);

    // Manejo de errores más específico
    if (err.message === "Cuenta no encontrada") {
      return res.status(404).json({ error: "Cuenta no encontrada" });
    } else if (
      err.message ===
      "Fondos insuficientes para realizar la transacción de gasto"
    ) {
      return res.status(400).json({ error: "Fondos insuficientes" });
    } else if (err.message === "Tipo de transacción no válido") {
      return res.status(400).json({ error: "Tipo de transacción no válido" });
    }

    res.status(500).json({ error: "Error creando transacción" });
  }
};

const getTransactionsController = async (req, res) => {
  try {
    const transactions = await getTransactions();
    res.status(200).json(transactions);
  } catch (err) {
    console.error("Error obteniendo transacciones", err);
    res.status(500).json({ error: "Error obteniendo transacciones" });
  }
};

const getTransactionByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const transaction = await getTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }
    res.status(200).json(transaction);
  } catch (err) {
    console.error("Error obteniendo transacción", err);
    res.status(500).json({ error: "Error obteniendo transacción" });
  }
};

const updateTransactionController = async (req, res) => {
  const { id } = req.params;
  const {
    userId,
    accountId,
    categoryId,
    amount,
    type,
    date,
    note,
    description,
    recurrent,
  } = req.body;
  try {
    const transaction = await updateTransaction(
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
    );
    if (!transaction) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }
    res.status(200).json(transaction);
  } catch (err) {
    console.error("Error actualizando transacción", err);
    res.status(500).json({ error: "Error actualizando transacción" });
  }
};

const deleteTransactionController = async (req, res) => {
  const { id } = req.params;
  try {
    const transaction = await deleteTransaction(id);
    if (!transaction) {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }
    res.status(200).json(transaction);
  } catch (err) {
    console.error("Error eliminando transacción", err);
    res.status(500).json({ error: "Error eliminando transacción" });
  }
};

const getTotalExpensesByDateController = async (req, res) => {
  const { date } = req.params;

  if (!date) {
    return res.status(400).json({ error: "La fecha es obligatoria" });
  }

  try {
    const totalExpenses = await getTotalExpensesByDate(date);
    res.status(200).json({ totalExpenses });
  } catch (err) {
    console.error("Error obteniendo total de gastos", err);
    res.status(500).json({ error: "Error obteniendo total de gastos" });
  }
};

const getTotalIncomeByDateController = async (req, res) => {
  const { date } = req.params;

  if (!date) {
    return res.status(400).json({ error: "La fecha es obligatoria" });
  }

  try {
    const totalIncome = await getTotalIncomeByDate(date);
    res.status(200).json({ totalIncome });
  } catch (err) {
    console.error("Error obteniendo total de ingresos", err);
    res.status(500).json({ error: "Error obteniendo total de ingresos" });
  }
};

const getDailyBalanceByDateController = async (req, res) => {
  const { date } = req.params;

  if (!date) {
    return res.status(400).json({ error: "La fecha es obligatoria" });
  }

  try {
    const balance = await getDailyBalanceByDate(date);
    res.status(200).json({ balance });
  } catch (err) {
    console.error("Error obteniendo balance diario", err);
    res.status(500).json({ error: "Error obteniendo balance diario" });
  }
};

const getTotalExpensesByMonthController = async (req, res) => {
  const { month } = req.params;

  if (!month) {
    return res.status(400).json({ error: "El mes es obligatorio" });
  }

  try {
    const totalExpenses = await getTotalExpensesByMonth(month);
    res.status(200).json({ totalExpenses });
  } catch (err) {
    console.error("Error obteniendo total de gastos del mes", err);
    res.status(500).json({ error: "Error obteniendo total de gastos del mes" });
  }
};

const getTotalIncomeByMonthController = async (req, res) => {
  const { month } = req.params;

  if (!month) {
    return res.status(400).json({ error: "El mes es obligatorio" });
  }

  try {
    const totalIncome = await getTotalIncomeByMonth(month);
    res.status(200).json({ totalIncome });
  } catch (err) {
    console.error("Error obteniendo total de ingresos del mes", err);
    res.status(500).json({ error: "Error obteniendo total de ingresos del mes" });
  }
};

const getMonthlyBalanceByMonthController = async (req, res) => {
  const { month } = req.params;

  if (!month) {
    return res.status(400).json({ error: "El mes es obligatorio" });
  }

  try {
    const balance = await getMonthlyBalanceByMonth(month);
    res.status(200).json({ balance });
  } catch (err) {
    console.error("Error obteniendo balance mensual", err);
    res.status(500).json({ error: "Error obteniendo balance mensual" });
  }
};

export {
  createTransactionController,
  getTransactionsController,
  getTransactionByIdController,
  updateTransactionController,
  deleteTransactionController,
  getTotalExpensesByDateController,
  getTotalIncomeByDateController,
  getDailyBalanceByDateController,
  getTotalExpensesByMonthController,
  getTotalIncomeByMonthController,
  getMonthlyBalanceByMonthController,
};

