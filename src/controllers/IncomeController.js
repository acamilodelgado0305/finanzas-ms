import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';

//--------------------------OBTENER TODOS LOS INGRESOS------------------------------//
export const getAllIncomes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incomes');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los ingresos' });
  }
};


//----------------------------CREAR INGRESO---------------------------------------//

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
      voucher,
      description,
      estado,
      amountfev,
      amountdiverse,
      cashier_name, // Nuevo campo
      cashier_number, // Nuevo campo
      other_income, // Nuevo campo
      cash_received, // Nuevo campo
      cashier_commission, // Nuevo campo
      start_period, // Nuevo campo
      end_period // Nuevo campo
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

    // Procesar los vouchers: convertir string con \n a array formato PostgreSQL
    const processedVoucher = voucher
      ? '{' + voucher
        .split('\n')
        .filter(v => v.trim())
        .map(v => `"${v.replace(/"/g, '\\"')}"`)
        .join(',') + '}'
      : null;

    const createIncomeQuery = `
      INSERT INTO incomes (
        id,
        user_id, 
        account_id, 
        category_id, 
        amount, 
        type, 
        date, 
        voucher, 
        description,
        estado,
        amountfev,
        amountdiverse,
        cashier_name,
        cashier_number,
        other_income,
        cash_received,
        cashier_commission,
        start_period,
        end_period -- Nuevo campo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8::text[], $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::date, $19::date) 
      RETURNING *`;

    const values = [
      id,
      user_id,
      account_id,
      category_id,
      finalAmount,
      type || '',
      date,
      processedVoucher,
      description || '',
      estado || false,
      categoryName.toLowerCase() === 'arqueo' ? amountfev : 0,
      categoryName.toLowerCase() === 'arqueo' ? amountdiverse : 0,
      cashier_name || null, // Nuevo campo
      cashier_number || null, // Nuevo campo
      other_income || null, // Nuevo campo
      cash_received || null, // Nuevo campo
      cashier_commission || null, // Nuevo campo
      start_period || null, // Nuevo campo
      end_period || null // Nuevo campo
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

//---------------------------- OBTENER INGRESO POR ID------------------------------------//
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
//-------------------------UPDATE INCOME---------------------------------------//

export const updateIncome = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      user_id,
      account_id,
      category_id,
      amount,
      type,
      date,
      voucher,
      description,
      recurrent,
      tax_type,
      timerecurrent,
      estado,
      amountfev,
      amountdiverse,
      cashier_name, // Nuevo campo
      cashier_number, // Nuevo campo
      other_income, // Nuevo campo
      cash_received, // Nuevo campo
      cashier_commission, // Nuevo campo
      start_period, // Nuevo campo
      end_period // Nuevo campo
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
      voucher,
      description,
      recurrent,
      tax_type,
      timerecurrent,
      estado,
      amountfev,
      amountdiverse,
      cashier_name, // Nuevo campo
      cashier_number, // Nuevo campo
      other_income, // Nuevo campo
      cash_received, // Nuevo campo
      cashier_commission, // Nuevo campo
      start_period, // Nuevo campo
      end_period // Nuevo campo
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


// -----------------------------------------ELIMINAR UN INGRESO----------------------------------------//
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



//---------------------------------- MANEJADOR DE COMPROBANTES--------------------------------//

export const manageVouchers = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id, action, vouchers } = req.body;

    // Validar que el id existe
    if (!id) {
      return res.status(400).json({
        error: 'Campo requerido faltante',
        details: 'El campo id es obligatorio'
      });
    }

    // Obtener el registro actual
    const getCurrentVouchersQuery = 'SELECT voucher FROM incomes WHERE id = $1';
    const currentResult = await client.query(getCurrentVouchersQuery, [id]);

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Registro no encontrado',
        details: 'El ingreso especificado no existe'
      });
    }

    let currentVouchers = currentResult.rows[0].voucher || [];
    let updatedVouchers = [...currentVouchers];

    switch (action) {
      case 'add':
        // Validar que se proporcionaron vouchers para agregar
        if (!vouchers || !Array.isArray(vouchers)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Datos inválidos',
            details: 'Se deben proporcionar vouchers para agregar'
          });
        }
        // Agregar nuevos vouchers al array existente
        updatedVouchers = [...currentVouchers, ...vouchers];
        break;

      case 'remove':
        // Validar que se proporcionaron vouchers para eliminar
        if (!vouchers || !Array.isArray(vouchers)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Datos inválidos',
            details: 'Se deben proporcionar vouchers para eliminar'
          });
        }
        // Filtrar los vouchers que no están en la lista para eliminar
        updatedVouchers = currentVouchers.filter(v => !vouchers.includes(v));
        break;

      case 'update':
        // Validar que se proporcionó el nuevo array de vouchers
        if (!vouchers || !Array.isArray(vouchers)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Datos inválidos',
            details: 'Se debe proporcionar el nuevo array de vouchers'
          });
        }
        // Reemplazar completamente el array de vouchers
        updatedVouchers = vouchers;
        break;

      default:
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Acción inválida',
          details: 'La acción debe ser "add", "remove" o "update"'
        });
    }

    // Convertir el array a formato PostgreSQL
    const processedVouchers = '{' + updatedVouchers
      .filter(v => v.trim())
      .map(v => `"${v.replace(/"/g, '\\"')}"`)
      .join(',') + '}';

    // Actualizar los vouchers en la base de datos
    const updateQuery = 'UPDATE incomes SET voucher = $1::text[] WHERE id = $2 RETURNING *';
    const result = await client.query(updateQuery, [processedVouchers, id]);

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Vouchers actualizados exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en manageVouchers:', error);

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
};


//-------OBTENER COMPROBANTES-------
export const getIncomeVouchers = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar que se proporcionó un ID
    if (!id) {
      return res.status(400).json({
        error: 'ID no proporcionado',
        details: 'Se requiere un ID válido para obtener los comprobantes'
      });
    }

    // Consultar solo la columna voucher del ingreso específico
    const query = 'SELECT voucher FROM incomes WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Ingreso no encontrado',
        details: `No se encontró un ingreso con el ID: ${id}`
      });
    }

    // Devolver el array de comprobantes
    res.status(200).json({
      id,
      vouchers: result.rows[0].voucher || []
    });

  } catch (error) {
    console.error('Error en getIncomeVouchers:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};