import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import { parse, format, isValid, lastDayOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import xlsx from 'xlsx';

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
        cashier_name: row.cashier_name || null,
        arqueo_number: row.arqueo_number || null,
        other_income: row.other_income || null,
        cash_received: row.cash_received || null,
        cashier_commission: row.cashier_commission || null,
        start_period: formattedStartPeriod,
        end_period: formattedEndPeriod,
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
        cashier_name, arqueo_number, other_income, cash_received, cashier_commission, start_period, end_period
      ) VALUES 
      ${newIncomes.map(
      (_, i) =>
        `($${i * 19 + 1}, $${i * 19 + 2}, $${i * 19 + 3}, $${i * 19 + 4}, $${i * 19 + 5}, $${i * 19 + 6}, $${i * 19 + 7}, $${i * 19 + 8}, $${i * 19 + 9}, $${i * 19 + 10}, $${i * 19 + 11}, $${i * 19 + 12}, $${i * 19 + 13}, $${i * 19 + 14}, $${i * 19 + 15}, $${i * 19 + 16}, $${i * 19 + 17}, $${i * 19 + 18}, $${i * 19 + 19})`
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
      cashier_name,
      arqueo_number,
      other_income,
      cash_received,
      cashier_commission,
      start_period,
      end_period,
      comentarios // Nuevo campo
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

    // Actualizar el balance de la cuenta
    const newBalance = currentBalance + amount;
    const updateAccountQuery = 'UPDATE accounts SET balance = $1 WHERE id = $2';
    await client.query(updateAccountQuery, [newBalance, account_id]);

    // Ya no necesitamos procesar los vouchers ya que vendrán como array

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
        arqueo_number,
        other_income,
        cash_received,
        cashier_commission,
        start_period,
        end_period,
        comentarios
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8::text[], $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::date, $19::date, $20) 
      RETURNING *`;

    const values = [
      id,
      user_id,
      account_id,
      category_id,
      amount,
      type || '',
      date,
      voucher || [], // Ahora esperamos un array directamente
      description || '',
      estado || false,
      categoryName.toLowerCase() === 'arqueo' ? amountfev : 0,
      categoryName.toLowerCase() === 'arqueo' ? amountdiverse : 0,
      cashier_name || null,
      arqueo_number || null,
      other_income || null,
      cash_received || null,
      cashier_commission || null,
      start_period || null,
      end_period || null,
      comentarios || null // Nuevo campo
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
      arqueo_number, // Nuevo campo
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
      arqueo_number, // Nuevo campo
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