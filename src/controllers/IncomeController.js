import pool from '../database.js';

// Obtener todos los ingresos
export const getAllIncomes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incomes');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los ingresos' });
  }
};

// Crear un nuevo ingreso
export const createIncome = async (req, res) => {
  const { user_id, account_id, category_id, amount, type, date, note, description, recurrent, tax_type, timecurrent, estado } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO incomes (user_id, account_id, category_id, amount, type, date, note, description, recurrent, tax_type, timecurrent, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [user_id, account_id, category_id, amount, type, date, note, description, recurrent, tax_type, timecurrent, estado]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear el ingreso' });
  }
};

// Obtener un ingreso por ID
export const getIncomeById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM incomes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingreso no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el ingreso' });
  }
};

// Actualizar un ingreso
export const updateIncome = async (req, res) => {
  const { id } = req.params;
  const { user_id, account_id, category_id, amount, type, date, note, description, recurrent, tax_type, timecurrent, estado } = req.body;
  try {
    const result = await pool.query(
      `UPDATE incomes
      SET user_id = $1, account_id = $2, category_id = $3, amount = $4, type = $5, date = $6, note = $7, description = $8,
      recurrent = $9, tax_type = $10, timecurrent = $11, estado = $12
      WHERE id = $13 RETURNING *`,
      [user_id, account_id, category_id, amount, type, date, note, description, recurrent, tax_type, timecurrent, estado, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingreso no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el ingreso' });
  }
};

// Eliminar un ingreso
export const deleteIncome = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM incomes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingreso no encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el ingreso' });
  }
};
