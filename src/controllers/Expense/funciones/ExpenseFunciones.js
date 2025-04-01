import pool from '../../../database.js';
import { v4 as uuidv4 } from 'uuid';
import { setTimeout } from "timers/promises";
import xlsx from 'xlsx';
import { parse, format, isValid, lastDayOfMonth } from "date-fns";

export const bulkUploadExpenses = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'El archivo está vacío' });
    }

    // Obtener cuentas, categorías y proveedores de la base de datos
    const accounts = await client.query('SELECT id, name FROM accounts');
    const categories = await client.query('SELECT id, name FROM categories');
    const providers = await client.query('SELECT id, nombre_comercial FROM proveedores');

    if (accounts.rows.length === 0 || categories.rows.length === 0 || providers.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No se encontraron cuentas, categorías o proveedores' });
    }

    // Crear mapeos de cuentas, categorías y proveedores
    const accountMap = new Map(
      accounts.rows.map(a => [a.name.trim().toLowerCase(), a.id])
    );
    const categoryMap = new Map(
      categories.rows.map(c => [c.name.trim().toLowerCase(), c.id])
    );
    const providerMap = new Map(
      providers.rows.map(p => [p.nombre_comercial.trim().toLowerCase(), p.id]) // Mapeo de nombre_comercial en minúsculas
    );

    const newExpenses = [];

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

      // Obtener accountId usando el nombre de la cuenta
      const accountId = row.account && typeof row.account === 'string'
        ? accountMap.get(row.account.trim().toLowerCase())
        : null;

      // Obtener categoryId usando el nombre de la categoría
      const categoryId = row.category && typeof row.category === 'string'
        ? categoryMap.get(row.category.trim().toLowerCase())
        : null;

      // Obtener providerId usando el nombre comercial
      const providerName = row.provider_id && typeof row.provider_id === 'string'
        ? row.provider_id.trim().toLowerCase()
        : null;

      console.log("Buscando proveedor:", providerName);

      const providerId = providerMap.get(providerName);
      // Verifica que el providerId esté bien asignado
      if (!providerId) {
        console.error(`Proveedor no encontrado: ${providerName}`);
        throw new Error(`Proveedor no válido en la fila: ${JSON.stringify(row)}`);
      }

      if (!accountId || !categoryId) {
        if (!accountId) {
          console.error(`Cuenta no válida en la fila: ${JSON.stringify(row)}`);
        }
        if (!categoryId) {
          console.error(`Categoría no válida en la fila: ${JSON.stringify(row)}`);
        }

        throw new Error(`Cuenta o categoría no válidos en la fila: ${JSON.stringify(row)}`);
      }

      let formattedDate;
      try {
        formattedDate = processDate(row.date); // Procesar la fecha
      } catch (error) {
        throw new Error(`Error en la conversión de fecha en la fila: ${JSON.stringify(row)} - ${error.message}`);
      }

      // Procesar voucher como un array limpio
      const processedVoucher = row.voucher ? row.voucher.split('\n').filter(v => v.trim()) : [];

      // Preparar el objeto de gastos
      const expenseData = {
        id: uuidv4(),
        user_id: row.user_id,
        account_id: accountId,
        category: categoryId,
        description: row.description || '',
        estado: row.estado || true,
        invoice_number: row.invoice_number || null,
        provider_invoice_number: row.provider_invoice_number || null,
        comments: row.comments || null,
        type: row.type || '',
        total_gross: parseFloat(row.base_amount) || 0,  // Usamos base_amount como total_gross
        discounts: parseFloat(row.discount) || 0,  // Asume que hay un campo de descuento en el archivo
        subtotal: parseFloat(row.subtotal) || 0,  // Asume que hay un campo de subtotal
        ret_vat: parseFloat(row.tax_amount) || 0,  // Usamos tax_amount como ret_vat
        ret_vat_percentage: parseFloat(row.tax_percentage) || 0,
        ret_ica: parseFloat(row.retention_total_net) || 0,  // Asume que hay un campo para ret_ica
        ret_ica_percentage: parseFloat(row.retention_percentage) || 0,
        total_net: parseFloat(row.amount) || 0,
        total_impuestos: parseFloat(row.tax_amount) || 0,  // Asume que los impuestos vienen en tax_amount
        provider_id: providerId, // Aquí estamos usando el ID del proveedor
        date: formattedDate,
      };

      newExpenses.push(expenseData);
    }

    // Inserción masiva de los gastos en la base de datos
    const insertQuery = `
      INSERT INTO expenses (
        id, user_id, account_id, category, description, estado, invoice_number, provider_invoice_number, comments,
        type, total_gross, discounts, subtotal, ret_vat, ret_vat_percentage, ret_ica, ret_ica_percentage,
        total_net, total_impuestos, provider_id, date
      ) VALUES 
      ${newExpenses.map(
      (_, i) =>
        `($${i * 21 + 1}, $${i * 21 + 2}, $${i * 21 + 3}, $${i * 21 + 4}, $${i * 21 + 5}, $${i * 21 + 6}, 
           $${i * 21 + 7}, $${i * 21 + 8}, $${i * 21 + 9}, $${i * 21 + 10}, $${i * 21 + 11}, $${i * 21 + 12}, 
           $${i * 21 + 13}, $${i * 21 + 14}, $${i * 21 + 15}, $${i * 21 + 16}, $${i * 21 + 17}, $${i * 21 + 18}, 
           $${i * 21 + 19}, $${i * 21 + 20}, $${i * 21 + 21})`
    ).join(', ')}`;

    const insertValues = newExpenses.flatMap(expense => Object.values(expense));
    await client.query(insertQuery, insertValues);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Egresos cargados exitosamente' });

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


export const getVouchers = async (req, res) => {
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


// OBTENER TODOS LOS GASTOS CON ESTADO FALSE
export const getExpensesWithFalseState = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses WHERE estado = false');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener los gastos con estado false:', error);
    res.status(500).json({ error: 'Error al obtener los gastos con estado false' });
  }
};


export const updateExpenseStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (estado === undefined) {
      return res.status(400).json({
        error: 'El estado es requerido',
      });
    }

    await client.query('BEGIN');

    // Recuperamos el gasto para obtener los detalles necesarios
    const expenseQuery = `
      SELECT total_net, account_id, estado 
      FROM expenses 
      WHERE id = $1
    `;
    const expenseResult = await client.query(expenseQuery, [id]);

    if (expenseResult.rows.length === 0) {
      throw new Error('Gasto no encontrado');
    }

    const expense = expenseResult.rows[0];

    // Si el estado ya es igual al solicitado, no hacemos nada
    if (expense.estado === estado) {
      return res.status(200).json({
        message: 'El estado del gasto ya está actualizado',
        data: expense,
      });
    }

    // Si el nuevo estado es true, descontamos el monto de la cuenta
    if (estado) {
      const updateAccountQuery = `
        UPDATE accounts 
        SET balance = balance - $1 
        WHERE id = $2 
        RETURNING balance
      `;

      const accountResult = await client.query(updateAccountQuery, [expense.total_net, expense.account_id]);

      if (accountResult.rows.length === 0) {
        throw new Error('Cuenta no encontrada');
      }

      if (accountResult.rows[0].balance < 0) {
        throw new Error('Saldo insuficiente en la cuenta');
      }
    }

    // Actualizamos el estado del gasto
    const updateExpenseQuery = `
      UPDATE expenses 
      SET estado = $1 
      WHERE id = $2 
      RETURNING *
    `;
    const result = await client.query(updateExpenseQuery, [estado, id]);

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Estado del gasto actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en updateExpenseStatus:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  } finally {
    client.release();
  }
};


