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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      user_id,
      account_id,
      category_id,
      amount,
      type,
      date,
      note,
      description,
      estado,
      amountfev,
      amountdiverse
    } = req.body;

    // Generar UUID para el ingreso
    const id = uuidv4();

    // Validación de campos requeridos básicos
    if (!user_id || !account_id || !category_id || !date) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos user_id, account_id, category_id y date son obligatorios'
      });
    }

    // Verificar que la cuenta existe y obtener su balance actual
    const accountQuery = 'SELECT balance FROM accounts WHERE id = $1';
    const accountResult = await client.query(accountQuery, [account_id]);

    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cuenta inválida',
        details: 'La cuenta especificada no existe'
      });
    }

    const currentBalance = parseFloat(accountResult.rows[0].balance) || 0;

    // Obtener la categoría y verificar que sea de tipo 'income'
    const categoryQuery = 'SELECT name, type FROM categories WHERE id = $1';
    const categoryResult = await client.query(categoryQuery, [category_id]);

    if (categoryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Categoría inválida',
        details: 'La categoría especificada no existe'
      });
    }

    const { name: categoryName, type: categoryType } = categoryResult.rows[0];

    if (categoryType !== 'income') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Categoría no válida',
        details: 'La categoría debe ser de tipo income'
      });
    }

    let finalAmount;

    // Validación según el tipo de categoría
    if (categoryName.toLowerCase() === 'arqueo') {
      if (amountfev === undefined || amountdiverse === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Campos requeridos faltantes',
          details: 'Para la categoría Arqueo, los campos amountfev y amountdiverse son obligatorios'
        });
      }

      if (typeof amountfev !== 'number' || typeof amountdiverse !== 'number') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Montos inválidos',
          details: 'Los montos FEV y Diverso deben ser números'
        });
      }

      finalAmount = amountfev + amountdiverse;

    } else if (categoryName.toLowerCase() === 'venta') {
      if (!amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Campo requerido faltante',
          details: 'Para la categoría Venta, el campo amount es obligatorio'
        });
      }

      if (typeof amount !== 'number' || amount <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Monto inválido',
          details: 'El monto debe ser un número positivo'
        });
      }

      finalAmount = amount;
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Categoría no válida',
        details: 'La categoría debe ser Arqueo o Venta'
      });
    }

    // Actualizar el balance de la cuenta
    const newBalance = currentBalance + finalAmount;
    const updateAccountQuery = 'UPDATE accounts SET balance = $1 WHERE id = $2';
    await client.query(updateAccountQuery, [newBalance, account_id]);

    // Crear el ingreso
    const createIncomeQuery = `
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
        estado,
        amountfev,
        amountdiverse
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8, $9, $10, $11, $12) 
      RETURNING *`;

    const values = [
      id,
      user_id,
      account_id,
      category_id,
      finalAmount,
      type || '',
      date,
      note || '',
      description || '',
      estado || false,
      categoryName.toLowerCase() === 'arqueo' ? amountfev : 0,
      categoryName.toLowerCase() === 'arqueo' ? amountdiverse : 0
    ];

    const result = await client.query(createIncomeQuery, values);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Ingreso creado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en createIncome:', error);

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
  } finally {
    client.release();
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

export const updateIncome = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    // Verificar si el ID es válido
    if (!id) {
      return res.status(400).json({
        error: 'ID inválido',
        details: 'Se requiere un ID válido para actualizar el ingreso',
      });
    }

    const {
      user_id,
      account_id,
      category_id,
      amount,
      type,
      date,
      note, // URLs de nuevas imágenes
      description,
      recurrent,
      tax_type,
      timerecurrent,
      estado,
      amountfev,
      amountdiverse,
    } = req.body;

    // Validación de campos requeridos
    if (!user_id || !account_id || !category_id || !amount || !date) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos user_id, account_id, category_id, amount y date son obligatorios',
      });
    }

    // Validación de amount
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Monto inválido',
        details: 'El monto debe ser un número positivo',
      });
    }

    // Validar que el ingreso existe antes de actualizarlo
    const existingIncome = await client.query(
      'SELECT * FROM incomes WHERE id = $1',
      [id]
    );

    if (existingIncome.rows.length === 0) {
      return res.status(404).json({
        error: 'Ingreso no encontrado',
        details: `No se encontró un ingreso con el ID: ${id}`,
      });
    }

    // Manejo de eliminación de imágenes previas si cambió el campo `note`
    const previousNote = existingIncome.rows[0].note;

    if (previousNote && previousNote.trim() && note !== previousNote) {
      const previousImages = previousNote.trim().split("\n");
      // Aquí podrías implementar una función para eliminar imágenes del servidor/CDN
      console.log("Eliminando imágenes previas:", previousImages);
      // deleteImagesFromServer(previousImages); // Implementa esta función según tu almacenamiento
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
      estado,
      amountfev,
      amountdiverse,
    };

    for (const [field, value] of Object.entries(fieldMappings)) {
      if (value !== undefined) {
        updateFields.push(`${field} = $${parameterIndex}`);
        values.push(value);
        parameterIndex++;
      }
    }

    values.push(id);

    const query = `
      UPDATE incomes 
      SET ${updateFields.join(', ')}
      WHERE id = $${parameterIndex}
      RETURNING *
    `;

    const result = await client.query(query, values);

    // Verificar si la actualización fue exitosa
    if (result.rows.length > 0) {
      res.status(200).json({
        message: 'Ingreso actualizado exitosamente',
        data: result.rows[0],
      });
    } else {
      throw new Error('Error al actualizar el ingreso');
    }
  } catch (error) {
    console.error('Error en updateIncome:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Conflicto',
        details: 'Ya existe un registro con estos datos',
      });
    }

    if (error.code === '22007') {
      return res.status(400).json({
        error: 'Formato de fecha inválido',
        details: 'El formato de la fecha no es válido',
      });
    }

    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Error de referencia',
        details: 'Una o más referencias (user_id, account_id, category_id) no existen',
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  } finally {
    client.release();
  }
};


