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
  
      console.log("✅ Archivo recibido, procesando...");
  
      // Leer el archivo Excel desde el buffer
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);
  
      if (rows.length === 0) {
        return res.status(400).json({ error: 'El archivo está vacío' });
      }
  
      console.log("✅ Filas del archivo:", rows); // Log de las filas recibidas
  
      // Obtener cuentas y categorías de la base de datos
      const accounts = await client.query('SELECT id, name, balance FROM accounts');
      const categories = await client.query('SELECT id, name, type FROM categories');
  
      // Convertir las claves del mapa a minúsculas
      const accountMap = new Map(accounts.rows.map(a => [a.name.toLowerCase(), a.id]));
      const categoryMap = new Map(categories.rows.map(c => [c.name.toLowerCase(), c.id]));
  
      console.log("✅ Mapeo de cuentas:", accountMap); // Log de cuentas mapeadas
      console.log("✅ Mapeo de categorías:", categoryMap); // Log de categorías mapeadas
  
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
        console.log("✅ Procesando fila:", row); // Log de la fila que se está procesando
  
        // Convertir account_id y category_id a minúsculas para la comparación
        const accountId = accountMap.get(row.account_id?.toLowerCase());
        const categoryId = categoryMap.get(row.category_id?.toLowerCase());
  
        if (!accountId || !categoryId) {
          throw new Error(`Cuenta o categoría no válidas en la fila: ${JSON.stringify(row)}`);
        }
  
        let formattedDate;
  
        try {
          formattedDate = processDate(row.date); // Procesa la fecha principal
        } catch (error) {
          throw new Error(`Error en la conversión de fecha en la fila: ${JSON.stringify(row)} - ${error.message}`);
        }
  
        // Procesar voucher (si existe)
        const processedVoucher = row.voucher
          ? '{' + row.voucher.split('\n').filter(v => v.trim()).map(v => `"${v.replace(/"/g, '\\"')}"`).join(',') + '}'
          : null;
  
        // Solo los campos que necesitamos
        const expenseData = {
          id: uuidv4(),
          user_id: row.user_id,
          account_id: accountId,
          category_id: categoryId,
          base_total_net: parseFloat(row.base_total_net),
          total_net: parseFloat(row.total_net),
          type: row.type || '',
          sub_type: row.sub_type || '',
          date: formattedDate,
          voucher: processedVoucher,
          description: row.description || '',
          recurrent: row.recurrent || false,
          tax_type: row.tax_type || null,
          tax_percentage: parseFloat(row.tax_percentage) || 0,
          tax_total_net: parseFloat(row.tax_total_net) || 0,
          retention_type: row.retention_type || null,
          retention_percentage: parseFloat(row.retention_percentage) || 0,
          retention_total_net: parseFloat(row.retention_total_net) || 0,
          timerecurrent: row.timerecurrent || 0,
          estado: row.estado || true,
          provider_id: row.provider_id || null,
        };
  
        newExpenses.push(expenseData);
  
        // Actualización del balance de la cuenta después de cada gasto
        if (expenseData.estado) {
          const accountQuery = 'SELECT balance FROM accounts WHERE id = $1';
          const accountResult = await client.query(accountQuery, [accountId]);
  
          const currentBalance = parseFloat(accountResult.rows[0].balance) || 0;
          const newBalance = currentBalance - expenseData.total_net; // Restar el nuevo gasto al balance actual
  
          const updateAccountQuery = 'UPDATE accounts SET balance = $1 WHERE id = $2';
          await client.query(updateAccountQuery, [newBalance, accountId]);
        }
      }
  
      // Insertar en la base de datos
      const insertQuery = `
        INSERT INTO expenses (
          id, user_id, account_id, category_id, base_total_net, total_net, type, sub_type, date, voucher, description,
          recurrent, tax_type, tax_percentage, tax_total_net, retention_type, retention_percentage, retention_total_net,
          timerecurrent, estado, provider_id
        ) VALUES 
        ${newExpenses.map(
        (_, i) =>
          `($${i * 21 + 1}, $${i * 21 + 2}, $${i * 21 + 3}, $${i * 21 + 4}, $${i * 21 + 5}, $${i * 21 + 6}, $${i * 21 + 7}, $${i * 21 + 8}, $${i * 21 + 9}, $${i * 21 + 10}, $${i * 21 + 11}, $${i * 21 + 12}, $${i * 21 + 13}, $${i * 21 + 14}, $${i * 21 + 15}, $${i * 21 + 16}, $${i * 21 + 17}, $${i * 21 + 18}, $${i * 21 + 19}, $${i * 21 + 20}, $${i * 21 + 21})`
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


  