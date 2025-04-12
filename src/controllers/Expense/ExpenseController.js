import pool from '../../database.js';
import { v4 as uuidv4 } from 'uuid';
import { setTimeout } from "timers/promises";
import xlsx from 'xlsx';
import { parse, format, isValid, lastDayOfMonth } from "date-fns";


// Obtener todos los gastos
export const getAllExpenses = async (req, res) => {
  try {
    // Consulta principal para obtener todos los egresos
    const expensesQuery = `
      SELECT * 
      FROM expenses 
      ORDER BY date DESC`;

    const expensesResult = await pool.query(expensesQuery);
    const expenses = expensesResult.rows;

    // Obtener los items relacionados para cada egreso
    const expenseItemsQuery = `
      SELECT * 
      FROM expense_items 
      WHERE expense_id = $1`;

    // Iterar sobre cada egreso y obtener sus items
    const expensesWithItems = await Promise.all(
      expenses.map(async (expense) => {
        const itemsResult = await pool.query(expenseItemsQuery, [expense.id]);
        return {
          ...expense,
          items: itemsResult.rows,
        };
      })
    );

    // Enviar la respuesta con los egresos y sus items
    res.json(expensesWithItems);
  } catch (error) {
    console.error('Error al obtener los gastos:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};



//------------------------OBETNER GASTO POR ID------------------------//
export const getExpenseById = async (req, res) => {
  const { id } = req.params; // ID del egreso
  try {
    // Consulta principal para obtener el egreso
    const expenseQuery = `
      SELECT * 
      FROM expenses 
      WHERE id = $1`;

    const expenseResult = await pool.query(expenseQuery, [id]);
    if (expenseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    const expense = expenseResult.rows[0];

    // Consulta secundaria para obtener los items relacionados
    const itemsQuery = `
      SELECT * 
      FROM expense_items 
      WHERE expense_id = $1`;

    const itemsResult = await pool.query(itemsQuery, [id]);

    // Combinar el egreso con sus items
    const expenseWithItems = {
      ...expense,
      items: itemsResult.rows, // Agregar los items al egreso
    };

    // Enviar la respuesta con el egreso y sus items
    res.json(expenseWithItems);
  } catch (error) {
    console.error('Error al obtener el gasto:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};

export const updateExpense = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      user_id,
      account_id,
      tipo,
      date,
      proveedor,
      categoria,
      description,
      estado,
      expense_items,
      expense_totals,
      facturaNumber,
      facturaProvNumber,
      facturaProvPrefix,
      comentarios,
      etiqueta // Añadir etiqueta
    } = req.body;

    // Validar campos requeridos
    if (!account_id) {
      throw new Error('account_id is required');
    }
    if (!date) {
      throw new Error('date is required');
    }
    if (!expense_totals || !expense_totals.total_neto) {
      throw new Error('expense_totals.total_neto is required');
    }
    if (!expense_items) {
      throw new Error('expense_items is required');
    }

    // Obtener el gasto actual
    const currentExpenseQuery = `
      SELECT total_net, account_id, category 
      FROM expenses 
      WHERE id = $1`;
    const currentExpenseResult = await client.query(currentExpenseQuery, [id]);

    if (currentExpenseResult.rows.length === 0) {
      throw new Error(`No se encontró ningún gasto con el ID ${id}`);
    }

    const { total_net: oldTotalNet, account_id: oldAccountId, category: oldCategory } = currentExpenseResult.rows[0];

    // Manejar categoría
    let categoriaValue = oldCategory;
    if (categoria && categoria !== oldCategory) {
      categoriaValue = categoria;
    }

    // Manejar el balance de la cuenta
    if (oldAccountId !== account_id) {
      await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
        [oldTotalNet, oldAccountId]
      );

      const newAccountResult = await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING balance',
        [expense_totals.total_neto, account_id]
      );

      if (newAccountResult.rows.length === 0) {
        throw new Error('La nueva cuenta no existe');
      }

      if (newAccountResult.rows[0].balance < 0) {
        throw new Error('Saldo insuficiente en la nueva cuenta');
      }
    } else {
      const difference = expense_totals.total_neto - oldTotalNet;
      if (difference !== 0) {
        const accountResult = await client.query(
          'UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING balance',
          [difference, account_id]
        );

        if (accountResult.rows.length === 0) {
          throw new Error('La cuenta no existe');
        }

        if (accountResult.rows[0].balance < 0) {
          throw new Error('Saldo insuficiente en la cuenta');
        }
      }
    }

    // Actualizar el gasto principal incluyendo provider_invoice_prefix y etiqueta
    const updateExpenseQuery = `
      UPDATE expenses SET 
        user_id = $1,
        account_id = $2,
        date = $3,
        provider_id = $4,
        category = $5,
        description = $6,
        estado = $7,
        invoice_number = $8,
        provider_invoice_number = $9,
        provider_invoice_prefix = $10,
        comments = $11,
        type = $12,
        total_gross = $13,
        discounts = $14,
        subtotal = $15,
        ret_vat = $16,
        ret_vat_percentage = $17,
        ret_ica = $18,
        ret_ica_percentage = $19,
        total_net = $20,
        total_impuestos = $21,
        etiqueta = $22
      WHERE id = $23
      RETURNING *`;

    const expenseValues = [
      user_id,
      account_id,
      date,
      proveedor,
      categoriaValue,
      description,
      estado,
      facturaNumber,
      facturaProvNumber,
      facturaProvPrefix || null,
      comentarios,
      tipo,
      expense_totals.total_bruto,
      expense_totals.descuentos,
      expense_totals.subtotal,
      expense_totals.iva,
      expense_totals.iva_percentage,
      expense_totals.retencion,
      expense_totals.retencion_percentage,
      expense_totals.total_neto,
      expense_totals.total_impuestos,
      etiqueta || null, // Añadir etiqueta
      id
    ];

    const expenseResult = await client.query(updateExpenseQuery, expenseValues);
    const expense = expenseResult.rows[0];

    // Manejar los ítems del gasto
    const currentItemsQuery = `
      SELECT id, category, product_name, quantity, unit_price, discount, total, tax_charge, tax_withholding 
      FROM expense_items 
      WHERE expense_id = $1`;
    const currentItemsResult = await client.query(currentItemsQuery, [id]);
    const currentItems = currentItemsResult.rows;

    const currentItemsMap = new Map(currentItems.map(item => [item.id, item]));

    const insertItemQuery = `
      INSERT INTO expense_items (
        id, expense_id, category, product_name,
        quantity, unit_price, discount, total, tax_charge, tax_withholding
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`;

    const updateItemQuery = `
      UPDATE expense_items SET
        category = $1,
        product_name = $2,
        quantity = $3,
        unit_price = $4,
        discount = $5,
        total = $6,
        tax_charge = $7,
        tax_withholding = $8
      WHERE id = $9
      RETURNING *`;

    const itemResults = [];
    const itemsToDelete = new Set(currentItems.map(item => item.id));

    for (const item of expense_items) {
      if (!item.product && !item.product_name) {
        throw new Error('product_name is required for expense items');
      }
      if (!item.quantity || item.quantity <= 0) {
        throw new Error('quantity must be greater than 0 for expense items');
      }
      if (!item.unit_price) {
        throw new Error('unit_price is required for expense items');
      }

      let itemCategoriaValue = item.categoria || null;

      if (item.id && currentItemsMap.has(item.id)) {
        // Actualizar ítem existente
        itemsToDelete.delete(item.id);

        const itemValues = [
          itemCategoriaValue,
          item.product || item.product_name,
          item.quantity,
          item.unit_price,
          item.discount || 0,
          (item.quantity * item.unit_price) - (item.discount || 0),
          item.tax_charge || 0,
          item.tax_withholding || 0,
          item.id
        ];

        const itemResult = await client.query(updateItemQuery, itemValues);
        itemResults.push(itemResult.rows[0]);
      } else {
        // Insertar nuevo ítem
        const itemValues = [
          uuidv4(),
          expense.id,
          itemCategoriaValue,
          item.product || item.product_name,
          item.quantity,
          item.unit_price,
          item.discount || 0,
          (item.quantity * item.unit_price) - (item.discount || 0),
          item.tax_charge || 0,
          item.tax_withholding || 0
        ];

        const itemResult = await client.query(insertItemQuery, itemValues);
        itemResults.push(itemResult.rows[0]);
      }
    }

    if (itemsToDelete.size > 0) {
      const deleteItemsQuery = 'DELETE FROM expense_items WHERE id = ANY($1)';
      await client.query(deleteItemsQuery, [Array.from(itemsToDelete)]);
    }

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Gasto actualizado exitosamente',
      data: {
        ...expense,
        items: itemResults
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en updateExpense:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
};

export const deleteExpense = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    // Obtener detalles del gasto antes de eliminarlo
    const expenseQuery = `
      SELECT total_net, account_id, estado 
      FROM expenses 
      WHERE id = $1
    `;
    const expenseResult = await client.query(expenseQuery, [id]);
    if (expenseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Gasto no encontrado',
        details: `No se encontró ningún gasto con el ID ${id}`
      });
    }
    const { total_net, account_id, estado } = expenseResult.rows[0];

    // Solo devolver el monto si el estado del gasto era true (activo)
    if (estado) {
      // Actualizar el saldo de la cuenta
      const updateAccountQuery = `
        UPDATE accounts 
        SET balance = balance + $1 
        WHERE id = $2 
        RETURNING *
      `;
      const accountResult = await client.query(updateAccountQuery, [total_net, account_id]);
      if (accountResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Cuenta no encontrada',
          details: 'La cuenta asociada al gasto no existe'
        });
      }
    }

    // Eliminar los items relacionados con el gasto
    const deleteItemsQuery = `
      DELETE FROM expense_items 
      WHERE expense_id = $1
    `;
    await client.query(deleteItemsQuery, [id]);

    // Eliminar el gasto principal
    const deleteExpenseQuery = `
      DELETE FROM expenses 
      WHERE id = $1 
      RETURNING *
    `;
    const deleteResult = await client.query(deleteExpenseQuery, [id]);

    // Confirmar la transacción
    await client.query('COMMIT');

    res.status(200).json({
      status: 'success',
      message: 'Gasto y sus items eliminados exitosamente',
      data: deleteResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en deleteExpense:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
};