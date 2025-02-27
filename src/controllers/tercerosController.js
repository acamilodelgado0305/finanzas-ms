import pool from '../database.js';



// Endpoint para carga masiva



//--------------------------OBTENER TODOS LOS INGRESOS------------------------------//
export const getAllTerceros = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM terceros');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los terceros' });
  }
};


//----------------------------CREAR INGRESO---------------------------------------//


//---------------------------- OBTENER INGRESO POR ID------------------------------------//
export const getTerceroById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM terceros WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el tercero' });
  }
};







