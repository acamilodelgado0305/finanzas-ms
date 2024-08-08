import {
    createTransaction,
    getTransactions,
    getTransactionById,
    updateTransaction,
    deleteTransaction
  } from '../models/transaccionModel.js';
  
  const createTransactionController = async (req, res) => {
    const { userId, accountId, categoryId, amount, type, date, note, description } = req.body;
    try {
      const transaction = await createTransaction(userId, accountId, categoryId, amount, type, date, note, description);
      res.status(201).json(transaction);
    } catch (err) {
      console.error('Error creando transacción', err);
      res.status(500).json({ error: 'Error creando transacción' });
    }
  };
  
  const getTransactionsController = async (req, res) => {
    try {
      const transactions = await getTransactions();
      res.status(200).json(transactions);
    } catch (err) {
      console.error('Error obteniendo transacciones', err);
      res.status(500).json({ error: 'Error obteniendo transacciones' });
    }
  };
  
  const getTransactionByIdController = async (req, res) => {
    const { id } = req.params;
    try {
      const transaction = await getTransactionById(id);
      if (!transaction) {
        return res.status(404).json({ error: 'Transacción no encontrada' });
      }
      res.status(200).json(transaction);
    } catch (err) {
      console.error('Error obteniendo transacción', err);
      res.status(500).json({ error: 'Error obteniendo transacción' });
    }
  };
  
  const updateTransactionController = async (req, res) => {
    const { id } = req.params;
    const { userId, accountId, categoryId, amount, type, date, note, description } = req.body;
    try {
      const transaction = await updateTransaction(id, userId, accountId, categoryId, amount, type, date, note, description);
      if (!transaction) {
        return res.status(404).json({ error: 'Transacción no encontrada' });
      }
      res.status(200).json(transaction);
    } catch (err) {
      console.error('Error actualizando transacción', err);
      res.status(500).json({ error: 'Error actualizando transacción' });
    }
  };
  
  const deleteTransactionController = async (req, res) => {
    const { id } = req.params;
    try {
      const transaction = await deleteTransaction(id);
      if (!transaction) {
        return res.status(404).json({ error: 'Transacción no encontrada' });
      }
      res.status(200).json(transaction);
    } catch (err) {
      console.error('Error eliminando transacción', err);
      res.status(500).json({ error: 'Error eliminando transacción' });
    }
  };
  
  export {
    createTransactionController,
    getTransactionsController,
    getTransactionByIdController,
    updateTransactionController,
    deleteTransactionController
  };
  