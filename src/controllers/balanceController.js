import pool from '../database.js';

// Obtener balance general (solo totales de ingresos y gastos)
export const getGeneralBalance = async (req, res) => {
  const client = await pool.connect();

  try {
    // Obtener el total de ingresos
    const totalIncomesQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_incomes
      FROM incomes
      WHERE estado = true`;

    const incomesResult = await client.query(totalIncomesQuery);

    // Obtener el total de gastos
    const totalExpensesQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE estado = true`;

    const expensesResult = await client.query(totalExpensesQuery);

    // Calcular el balance neto
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
  console.log('Parámetro recibido:', monthYear);

  if (!monthYear || !monthYear.includes('-')) {
    return res.status(400).json({ error: 'Formato de fecha incorrecto, use YYYY-MM' });
  }

  const client = await pool.connect();
  try {
    const [year, month] = monthYear.split('-');
    console.log('Año:', year, 'Mes:', month);

    if (isNaN(year) || isNaN(month)) {
      return res.status(400).json({ error: 'Año o mes no son números válidos' });
    }

    const totalIncomesQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_incomes
      FROM incomes
      WHERE estado = true AND EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
    `;
    const incomesResult = await client.query(totalIncomesQuery, [parseInt(year), parseInt(month)]);

    const totalExpensesQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE estado = true AND EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
    `;
    const expensesResult = await client.query(totalExpensesQuery, [parseInt(year), parseInt(month)]);

    const totalIncomes = incomesResult.rows[0].total_incomes || 0;
    const totalExpenses = expensesResult.rows[0].total_expenses || 0;
    const netBalance = totalIncomes - totalExpenses;

    console.log('Balance mensual calculado:', { totalIncomes, totalExpenses, netBalance });

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