// -----------------------------------------Eliminar un ingreso----------------------------------------//
export const deleteIncome = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'ID no proporcionado',
        details: 'Se requiere un ID válido para eliminar el ingreso'
      });
    }

    // 1. Primero obtener el ingreso y verificar que existe
    const incomeQuery = 'SELECT * FROM incomes WHERE id = $1';
    const incomeResult = await client.query(incomeQuery, [id]);

    if (incomeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Ingreso no encontrado',
        details: `No se encontró un ingreso con el ID: ${id}`
      });
    }

    const income = incomeResult.rows[0];
    const { amount, account_id } = income;

    // 2. Obtener el balance actual de la cuenta
    const accountQuery = 'SELECT balance FROM accounts WHERE id = $1';
    const accountResult = await client.query(accountQuery, [account_id]);

    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Cuenta no encontrada',
        details: 'La cuenta asociada al ingreso no existe'
      });
    }

    const currentBalance = parseFloat(accountResult.rows[0].balance);

    // 3. Calcular y actualizar el nuevo balance
    const newBalance = currentBalance - amount;

    // Verificar que el nuevo balance no sea negativo (opcional, depende de tus reglas de negocio)
    if (newBalance < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Balance insuficiente',
        details: 'No se puede eliminar el ingreso porque dejaría la cuenta con balance negativo'
      });
    }

    // 4. Actualizar el balance en la cuenta
    const updateAccountQuery = 'UPDATE accounts SET balance = $1 WHERE id = $2';
    await client.query(updateAccountQuery, [newBalance, account_id]);

    // 5. Eliminar el ingreso
    const deleteQuery = 'DELETE FROM incomes WHERE id = $1 RETURNING *';
    const result = await client.query(deleteQuery, [id]);

    await client.query('COMMIT');

    // 6. Enviar respuesta con información completa
    res.status(200).json({
      message: 'Ingreso eliminado exitosamente',
      data: {
        deletedIncome: result.rows[0],
        accountId: account_id,
        previousBalance: currentBalance,
        newBalance: newBalance
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en deleteIncome:', error);

    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Conflicto de eliminación',
        details: 'No se puede eliminar el ingreso porque tiene registros relacionados'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
};