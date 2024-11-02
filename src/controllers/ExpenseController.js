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
  try {
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
      estado
    } = req.body;

    // Generar UUID
    const id = uuidv4();

    // Validación de campos requeridos
    if (!user_id || !account_id || !category_id || !amount || !date) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos user_id, account_id, category_id, amount y date son obligatorios'
      });
    }

    // Validación de amount
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Monto inválido',
        details: 'El monto debe ser un número positivo'
      });
    }

    const query = `
      INSERT INTO expenses (
        id,
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
        estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8, $9, $10, $11, $12, $13) 
      RETURNING *`;

    const values = [
      id,
      user_id,
      account_id,
      category_id,
      amount,
      type || '',
      date,
      note || '',
      description || '',
      recurrent || false,
      tax_type || 'IVA',
      timerecurrent || null,
      estado || false
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      message: 'Gasto creado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error en createExpense:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Conflicto',
        details: 'Ya existe un registro con estos datos'
      });
    }

    if (error.code === '22007') {
      return res.status(400).json({
        error: 'Formato de fecha inválido',
        details: 'El formato de la fecha no es válido'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
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

// Actualizar un gasto
export const updateExpense = async (req, res) => {
  const { id } = req.params;
  const { user_id, account_id, category_id, amount, type, date, note, description, recurrent, tax_type, timerecurrent, estado } = req.body;
  try {
    const result = await pool.query(
      `UPDATE expenses
      SET user_id = $1, account_id = $2, category_id = $3, amount = $4, type = $5, date = $6, note = $7, description = $8,
      recurrent = $9, tax_type = $10, timerecurrent = $11, estado = $12
      WHERE id = $13 RETURNING *`,
      [user_id, account_id, category_id, amount, type, date, note, description, recurrent, tax_type, timerecurrent, estado, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el gasto' });
  }
};

// Eliminar un gasto
export const deleteExpense = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el gasto' });
  }
};
