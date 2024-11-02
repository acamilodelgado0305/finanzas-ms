import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';

// Obtener todos los ingresos
export const getAllIncomes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incomes');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los ingresos' });
  }
};


export const createIncome = async (req, res) => {
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
      INSERT INTO incomes (
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
      message: 'Ingreso creado exitosamente',
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
  try {
    const { id } = req.params;

    // Verificar si el ID es válido
    if (!id) {
      return res.status(400).json({
        error: 'ID inválido',
        details: 'Se requiere un ID válido para actualizar el ingreso'
      });
    }

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

    // Validar que el ingreso existe antes de actualizarlo
    const existingIncome = await pool.query(
      'SELECT * FROM incomes WHERE id = $1',
      [id]
    );

    if (existingIncome.rows.length === 0) {
      return res.status(404).json({
        error: 'Ingreso no encontrado',
        details: `No se encontró un ingreso con el ID: ${id}`
      });
    }

    // Construir la consulta dinámicamente solo con los campos proporcionados
    let updateFields = [];
    let values = [];
    let parameterIndex = 1;

    const fieldMappings = {
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
    };

    for (const [field, value] of Object.entries(fieldMappings)) {
      if (value !== undefined) {
        updateFields.push(`${field} = $${parameterIndex}`);
        values.push(value);
        parameterIndex++;
      }
    }

    values.push(id); // Añadir el ID al final del array de valores

    const query = `
      UPDATE incomes 
      SET ${updateFields.join(', ')}
      WHERE id = $${parameterIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    // Verificar si la actualización fue exitosa
    if (result.rows.length > 0) {
      res.status(200).json({
        message: 'Ingreso actualizado exitosamente',
        data: result.rows[0]
      });
    } else {
      throw new Error('Error al actualizar el ingreso');
    }

  } catch (error) {
    console.error('Error en updateIncome:', error);

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

    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Error de referencia',
        details: 'Una o más referencias (user_id, account_id, category_id) no existen'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

// Eliminar un ingreso
export const deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar que se proporcione un ID
    if (!id) {
      return res.status(400).json({
        error: 'ID no proporcionado',
        details: 'Se requiere un ID válido para eliminar el ingreso'
      });
    }

    // Verificar si el ingreso existe antes de intentar eliminarlo
    const checkExists = await pool.query(
      'SELECT * FROM incomes WHERE id = $1',
      [id]
    );

    if (checkExists.rows.length === 0) {
      return res.status(404).json({
        error: 'Ingreso no encontrado',
        details: `No se encontró un ingreso con el ID: ${id}`
      });
    }

    // Realizar la eliminación
    const result = await pool.query(
      'DELETE FROM incomes WHERE id = $1 RETURNING *',
      [id]
    );

    // Enviar respuesta con los datos del registro eliminado
    res.status(200).json({
      message: 'Ingreso eliminado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error en deleteIncome:', error);

    // Manejar diferentes tipos de errores
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Conflicto de eliminación',
        details: 'No se puede eliminar el ingreso porque tiene registros relacionados'
      });
    }

    if (error.code === '22P02') {
      return res.status(400).json({
        error: 'ID inválido',
        details: 'El formato del ID proporcionado no es válido'
      });
    }

    // Error general
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
