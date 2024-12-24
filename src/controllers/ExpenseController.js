import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import { setTimeout } from "timers/promises";
// Obtener todos los gastos
export const getAllExpenses = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los gastos' });
  }
};

//---------------------------------------CREAR UN NUEVO GASTO-------------------------------//
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
      sub_type,
      date,
      voucher,
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
      retention_amount = null,
    } = req.body;

    const processedVoucher = voucher
      ? '{' + voucher
        .split('\n')
        .filter(v => v.trim())
        .map(v => `"${v.replace(/"/g, '\\"')}"`)
        .join(',') + '}'
      : null;

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

    const query = `
      INSERT INTO expenses (
        id, user_id, account_id, category_id, base_amount, amount, 
        type, sub_type, date, voucher, description, recurrent, tax_type,
        tax_percentage, tax_amount, retention_type, retention_percentage,
        retention_amount, timerecurrent, estado, provider_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamp, $10::text[], $11, $12, 
              $13, $14, $15, $16, $17, $18, $19, $20, $21) 
      RETURNING *`;

    let createdCount = 0;
    const baseDate = new Date(date);
    const results = [];

    // Incluir el gasto inicial
    const initialExpense = {
      id: uuidv4(),
      user_id,
      account_id,
      category_id,
      base_amount,
      amount,
      type: type || '',
      sub_type: sub_type || '',
      date: baseDate.toISOString(),
      voucher: processedVoucher,
      description: description || '',
      recurrent,
      tax_type,
      tax_percentage,
      tax_amount,
      retention_type,
      retention_percentage,
      retention_amount,
      timerecurrent,
      estado,
      provider_id,
    };

    const initialResult = await client.query(query, Object.values(initialExpense));
    results.push(initialResult.rows[0]);
    createdCount++;

    // Crear los gastos recurrentes
    for (let i = 1; i < timerecurrent; i++) {
      await setTimeout(100); // Introducir un retraso de 100ms entre las creaciones

      const transactionDate = new Date(baseDate);
      transactionDate.setMonth(baseDate.getMonth() + i);

      const year = transactionDate.getFullYear();
      const month = transactionDate.getMonth() + 1;

      const checkExistingQuery = `
        SELECT id FROM expenses
        WHERE account_id = $1
        AND category_id = $2
        AND DATE_PART('year', date) = $3
        AND DATE_PART('month', date) = $4`;

      const existingExpense = await client.query(checkExistingQuery, [
        account_id,
        category_id,
        year,
        month,
      ]);

      if (existingExpense.rows.length === 0) {
        const values = [
          uuidv4(),
          user_id,
          account_id,
          category_id,
          base_amount,
          amount,
          type || '',
          sub_type || '',
          transactionDate.toISOString(),
          processedVoucher,
          description || '',
          recurrent,
          tax_type,
          tax_percentage,
          tax_amount,
          retention_type,
          retention_percentage,
          retention_amount,
          timerecurrent,
          false,
          provider_id,
        ];

        const result = await client.query(query, values);
        results.push(result.rows[0]);
        createdCount++;

        if (createdCount === timerecurrent) break; // Garantizar que no se exceda el límite
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `${createdCount} gastos recurrentes creados exitosamente`,
      data: results,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en createExpense:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  } finally {
    client.release();
  }
};

//------------------------OBETNER GASTO POR ID------------------------//
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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      user_id,
      account_id,
      category_id,
      base_amount,
      amount,
      type,
      date,
      voucher,
      description,
      recurrent,
      tax_type,
      tax_percentage,
      tax_amount,
      retention_type,
      retention_percentage,
      retention_amount,
      timerecurrent,
      estado,
      provider_id
    } = req.body;

    // Validate required fields
    if (!user_id || !account_id || !category_id || !base_amount || !amount || !date) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos user_id, account_id, category_id, base_amount, amount y date son obligatorios'
      });
    }

    // Validate amounts
    if (typeof base_amount !== 'number' || base_amount <= 0 || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Montos inválidos',
        details: 'Los montos base y total deben ser números positivos'
      });
    }

    // Get the current expense details
    const currentExpenseQuery = 'SELECT amount, account_id FROM expenses WHERE id = $1';
    const currentExpense = await client.query(currentExpenseQuery, [id]);

    if (currentExpense.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Gasto no encontrado',
        details: `No se encontró ningún gasto con el ID ${id}`
      });
    }

    const oldAmount = currentExpense.rows[0].amount;
    const oldAccountId = currentExpense.rows[0].account_id;

    // If the account is being changed, update both old and new account balances
    if (oldAccountId !== account_id) {
      // Return amount to old account
      await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
        [oldAmount, oldAccountId]
      );

      // Deduct from new account
      const newAccountResult = await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING balance',
        [amount, account_id]
      );

      if (newAccountResult.rows[0].balance < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Saldo insuficiente',
          details: 'La cuenta destino no tiene saldo suficiente'
        });
      }
    } else {
      // Same account, just update the difference
      const difference = amount - oldAmount;
      const accountResult = await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING balance',
        [difference, account_id]
      );

      if (accountResult.rows[0].balance < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Saldo insuficiente',
          details: 'La cuenta no tiene saldo suficiente para el nuevo monto'
        });
      }
    }

    // Update the expense
    const updateExpenseQuery = `
      UPDATE expenses SET 
        user_id = $1,
        account_id = $2,
        category_id = $3,
        base_amount = $4,
        amount = $5,
        type = $6,
        date = $7,
        voucher = $8,
        description = $9,
        recurrent = $10,
        tax_type = $11,
        tax_percentage = $12,
        tax_amount = $13,
        retention_type = $14,
        retention_percentage = $15,
        retention_amount = $16,
        timerecurrent = $17,
        estado = $18,
        provider_id = $19
      WHERE id = $20
      RETURNING *`;

    const result = await client.query(updateExpenseQuery, [
      user_id,
      account_id,
      category_id,
      base_amount,
      amount,
      type,
      date,
      voucher || '',
      description || '',
      recurrent,
      tax_type,
      tax_percentage,
      tax_amount,
      retention_type,
      retention_percentage,
      retention_amount,
      timerecurrent,
      estado,
      provider_id || null,
      id
    ]);

    await client.query('COMMIT');

    res.status(200).json({
      status: 'success',
      message: 'Gasto actualizado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en updateExpense:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
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



export const ExpenseManageVouchers = async (req, res) => {
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
    const getCurrentVouchersQuery = 'SELECT voucher FROM expenses WHERE id = $1';
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
    const updateQuery = 'UPDATE expenses SET voucher = $1::text[] WHERE id = $2 RETURNING *';
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
export const getExpenseVouchers = async (req, res) => {
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
    const query = 'SELECT voucher FROM expenses WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Gasto no encontrado',
        details: `No se encontró un ingreso con el ID: ${id}`
      });
    }

    // Devolver el array de comprobantes
    res.status(200).json({
      id,
      vouchers: result.rows[0].voucher || []
    });

  } catch (error) {
    console.error('Error en getExpenseVouchers:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};