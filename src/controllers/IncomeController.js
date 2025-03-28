import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import { parse, format, isValid, lastDayOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import xlsx from 'xlsx';
import {
  createExpense,

} from '../controllers/Expense/ExpenseController.js';

// Endpoint para carga masiva
export const bulkUploadIncomes = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    console.log("✅ Archivo recibido, procesando...");

    // Leer el archivo Excel desde el buffer
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'El archivo está vacío' });
    }

    // Obtener cuentas y categorías de la base de datos
    const accounts = await client.query('SELECT id, name, balance FROM accounts');
    const categories = await client.query('SELECT id, name, type FROM categories');

    const accountMap = new Map(accounts.rows.map(a => [a.name.toLowerCase(), a.id]));
    const categoryMap = new Map(categories.rows.map(c => [c.name.toLowerCase(), c.id]));

    const newIncomes = [];

    const processDate = (dateValue) => {
      try {
        let parsedDate;

        if (typeof dateValue === "number") {
          // Si la fecha viene en formato numérico de Excel
          const excelStartDate = new Date(1900, 0, dateValue - 1);  // Excel empieza desde el 1 de enero de 1900
          parsedDate = excelStartDate;
        } else if (typeof dateValue === "string") {
          // Si la fecha ya está en formato texto
          parsedDate = parse(dateValue, "dd/MM/yyyy", new Date());
        } else {
          throw new Error(`Formato de fecha no reconocido: ${dateValue}`);
        }

        // Verificar si la fecha es válida
        if (!isValid(parsedDate)) {
          throw new Error(`Fecha inválida: ${dateValue}`);
        }

        // Convertir a formato "YYYY-MM-DD" para PostgreSQL
        return format(parsedDate, "yyyy-MM-dd");
      } catch (error) {
        throw new Error(`Error en la conversión de fecha: ${dateValue} - ${error.message}`);
      }
    };


    for (const row of rows) {
      const accountId = accountMap.get(row.account?.toLowerCase());
      const categoryId = categoryMap.get(row.category?.toLowerCase());

      if (!accountId || !categoryId) {
        throw new Error(`Cuenta o categoría no válidas en la fila: ${JSON.stringify(row)}`);
      }

      let formattedDate;
      let formattedStartPeriod;
      let formattedEndPeriod;

      try {
        // Procesar la fecha
        formattedDate = processDate(row.date); // Procesa la fecha principal

        // Procesar las fechas adicionales
        formattedStartPeriod = row.start_period ? processDate(row.start_period) : null;
        formattedEndPeriod = row.end_period ? processDate(row.end_period) : null;

      } catch (error) {
        throw new Error(`Error en la conversión de fecha en la fila: ${JSON.stringify(row)} - ${error.message}`);
      }

      // Agregar los nuevos campos a los ingresos
      const incomeData = {
        id: uuidv4(),
        user_id: row.user_id,
        account_id: accountId,
        category_id: categoryId,
        amount: parseFloat(row.amount),
        type: row.type || '',
        date: formattedDate, // Ahora en formato "YYYY-MM-DD"
        voucher: row.voucher || null,
        description: row.description || '',
        estado: row.estado || true,
        amountfev: parseFloat(row.amountfev) || 0,
        amountdiverse: parseFloat(row.amountdiverse) || 0,
        cashier_id: row.cashier_id || null,
        arqueo_number: row.arqueo_number || null,
        other_income: row.other_income || null,
        cash_received: row.cash_received || null,
        cashier_commission: row.cashier_commission || null,
        start_period: formattedStartPeriod,
        end_period: formattedEndPeriod,
        comentarios: row.comentarios || null
      };

      newIncomes.push(incomeData);

      // Actualización del balance de la cuenta después de cada ingreso
      const accountQuery = 'SELECT balance FROM accounts WHERE id = $1';
      const accountResult = await client.query(accountQuery, [accountId]);

      const currentBalance = parseFloat(accountResult.rows[0].balance) || 0;
      const newBalance = currentBalance + incomeData.amount; // Sumar el nuevo ingreso al balance actual

      const updateAccountQuery = 'UPDATE accounts SET balance = $1 WHERE id = $2';
      await client.query(updateAccountQuery, [newBalance, accountId]);
    }
    // Insertar en la base de datos
    const insertQuery = `
      INSERT INTO incomes (
        id, user_id, account_id, category_id, amount, type, date, voucher, description, estado, amountfev, amountdiverse,
        cashier_id, arqueo_number, other_income, cash_received, cashier_commission, start_period, end_period , comentarios
      ) VALUES 
      ${newIncomes.map(
      (_, i) =>
        `($${i * 20 + 1}, $${i * 20 + 2}, $${i * 20 + 3}, $${i * 20 + 4}, $${i * 20 + 5}, $${i * 20 + 6}, $${i * 20 + 7}, $${i * 20 + 8}, $${i * 20 + 9}, $${i * 20 + 10}, $${i * 20 + 11}, $${i * 20 + 12}, $${i * 20 + 13}, $${i * 20 + 14}, $${i * 20 + 15}, $${i * 20 + 16}, $${i * 20 + 17}, $${i * 20 + 18}, $${i * 20 + 19}, $${i * 20 + 20})`
    ).join(', ')}`;

    const insertValues = newIncomes.flatMap(income => Object.values(income));
    await client.query(insertQuery, insertValues);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Ingresos cargados exitosamente' });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      error: 'Error al procesar la carga masiva',
      details: error.message,
    });
  } finally {
    client.release();
  }
};


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
      importes_personalizados,
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
      importes_personalizados = [], // Default to empty array if not provided
    } = req.body;

    // Fetch existing income to calculate balance adjustment
    const existingIncomeQuery = 'SELECT amount, account_id FROM incomes WHERE id = $1';
    const existingResult = await client.query(existingIncomeQuery, [id]);
    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ingreso no encontrado' });
    }
    const oldAmount = parseFloat(existingResult.rows[0].amount) || 0;
    const oldAccountId = existingResult.rows[0].account_id;

    // Validate account
    const accountQuery = 'SELECT balance FROM accounts WHERE id = $1';
    const accountResult = await client.query(accountQuery, [account_id]);
    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cuenta inválida' });
    }
    const currentBalance = parseFloat(accountResult.rows[0].balance) || 0;

    // Adjust balance (subtract old amount, add new amount)
    const balanceAdjustment = amount - oldAmount;
    const newBalance = currentBalance + balanceAdjustment;
    const updateAccountQuery = 'UPDATE accounts SET balance = $1 WHERE id = $2';
    await client.query(updateAccountQuery, [newBalance, account_id]);

    // Process voucher
    let parsedVoucher = [];
    if (typeof voucher === 'string') {
      parsedVoucher = JSON.parse(voucher);
    } else if (Array.isArray(voucher)) {
      parsedVoucher = voucher;
    }

    // Process importes_personalizados
    let parsedImportesPersonalizados = [];
    if (typeof importes_personalizados === 'string') {
      parsedImportesPersonalizados = JSON.parse(importes_personalizados);
    } else if (Array.isArray(importes_personalizados)) {
      parsedImportesPersonalizados = importes_personalizados;
    }
    const importesPersonalizadosJson = parsedImportesPersonalizados.length > 0 
      ? JSON.stringify(parsedImportesPersonalizados) 
      : null;

    console.log("importes_personalizados enviado a PostgreSQL:", importesPersonalizadosJson);

    // Update income
    const updateIncomeQuery = `
      UPDATE incomes SET
        user_id = $1,
        account_id = $2,
        category_id = $3,
        amount = $4,
        type = $5,
        date = $6::timestamp,
        voucher = $7::text[],
        description = $8,
        estado = $9,
        amountfev = $10,
        amountdiverse = $11,
        cashier_id = $12,
        arqueo_number = $13,
        other_income = $14,
        cash_received = $15,
        cashier_commission = $16,
        start_period = $17::date,
        end_period = $18::date,
        comentarios = $19,
        amountcustom = $20,
        importes_personalizados = $21::jsonb
      WHERE id = $22
      RETURNING *`;
    const values = [
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
      importesPersonalizadosJson,
      id,
    ];
    const result = await client.query(updateIncomeQuery, values);

    await client.query('COMMIT');
    res.status(200).json({
      message: 'Ingreso actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en updateIncome:', error);
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