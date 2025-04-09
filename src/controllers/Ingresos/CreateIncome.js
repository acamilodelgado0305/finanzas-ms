import pool from '../../database.js';
import { v4 as uuidv4 } from 'uuid';
import { createExpense } from '../Expense/CreateExpense.js';

export const createIncome = async (req, res) => {
  const client = await pool.connect();
  console.log('Inicio de createIncome');
  try {
    console.log('Iniciando transacción');
    await client.query('BEGIN');

    const {
      user_id, account_id, category_id, amount, type, date, description, estado,
      amountfev, amountdiverse, cashier_id, arqueo_number, other_income,
      cash_received, cashier_commission, start_period, end_period, comentarios,
      amountcustom, importes_personalizados, voucher
    } = req.body;

    console.log('Datos recibidos:', { type, cashier_commission, arqueo_number });

    // Validación básica
    if (!user_id || !account_id || !date) {
      console.log('Validación fallida: campos requeridos faltantes');
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos user_id, account_id y date son obligatorios'
      });
    }

    // Verificar y actualizar cuenta
    console.log('Verificando cuenta:', account_id);
    const accountQuery = 'SELECT balance FROM accounts WHERE id = $1';
    const accountResult = await client.query(accountQuery, [account_id]);
    if (accountResult.rows.length === 0) {
      console.log('Cuenta no encontrada');
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cuenta inválida', details: 'La cuenta especificada no existe' });
    }
    const currentBalance = parseFloat(accountResult.rows[0].balance) || 0;
    const newBalance = currentBalance + (parseFloat(cash_received) || 0);
    console.log('Actualizando balance de cuenta:', { currentBalance, newBalance });
    const updateAccountQuery = 'UPDATE accounts SET balance = $1 WHERE id = $2';
    await client.query(updateAccountQuery, [newBalance, account_id]);

    // Procesar voucher
    let parsedVoucher = [];
    if (voucher) {
      console.log('Procesando voucher:', voucher);
      parsedVoucher = typeof voucher === 'string' ? JSON.parse(voucher) : Array.isArray(voucher) ? voucher : [];
    }

    // Procesar importes_personalizados
    let importesPersonalizadosJson = null;
    if (importes_personalizados) {
      console.log('Procesando importes_personalizados:', importes_personalizados);
      importesPersonalizadosJson = JSON.stringify(
        Array.isArray(importes_personalizados) ? importes_personalizados : JSON.parse(importes_personalizados)
      );
    }

    // Insertar ingreso
    console.log('Insertando ingreso');
    const createIncomeQuery = `
      INSERT INTO incomes (
        id, user_id, account_id, category_id, amount, type, date, voucher,
        description, estado, amountfev, amountdiverse, cashier_id, arqueo_number,
        other_income, cash_received, cashier_commission, start_period, end_period,
        comentarios, amountcustom, importes_personalizados
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8::text[], $9, $10, $11, $12, $13,
              $14, $15, $16, $17, $18::date, $19::date, $20, $21, $22::jsonb)
      RETURNING *`;
    const values = [
      uuidv4(), user_id, account_id, category_id || null, amount, type || '',
      date, parsedVoucher, description || '', estado || false, amountfev || null,
      amountdiverse || null, cashier_id || null, arqueo_number || null,
      other_income || null, cash_received || null, cashier_commission || null,
      start_period || null, end_period || null, comentarios || null,
      amountcustom || null, importesPersonalizadosJson
    ];
    const result = await client.query(createIncomeQuery, values);
    console.log('Ingreso insertado:', result.rows[0].id);

    // Lógica de comisión (fuera de la transacción principal para evitar bloqueos)
    await client.query('COMMIT'); // Confirmar transacción del ingreso primero
    console.log('Transacción de ingreso confirmada');

    const commissionAmount = parseFloat(cashier_commission) || 0;
    if (type === 'arqueo' && commissionAmount > 0) {
      console.log('Iniciando creación de egreso para comisión');
      if (!arqueo_number) throw new Error('El número de arqueo no está definido');
      if (!cashier_id) throw new Error('cashier_id es requerido para crear una comisión');

      const egresoNumber = `C-${arqueo_number}`;
      const expenseData = {
        user_id, account_id, tipo: 'commission', date, proveedor: cashier_id,
        categoria: null, description: `Comisión de arqueo ${egresoNumber || ''}`,
        estado: true,
        expense_items: [{
          type: 'commission', categoria: null, product: 'Comisión de Arqueo',
          description: `Comisión de arqueo ${egresoNumber}`, quantity: 1,
          unit_price: commissionAmount, discount: 0, total: commissionAmount,
          tax_charge: 0, tax_withholding: 0
        }],
        expense_totals: {
          total_bruto: commissionAmount, descuentos: 0, subtotal: commissionAmount,
          iva: 0, iva_percentage: 0, retencion: 0, retencion_percentage: 0,
          total_neto: commissionAmount, total_impuestos: 0
        },
        facturaNumber: egresoNumber, facturaProvNumber: null,
        comentarios: `Comisión generada automáticamente para el arqueo ${description || ''}`,
        voucher: null
      };

      console.log('Creando egreso con:', expenseData);
      const expenseResponse = await createExpense({ body: expenseData }, {
        status: (code) => ({
          json: (data) => {
            if (code >= 400) throw new Error(`Fallo al crear egreso: ${JSON.stringify(data)}`);
            return data;
          }
        }),
        json: (data) => data
      });
      console.log('Egreso creado:', expenseResponse);
    }

    res.status(201).json({
      message: 'Ingreso creado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error en createIncome:', error);
    try {
      await client.query('ROLLBACK');
      console.log('Transacción revertida');
    } catch (rollbackError) {
      console.error('Error al revertir transacción:', rollbackError);
    }
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    console.log('Liberando cliente');
    client.release();
  }
};