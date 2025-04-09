import pool from '../../database.js';
import { v4 as uuidv4 } from 'uuid';
import { parse, format, isValid, lastDayOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import xlsx from 'xlsx';




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
        cash_received,
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
      importes_personalizados,
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
    const currentIncomeQuery = 'SELECT cash_received, account_id FROM incomes WHERE id = $1'; // Cambiado de 'amount' a 'cash_received'
    const currentIncomeResult = await client.query(currentIncomeQuery, [id]);

    if (currentIncomeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Ingreso no encontrado',
        details: 'El ingreso especificado no existe'
      });
    }

    const currentCashReceived = parseFloat(currentIncomeResult.rows[0].cash_received); // Cambiado de 'currentAmount' a 'currentCashReceived'
    const oldAccountId = currentIncomeResult.rows[0].account_id;

    // Verificar que la cuenta existe y obtener el balance actual
    const accountQuery = 'SELECT balance FROM accounts WHERE id = $1';
    const accountResult = await client.query(accountQuery, [account_id]);
    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cuenta inválida',
        details: 'La cuenta especificada no existe'
      });
    }

    const currentBalance = parseFloat(accountResult.rows[0].balance);

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

    // Actualizar el balance de la cuenta si cash_received cambió o la cuenta cambió
    let newBalance = currentBalance; // Inicializamos el nuevo balance
    if (cash_received !== undefined && (cash_received !== currentCashReceived || account_id !== oldAccountId)) {
      // Si la cuenta cambió, actualizar ambas cuentas
      if (account_id !== oldAccountId) {
        // Revertir el monto de la cuenta anterior
        const oldAccountQuery = 'UPDATE accounts SET balance = balance - $1 WHERE id = $2';
        await client.query(oldAccountQuery, [currentCashReceived, oldAccountId]);

        // Agregar el nuevo monto a la nueva cuenta
        const newAccountQuery = 'UPDATE accounts SET balance = balance + $1 WHERE id = $2';
        await client.query(newAccountQuery, [cash_received, account_id]);

        // Calcular el nuevo balance para la respuesta
        newBalance = currentBalance + cash_received;
      } else {
        // Si es la misma cuenta, solo actualizar la diferencia
        const balanceDiff = cash_received - currentCashReceived;
        const updateBalanceQuery = 'UPDATE accounts SET balance = balance + $1 WHERE id = $2';
        await client.query(updateBalanceQuery, [balanceDiff, account_id]);

        // Calcular el nuevo balance para la respuesta
        newBalance = currentBalance + balanceDiff;
      }
    }

    // Validar y preparar importes_personalizados
    let parsedImportesPersonalizados = [];
    if (importes_personalizados !== undefined) {
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
      importes_personalizados: importesPersonalizadosJson,
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

    // Preparar la respuesta
    const response = {
      message: 'Ingreso actualizado exitosamente',
      data: {
        updatedIncome: result.rows[0],
        accountId: account_id,
        previousBalance: currentBalance,
        newBalance: newBalance
      }
    };

    // Si el nuevo balance es negativo, agregar un mensaje informativo
    if (newBalance < 0) {
      response.data.warning = 'El balance de la cuenta es ahora negativo';
    }

    res.status(200).json(response);
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
    const { cash_received, account_id } = income; // Cambiado de 'amount' a 'cash_received'

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

    // 3. Calcular el nuevo balance usando cash_received
    const newBalance = currentBalance - cash_received; // Cambiado de 'amount' a 'cash_received'

    // 4. Actualizar el balance en la cuenta (sin validar si es negativo)
    const updateAccountQuery = 'UPDATE accounts SET balance = $1 WHERE id = $2';
    await client.query(updateAccountQuery, [newBalance, account_id]);

    // 5. Eliminar el ingreso
    const deleteQuery = 'DELETE FROM incomes WHERE id = $1 RETURNING *';
    const result = await client.query(deleteQuery, [id]);

    await client.query('COMMIT');

    // 6. Enviar respuesta con información completa
    const response = {
      message: 'Ingreso eliminado exitosamente',
      data: {
        deletedIncome: result.rows[0],
        accountId: account_id,
        previousBalance: currentBalance,
        newBalance: newBalance
      }
    };

    // Si el nuevo balance es negativo, agregar un mensaje informativo
    if (newBalance < 0) {
      response.data.warning = 'El balance de la cuenta es ahora negativo';
    }

    res.status(200).json(response);

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


