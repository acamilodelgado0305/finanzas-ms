import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';

// Obtener todos los gastos
export const getAllExpenses = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los gastos' });
  }
};

// Crear un nuevo gasto
export const createExpense = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      user_id,
      account_id,
      category_id,
      base_amount,
      amount,
      type,
      date,
      note,
      description,
      recurrent = false,
      tax_type = null,
      timerecurrent = null,
      estado = true,
      provider_id = null,
      tax_percentage = null,
      tax_amount = null,
      retention_type = null,
      retention_percentage = null,
      retention_amount = null
    } = req.body;

    // Validations...

    // Update account balance
    const updateAccountQuery = `
      UPDATE accounts 
      SET balance = balance - $1 
      WHERE id = $2 
      RETURNING balance`;

    const accountResult = await client.query(updateAccountQuery, [amount, account_id]);

    if (accountResult.rows.length === 0) {
      throw new Error('Cuenta no encontrada');
    }

    if (accountResult.rows[0].balance < 0) {
      throw new Error('Saldo insuficiente en la cuenta');
    }

    // Insert expense logic...
    const query = `
      INSERT INTO expenses (
        id, user_id, account_id, category_id, base_amount, amount, 
        type, date, note, description, recurrent, tax_type,
        tax_percentage, tax_amount, retention_type, retention_percentage,
        retention_amount, timerecurrent, estado, provider_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamp, $9, $10, $11, 
              $12, $13, $14, $15, $16, $17, $18, $19, $20) 
      RETURNING *`;

    let result;

    if (recurrent && timerecurrent && timerecurrent !== 999999) {
      const transactions = [];
      const baseDate = new Date(date);

      for (let i = 0; i < timerecurrent; i++) {
        const transactionDate = new Date(baseDate);
        transactionDate.setMonth(baseDate.getMonth() + i);

        const values = [
          uuidv4(), user_id, account_id, category_id, base_amount, amount,
          type || '', transactionDate.toISOString(), note || '', description || '',
          recurrent, tax_type, tax_percentage, tax_amount, retention_type,
          retention_percentage, retention_amount, timerecurrent,
          i === 0 ? true : false, provider_id
        ];

        transactions.push(client.query(query, values));
      }

      result = await Promise.all(transactions);
    } else {
      const values = [
        uuidv4(), user_id, account_id, category_id, base_amount, amount,
        type || '', date, note || '', description || '', recurrent,
        tax_type, tax_percentage, tax_amount, retention_type,
        retention_percentage, retention_amount, timerecurrent,
        estado, provider_id
      ];

      result = await client.query(query, values);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: recurrent ? `${timerecurrent} gastos recurrentes creados exitosamente` : 'Gasto creado exitosamente',
      data: recurrent ? result.map(r => r.rows[0]) : result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error en createExpense:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
};

// Obtener un gasto por ID
export const getExpenseById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el gasto' });
  }
};

export const updateExpense = async (req, res) => {
  const { id } = req.params;
  const {
    user_id,
    account_id,
    category_id,
    amount,
    type,
    date,
    note,
    description,
    recurrent,
    tax_type,
    timerecurrent,
    estado,
    provider_id // Nuevo campo
  } = req.body;

  if (!user_id || !account_id || !category_id || !amount || !date) {
    return res.status(400).json({
      error: 'Campos requeridos faltantes',
      details: 'Los campos user_id, account_id, category_id, amount y date son obligatorios'
    });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      error: 'Monto inválido',
      details: 'El monto debe ser un número positivo'
    });
  }

  try {
    const result = await pool.query(
      `UPDATE expenses
      SET user_id = $1, 
          account_id = $2, 
          category_id = $3, 
          amount = $4, 
          type = $5, 
          date = $6, 
          note = $7, 
          description = $8, 
          recurrent = $9, 
          tax_type = $10, 
          timerecurrent = $11, 
          estado = $12,
          provider_id = $13
      WHERE id = $14 RETURNING *`,
      [
        user_id,
        account_id,
        category_id,
        amount,
        type,
        date,
        note,
        description,
        recurrent,
        tax_type,
        timerecurrent,
        estado,
        provider_id || null, // Valor por defecto
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Gasto no encontrado',
        details: `No se encontró ningún gasto con el ID ${id}`
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Gasto actualizado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error en updateExpense:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};


export const deleteExpense = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get expense details before deletion
    const expenseQuery = 'SELECT amount, account_id FROM expenses WHERE id = $1';
    const expenseResult = await client.query(expenseQuery, [id]);

    if (expenseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Gasto no encontrado',
        details: `No se encontró ningún gasto con el ID ${id}`
      });
    }

    const { amount, account_id } = expenseResult.rows[0];

    // Update account balance
    const updateAccountQuery = `
      UPDATE accounts 
      SET balance = balance + $1 
      WHERE id = $2 
      RETURNING *`;

    await client.query(updateAccountQuery, [amount, account_id]);

    // Delete expense
    const deleteResult = await client.query(
      'DELETE FROM expenses WHERE id = $1 RETURNING *',
      [id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      status: 'success',
      message: 'Gasto eliminado exitosamente',
      data: deleteResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error en deleteExpense:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
};