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

    // Obtener cuentas, categorías y cajeros de la base de datos
    const accounts = await client.query('SELECT id, name, balance FROM accounts');
    const categories = await client.query('SELECT id, name, type FROM categories');
    const cajeros = await client.query('SELECT id_cajero, nombre FROM cajeros'); // Obtener cajeros

    const accountMap = new Map(
      accounts.rows.map(a => [a.name.trim().toLowerCase(), a.id])
    );
    const categoryMap = new Map(
      categories.rows.map(c => [c.name.toLowerCase(), c.id])
    );
    const cashierMap = new Map(
      cajeros.rows.map(c => [c.nombre.toLowerCase(), c.id_cajero]) // Usamos el nombre del cajero en minúsculas como clave
    );

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
      // Obtener accountId usando el nombre de la cuenta
      const accountId = row.account && typeof row.account === 'string'
        ? accountMap.get(row.account.trim().toLowerCase())
        : null;

      // Obtener categoryId usando el nombre de la categoría
      const categoryId = row.category && typeof row.category === 'string'
        ? categoryMap.get(row.category.trim().toLowerCase())
        : null;

      // Obtener cashierId usando el nombre del cajero
      const cashierId = row.cashier_name && typeof row.cashier_name === 'string'
        ? cashierMap.get(row.cashier_name.trim().toLowerCase())
        : null;


      if (!accountId || !categoryId || !cashierId) {
        if (!accountId) {
          console.error(`Cuenta no válida en la fila: ${JSON.stringify(row)}`);
        }
        if (!categoryId) {
          console.error(`Categoría no válida en la fila: ${JSON.stringify(row)}`);
        }
        if (!cashierId) {
          console.error(`Cajero no válido en la fila: ${JSON.stringify(row)}`);
        }

        throw new Error(`Cuenta, categoría o cajero no válidos en la fila: ${JSON.stringify(row)}`);
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
        category_id: categoryId || null,
        amount: parseFloat(row.amount),
        type: row.type || '',
        date: formattedDate, // Ahora en formato "YYYY-MM-DD"
        voucher: row.voucher || null,
        description: row.description || '',
        estado: row.estado || true,
        amountfev: parseFloat(row.amountfev) || 0,
        amountdiverse: parseFloat(row.amountdiverse) || 0,
        cashier_id: cashierId,
        arqueo_number: row.arqueo_number || null,
        other_income: row.other_income || null,
        cash_received: row.cash_received || null,
        cashier_commission: row.cashier_commission || null,
        start_period: formattedStartPeriod,
        end_period: formattedEndPeriod,
        comentarios: row.comentarios || null,
        amountcustom: row.amountcustom || null,
        importes_personalizados: row.importes_personalizados || null, // Asegúrate de que este campo esté en el formato correcto
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
        cashier_id, arqueo_number, other_income, cash_received, cashier_commission, start_period, end_period , comentarios, amountcustom, importes_personalizados
      ) VALUES 
      ${newIncomes.map(
      (_, i) =>
        `($${i * 22 + 1}, $${i * 22 + 2}, $${i * 22 + 3}, $${i * 22 + 4}, $${i * 22 + 5}, $${i * 22 + 6}, $${i * 22 + 7}, $${i * 22 + 8}, $${i * 22 + 9}, $${i * 22 + 10}, $${i * 22 + 11}, $${i * 22 + 12}, $${i * 22 + 13}, $${i * 22 + 14}, $${i * 22 + 15}, $${i * 22 + 16}, $${i * 22 + 17}, $${i * 22 + 18}, $${i * 22 + 19}, $${i * 22 + 20}, $${i * 22 + 21}, $${i * 22 + 22})`
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

    // Obtener el id de los parámetros de la URL
    const id = req.params.id; // Cambiado de req.body a req.params.id
    const { action, vouchers } = req.body; // action y vouchers siguen viniendo del cuerpo

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
        if (!vouchers || !Array.isArray(vouchers)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Datos inválidos',
            details: 'Se deben proporcionar vouchers para agregar'
          });
        }
        updatedVouchers = [...currentVouchers, ...vouchers];
        break;

      case 'remove':
        if (!vouchers || !Array.isArray(vouchers)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Datos inválidos',
            details: 'Se deben proporcionar vouchers para eliminar'
          });
        }
        updatedVouchers = currentVouchers.filter(v => !vouchers.includes(v));
        break;

      case 'update':
        if (!vouchers || !Array.isArray(vouchers)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Datos inválidos',
            details: 'Se debe proporcionar el nuevo array de vouchers'
          });
        }
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