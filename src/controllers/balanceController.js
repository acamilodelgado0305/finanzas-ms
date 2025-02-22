import pool from '../database.js';

// Obtener balance general (solo totales de ingresos y gastos)
export const getGeneralBalance = async (req, res) => {
  const client = await pool.connect();

  try {
    // Verificar que la columna "amount" exista en la tabla "incomes"
    const checkIncomesColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'incomes' AND column_name = 'amount';
    `;
    // Verificar que la columna "total_net" exista en la tabla "expenses"
    const checkExpensesColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'expenses' AND column_name = 'total_net';
    `;

    const incomesColumnResult = await client.query(checkIncomesColumnQuery);
    const expensesColumnResult = await client.query(checkExpensesColumnQuery);

    if (incomesColumnResult.rows.length === 0 || expensesColumnResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Las tablas no tienen las columnas necesarias ("amount" o "total_net")'
      });
    }

    // Obtener el total de ingresos
    const totalIncomesQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_incomes
      FROM incomes
      WHERE estado = true`;
    const incomesResult = await client.query(totalIncomesQuery);

    // Obtener el total de gastos, usando "total_net" en lugar de "amount"
    const totalExpensesQuery = `
      SELECT COALESCE(SUM(total_net), 0) as total_expenses
      FROM expenses
      WHERE estado = true`;
    const expensesResult = await client.query(totalExpensesQuery);

    // Si no hay ingresos ni gastos, el balance neto será 0
    const totalIncomes = incomesResult.rows[0].total_incomes || 0;
    const totalExpenses = expensesResult.rows[0].total_expenses || 0;
    const netBalance = totalIncomes - totalExpenses;

    res.json({
      total_incomes: totalIncomes,
      total_expenses: totalExpenses,
      net_balance: netBalance
    });

  } catch (error) {
    console.error('Error en getGeneralBalance:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
};

// Backend: controlador para obtener los balances mensuales
export const getMonthlyBalance = async (req, res) => {
  const { monthYear } = req.params;
  if (!monthYear || !monthYear.includes('-')) {
    return res.status(400).json({ error: 'Formato de fecha incorrecto, use YYYY-MM' });
  }

  const client = await pool.connect();
  try {
    const [year, month] = monthYear.split('-').map(Number);

    if (isNaN(year) || isNaN(month)) {
      return res.status(400).json({ error: 'Año o mes no son números válidos' });
    }

    // Verificar que la columna "amount" exista en la tabla "incomes"
    const checkIncomesColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'incomes' AND column_name = 'amount';
    `;
    // Verificar que la columna "total_net" exista en la tabla "expenses"
    const checkExpensesColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'expenses' AND column_name = 'total_net';
    `;

    const incomesColumnResult = await client.query(checkIncomesColumnQuery);
    const expensesColumnResult = await client.query(checkExpensesColumnQuery);

    if (incomesColumnResult.rows.length === 0 || expensesColumnResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Las tablas no tienen las columnas necesarias ("amount" o "total_net")'
      });
    }

    // Obtener ingresos mensuales
    const totalIncomesQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_incomes
      FROM incomes
      WHERE estado = true AND EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
    `;
    const incomesResult = await client.query(totalIncomesQuery, [year, month]);

    // Obtener gastos mensuales, usando "total_net" en lugar de "amount"
    const totalExpensesQuery = `
      SELECT COALESCE(SUM(total_net), 0) as total_expenses
      FROM expenses
      WHERE estado = true AND EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
    `;
    const expensesResult = await client.query(totalExpensesQuery, [year, month]);

    const totalIncomes = incomesResult.rows[0].total_incomes || 0;
    const totalExpenses = expensesResult.rows[0].total_expenses || 0;
    const netBalance = totalIncomes - totalExpenses;

    res.json({
      total_incomes: totalIncomes,
      total_expenses: totalExpenses,
      net_balance: netBalance
    });

  } catch (error) {
    console.error('Error en getMonthlyBalance:', error);
    res.status(500).json({
      error: 'Error obteniendo balance mensual',
      details: error.message
    });
  } finally {
    client.release();
  }
};
