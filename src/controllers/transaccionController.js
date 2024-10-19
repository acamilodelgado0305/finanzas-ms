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
  getMonthlyBalanceByMonth,
  getTransactionsByEstadoFalse,
} from "../models/transaccionModel.js";


//-----------------------------------CREATE TRANSACCION CONTROLLER---------------------------------------

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
    tax_type,
    timerecurrent
  } = req.body;

  // Validación de entrada
  const requiredFields = ['userId', 'accountId', 'categoryId', 'amount', 'type', 'date'];
  const missingFields = requiredFields.filter(field => !req.body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({ error: `Campos faltantes: ${missingFields.join(', ')}` });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: "El monto debe ser un número positivo" });
  }

  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'El tipo de transacción debe ser "income" o "expense"' });
  }

  if (recurrent && (!timerecurrent || typeof timerecurrent !== 'number' || timerecurrent <= 0)) {
    return res.status(400).json({ error: "Para transacciones recurrentes, timerecurrent debe ser un número positivo" });
  }

  try {
    const transaction = await createTransaction(
      userId,
      accountId,
      categoryId,
      amount,
      type,
      new Date(date),
      note,
      description,
      recurrent,
      tax_type,
      timerecurrent
    );
    res.status(201).json(transaction);
  } catch (err) {
    console.error("Error creando transacción", err);

    const errorMessages = {
      "Cuenta no encontrada": { status: 404, message: "Cuenta no encontrada" },
      "Fondos insuficientes para realizar la transacción de gasto": { status: 400, message: "Fondos insuficientes" },
      "Tipo de transacción no válido": { status: 400, message: "Tipo de transacción no válido" },
      "No se pudo crear la transacción": { status: 500, message: "Error al crear la transacción" }
    };

    const error = errorMessages[err.message] || { status: 500, message: "Error interno del servidor" };
    res.status(error.status).json({ error: error.message });
  }
};

//----------------GET TARNSACTIONS CONTROLLER------------------------

const getTransactionsController = async (req, res) => {
  try {
    const transactions = await getTransactions();
    res.status(200).json(transactions);
  } catch (err) {
    console.error("Error obteniendo transacciones", err);
    res.status(500).json({ error: "Error obteniendo transacciones" });
  }
};


const getTransactionsControllerEstadoFalse = async (req, res) => {
  try {
    const transactionsFalse = await getTransactionsByEstadoFalse();
    res.status(200).json(transactionsFalse);
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

//-------------------------------------UPDATE TRANSACCION CONTROLLER-------------------------------------

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
    tax_type
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
      tax_type
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
    res.status(200).json(transaction); // Si todo está bien, devuelves la transacción eliminada
  } catch (err) {
    if (err.message === 'Transacción no encontrada') {
      return res.status(404).json({ error: "Transacción no encontrada" });
    }
    if (err.message === 'Cuenta no encontrada') {
      return res.status(404).json({ error: "Cuenta no encontrada" });
    }
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
  getTransactionsControllerEstadoFalse
};

