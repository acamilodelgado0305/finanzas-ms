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
      SELECT COALESCE(SUM(total_net), 0) as total_expenses
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