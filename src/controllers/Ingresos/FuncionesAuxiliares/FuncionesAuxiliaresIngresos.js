import pool from '../../../database.js';
import { v4 as uuidv4 } from 'uuid';
import { parse, format, isValid, lastDayOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import xlsx from 'xlsx';



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