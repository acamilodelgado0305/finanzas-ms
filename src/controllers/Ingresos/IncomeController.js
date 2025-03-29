import pool from '../../database.js';
import { v4 as uuidv4 } from 'uuid';
import { parse, format, isValid, lastDayOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import xlsx from 'xlsx';
import {
  createExpense,

} from '../Expense/ExpenseController.js';

// Endpoint para carga masiva



//--------------------------OBTENER TODOS LOS INGRESOS------------------------------//
export const getAllIncomes = async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        arqueo_number,
        description,
        account_id,
        cashier_id,
        amount,
        date,
        start_period,
        end_period,
        voucher,
        type
      FROM incomes
      ORDER BY date DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener los ingresos:', error);
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
      description,
      estado,
      amountfev,
      amountdiverse,
      cashier_id,
      arqueo_number,
      other_income,
      cash_received,
      cashier_commission,
      start_period,
      end_period,
      comentarios,
      amountcustom,
      importes_personalizados,
      voucher 
    } = req.body;

    // Validación básica
    if (!user_id || !account_id || !date) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos user_id, account_id y date son obligatorios'
      });
    }

    // Verificar que la cuenta existe
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

    // Validar categoría solo si fue proporcionada
    let categoryName = null;
    let categoryType = null;
    if (category_id) {
      const categoryQuery = 'SELECT name, type FROM categories WHERE id = $1';
      const categoryResult = await client.query(categoryQuery, [category_id]);
      if (categoryResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Categoría inválida',
          details: 'La categoría especificada no existe'
        });
      }
      categoryName = categoryResult.rows[0].name;
      categoryType = categoryResult.rows[0].type;
    }

    // Actualizar el balance de la cuenta
    const newBalance = currentBalance + amount;
    const updateAccountQuery = 'UPDATE accounts SET balance = $1 WHERE id = $2';
    await client.query(updateAccountQuery, [newBalance, account_id]);

    // Procesar el campo voucher
    let parsedVoucher = [];
    if (typeof voucher === 'string') {
      try {
        parsedVoucher = JSON.parse(voucher);
      } catch (e) {
        return res.status(400).json({
          error: 'Formato de comprobantes inválido',
          details: 'El campo voucher debe ser un arreglo válido'
        });
      }
    } else if (Array.isArray(voucher)) {
      parsedVoucher = voucher;
    } else {
      return res.status(400).json({
        error: 'Formato de comprobantes inválido',
        details: 'El campo voucher debe ser un arreglo'
      });
    }

    if (!parsedVoucher.every(url => typeof url === 'string')) {
      return res.status(400).json({
        error: 'Formato de comprobantes inválido',
        details: 'Todos los elementos del campo voucher deben ser URLs válidas'
      });
    }

    // Validar y preparar importes_personalizados
    let parsedImportesPersonalizados = [];
    if (importes_personalizados) {
      if (typeof importes_personalizados === 'string') {
        try {
          parsedImportesPersonalizados = JSON.parse(importes_personalizados);
        } catch (e) {
          return res.status(400).json({
            error: 'Formato de importes_personalizados inválido',
            details: 'El campo importes_personalizados debe ser un JSON válido'
          });
        }
      } else if (Array.isArray(importes_personalizados)) {
        parsedImportesPersonalizados = importes_personalizados;
      } else {
        return res.status(400).json({
          error: 'Formato de importes_personalizados inválido',
          details: 'El campo importes_personalizados debe ser un arreglo'
        });
      }

      if (!parsedImportesPersonalizados.every(item => 
        item && 
        typeof item === 'object' && 
        item.id_importe && 
        item.producto && 
        item.accion && 
        typeof item.valor === 'number'
      )) {
        return res.status(400).json({
          error: 'Formato de importes_personalizados inválido',
          details: 'Cada elemento debe tener id_importe, producto, accion y valor (número)'
        });
      }
    }

    // Serializar explícitamente a string JSON para jsonb
    const importesPersonalizadosJson = parsedImportesPersonalizados.length > 0 
      ? JSON.stringify(parsedImportesPersonalizados) 
      : null;

    console.log("importes_personalizados enviado a PostgreSQL:", importesPersonalizadosJson);

    // Insertar el ingreso en la base de datos
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
        cashier_id,
        arqueo_number,
        other_income,
        cash_received,
        cashier_commission,
        start_period,
        end_period,
        comentarios,
        amountcustom,
        importes_personalizados
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7::timestamp, $8::text[], $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18::date, $19::date, $20, $21, $22::jsonb
      )
      RETURNING *`;
    const values = [
      uuidv4(),
      user_id,
      account_id,
      category_id || null,
      amount,
      type || '',
      date,
      parsedVoucher,
      description || '',
      estado || false,
      amountfev || null,
      amountdiverse || null,
      cashier_id || null,
      arqueo_number || null,
      other_income || null,
      cash_received || null,
      cashier_commission || null,
      start_period || null,
      end_period || null,
      comentarios || null,
      amountcustom || null,
      importesPersonalizadosJson, // Usar el string JSON serializado
    ];
    const result = await client.query(createIncomeQuery, values);

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Ingreso creado exitosamente',
      data: result.rows[0]
    });

    // Lógica de comisión
    if (type === 'arqueo' && cashier_commission > 0) {
      try {
        if (!arqueo_number) {
          throw new Error('El número de arqueo no está definido.');
        }
        const egresoNumber = `C-${arqueo_number}`;
        const expenseData = {
          user_id,
          account_id,
          tipo: 'commission',
          date,
          proveedor: cashier_id,
          categoria: null,
          description: `Comisión de arqueo ${description || ''}`,
          estado: true,
          expense_items: [
            {
              type: 'commission',
              categoria: null,
              product: 'Comisión de Arqueo',
              description: `Comisión de arqueo ${egresoNumber || ''}`,
              quantity: 1,
              unit_price: cashier_commission,
              discount: 0,
              total: cashier_commission,
              tax_charge: 0,
              tax_withholding: 0,
            }
          ],
          expense_totals: {
            total_bruto: cashier_commission,
            descuentos: 0,
            subtotal: cashier_commission,
            iva: 0,
            iva_percentage: 0,
            retencion: 0,
            retencion_percentage: 0,
            total_neto: cashier_commission,
            total_impuestos: 0,
          },
          facturaNumber: egresoNumber,
          facturaProvNumber: null,
          comentarios: `Comisión generada automáticamente para el arqueo ${description || ''}`,
          voucher: null,
        };
        const expenseClient = await pool.connect();
        try {
          await createExpense({ body: expenseData }, { status: () => { }, json: () => { } });
        } finally {
          expenseClient.release();
        }
      } catch (expenseError) {
        console.error('Error al crear el egreso por comisión:', expenseError);
      }
    }

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
    if (error.code === '22P02') {
      return res.status(400).json({
        error: 'Formato de JSON inválido',
        details: `Error al parsear importes_personalizados: ${error.detail}`
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
    await client.query('BEGIN');
    const { id } = req.params;
    const {
      user_id,
      account_id,
      category_id,
      amount,
      type,
      date,
      description,
      estado,
      amountfev,
      amountdiverse,
      cashier_id,
      arqueo_number,
      other_income,
      cash_received,
      cashier_commission,
      start_period,
      end_period,
      comentarios,
      importes_personalizados, // Agregado aquí
    } = req.body;

    console.log("importes_personalizados recibido:", JSON.stringify(importes_personalizados, null, 2));

    // Validación básica
    if (!user_id || !account_id || !date) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos user_id, account_id y date son obligatorios'
      });
    }

    // Obtener el ingreso actual para calcular la diferencia en el balance
    const currentIncomeQuery = 'SELECT amount, account_id FROM incomes WHERE id = $1';
    const currentIncomeResult = await client.query(currentIncomeQuery, [id]);

    if (currentIncomeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Ingreso no encontrado',
        details: 'El ingreso especificado no existe'
      });
    }

    const currentAmount = parseFloat(currentIncomeResult.rows[0].amount);
    const oldAccountId = currentIncomeResult.rows[0].account_id;

    // Verificar que la cuenta existe
    const accountQuery = 'SELECT balance FROM accounts WHERE id = $1';
    const accountResult = await client.query(accountQuery, [account_id]);
    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cuenta inválida',
        details: 'La cuenta especificada no existe'
      });
    }

    // Validar categoría solo si fue proporcionada
    if (category_id) {
      const categoryQuery = 'SELECT id FROM categories WHERE id = $1';
      const categoryResult = await client.query(categoryQuery, [category_id]);
      if (categoryResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Categoría inválida',
          details: 'La categoría especificada no existe'
        });
      }
    }

    // Actualizar el balance de la cuenta si el monto cambió o la cuenta cambió
    if (amount !== currentAmount || account_id !== oldAccountId) {
      // Si la cuenta cambió, actualizar ambas cuentas
      if (account_id !== oldAccountId) {
        // Revertir el monto de la cuenta anterior
        const oldAccountQuery = 'UPDATE accounts SET balance = balance - $1 WHERE id = $2';
        await client.query(oldAccountQuery, [currentAmount, oldAccountId]);

        // Agregar el nuevo monto a la nueva cuenta
        const newAccountQuery = 'UPDATE accounts SET balance = balance + $1 WHERE id = $2';
        await client.query(newAccountQuery, [amount, account_id]);
      } else {
        // Si es la misma cuenta, solo actualizar la diferencia
        const balanceDiff = amount - currentAmount;
        const updateBalanceQuery = 'UPDATE accounts SET balance = balance + $1 WHERE id = $2';
        await client.query(updateBalanceQuery, [balanceDiff, account_id]);
      }
    }

    // Validar y preparar importes_personalizados
    let parsedImportesPersonalizados = [];
    if (importes_personalizados !== undefined) { // Solo procesar si se proporciona
      if (typeof importes_personalizados === 'string') {
        try {
          parsedImportesPersonalizados = JSON.parse(importes_personalizados);
        } catch (e) {
          return res.status(400).json({
            error: 'Formato de importes_personalizados inválido',
            details: 'El campo importes_personalizados debe ser un JSON válido'
          });
        }
      } else if (Array.isArray(importes_personalizados)) {
        parsedImportesPersonalizados = importes_personalizados;
      } else {
        return res.status(400).json({
          error: 'Formato de importes_personalizados inválido',
          details: 'El campo importes_personalizados debe ser un arreglo'
        });
      }

      if (!parsedImportesPersonalizados.every(item => 
        item && 
        typeof item === 'object' && 
        item.id_importe && 
        item.producto && 
        item.accion && 
        typeof item.valor === 'number'
      )) {
        return res.status(400).json({
          error: 'Formato de importes_personalizados inválido',
          details: 'Cada elemento debe tener id_importe, producto, accion y valor (número)'
        });
      }
    }

    // Serializar a JSON para jsonb
    const importesPersonalizadosJson = parsedImportesPersonalizados.length > 0 
      ? JSON.stringify(parsedImportesPersonalizados) 
      : null;

    // Construir la consulta de actualización
    const updateFields = [];
    const values = [];
    let parameterIndex = 1;

    const fieldMappings = {
      user_id,
      account_id,
      category_id,
      amount,
      type,
      date,
      description,
      estado,
      amountfev,
      amountdiverse,
      cashier_id,
      arqueo_number,
      other_income,
      cash_received,
      cashier_commission,
      start_period,
      end_period,
      comentarios,
      importes_personalizados: importesPersonalizadosJson, // Agregar al mapeo
    };

    for (const [field, value] of Object.entries(fieldMappings)) {
      if (value !== undefined) {
        updateFields.push(`${field} = $${parameterIndex}`);
        values.push(value);
        parameterIndex++;
      }
    }

    values.push(id);

    const updateQuery = `
      UPDATE incomes 
      SET ${updateFields.join(', ')}
      WHERE id = $${parameterIndex}
      RETURNING *
    `;

    const result = await client.query(updateQuery, values);

    await client.query('COMMIT');
    res.status(200).json({
      message: 'Ingreso actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
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
    if (error.code === '22P02') {
      return res.status(400).json({
        error: 'Formato de JSON inválido',
        details: `Error al parsear importes_personalizados: ${error.detail}`
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


