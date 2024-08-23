import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
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
      description
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
      description
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

export {
  createTransactionController,
  getTransactionsController,
  getTransactionByIdController,
  updateTransactionController,
  deleteTransactionController,
};
