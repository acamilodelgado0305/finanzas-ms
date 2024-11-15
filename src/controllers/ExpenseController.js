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
      recurrent = false,
      tax_type = 'IVA',
      timerecurrent = null,
      estado = false,
      provider_id = null
    } = req.body;

    const id = uuidv4();

    // Validación de campos requeridos
    if (!user_id || !account_id || !category_id || !amount || !date) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos user_id, account_id, category_id, amount y date son obligatorios'
      });
    }

    // Validación del monto
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Monto inválido',
        details: 'El monto debe ser un número positivo'
      });
    }

    // Validación del formato de fecha (opcional)
    if (isNaN(Date.parse(date))) {
      return res.status(400).json({
        error: 'Fecha inválida',
        details: 'El formato de fecha debe ser válido'
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
        estado,
        provider_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8, $9, $10, $11, $12, $13, $14) 
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
      recurrent,
      tax_type,
      timerecurrent,
      estado,
      provider_id
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      message: 'Gasto creado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error en createExpense:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}

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
  const { id } = req.params;

  // Validación de entrada
  if (!id) {
    return res.status(400).json({
      error: 'ID faltante',
      details: 'Se requiere un ID para eliminar un gasto'
    });
  }

  try {
    const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);

    // Verificación si el gasto existe
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Gasto no encontrado',
        details: `No se encontró ningún gasto con el ID ${id}`
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Gasto eliminado exitosamente',
      data: result.rows[0] // Opcional, puede ser útil para confirmar el objeto eliminado
    });

  } catch (error) {
    console.error('Error en deleteExpense:', error);

    // Manejo de errores específicos de PostgreSQL
    if (error.code === '23503') { // Error de referencia de clave foránea
      return res.status(409).json({
        error: 'Conflicto de dependencia',
        details: 'Este gasto no puede ser eliminado porque está referenciado en otras tablas'
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};
