import pool from '../../database.js';
import { v4 as uuidv4 } from 'uuid';

export const createExpense = async (req, res) => {
  const client = await pool.connect();
  console.log('Inicio de createExpense');

  try {
    await client.query('BEGIN');
    console.log('Transacción iniciada');

    const {
      user_id, account_id, tipo, date, proveedor, categoria, description, estado,
      expense_items, expense_totals, facturaNumber, facturaProvNumber, comentarios, voucher
    } = req.body;

    // Validación básica
    if (!user_id || !account_id || !date || !expense_totals?.total_neto) {
      console.log('Validación fallida: campos requeridos faltantes');
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'user_id, account_id, date y total_neto son obligatorios'
      });
    }

    // Actualizar balance de cuenta
    console.log('Actualizando balance de cuenta');
    const updateAccountQuery = `
      UPDATE accounts
      SET balance = balance - $1
      WHERE id = $2
      RETURNING balance`;
    const accountResult = await client.query(updateAccountQuery, [expense_totals.total_neto, account_id]);
    if (accountResult.rows.length === 0) {
      throw new Error('Cuenta no encontrada');
    }
    if (accountResult.rows[0].balance < 0) {
      throw new Error('Saldo insuficiente en la cuenta');
    }

    // Procesar voucher
    let parsedVoucher = [];
    if (voucher) {
      console.log('Procesando voucher:', voucher);
      parsedVoucher = typeof voucher === 'string' ? JSON.parse(voucher) : Array.isArray(voucher) ? voucher : [];
    }

    // Insertar gasto principal
    console.log('Insertando gasto');
    const insertExpenseQuery = `
      INSERT INTO expenses (
        id, user_id, account_id, date, provider_id, category, description,
        estado, invoice_number, provider_invoice_number, comments,
        voucher, type, total_gross, discounts, subtotal,
        ret_vat, ret_vat_percentage, ret_ica, ret_ica_percentage,
        total_net, total_impuestos
      )
      VALUES ($1, $2, $3, $4::timestamp, $5, $6, $7, $8, $9, $10,
              $11, $12::text[], $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`;
    const expenseValues = [
      uuidv4(), user_id, account_id, date, proveedor, categoria || null,
      description, estado, facturaNumber, facturaProvNumber, comentarios,
      parsedVoucher, tipo, expense_totals.total_bruto, expense_totals.descuentos,
      expense_totals.subtotal, expense_totals.iva, expense_totals.iva_percentage,
      expense_totals.retencion, expense_totals.retencion_percentage,
      expense_totals.total_neto, expense_totals.total_impuestos
    ];
    const expenseResult = await client.query(insertExpenseQuery, expenseValues);
    const expense = expenseResult.rows[0];

    // Insertar items del gasto
    console.log('Insertando items del gasto');
    const insertItemQuery = `
      INSERT INTO expense_items (
        id, expense_id, category, product_name, quantity, unit_price, discount,
        total, tax_charge, tax_withholding
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`;
    const itemResults = [];
    for (const item of expense_items || []) {
      const itemValues = [
        uuidv4(), expense.id, item.categoria || null, item.product || item.product_name || null,
        item.quantity || 0, item.unit_price || item.unitPrice || 0, item.discount || 0,
        item.total || 0, item.tax_charge || item.taxCharge || 0,
        item.tax_withholding || item.taxWithholding || 0
      ];
      const itemResult = await client.query(insertItemQuery, itemValues);
      itemResults.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');
    console.log('Transacción confirmada');

    const responseData = { message: 'Gasto creado exitosamente', data: { ...expense, items: itemResults } };
    console.log('Respondiendo con:', responseData);
    res.status(201).json(responseData);

  } catch (error) {
    console.error('Error en createExpense:', error);
    await client.query('ROLLBACK');
    console.log('Transacción revertida');
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    console.log('Liberando cliente');
    client.release();
  }
};