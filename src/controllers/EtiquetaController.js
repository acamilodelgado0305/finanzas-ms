import pool from "../database.js";

// Crear una nueva etiqueta
const createEtiqueta = async (req, res) => {
  const { nombre, categoria } = req.body;
  try {
    if (!nombre || !categoria) {
      return res.status(400).json({ error: 'Nombre y categoría son requeridos' });
    }
    const result = await pool.query(
      'INSERT INTO etiquetas_seguimiento (nombre, categoria) VALUES ($1, $2) RETURNING *',
      [nombre, categoria]
    );
    // Asegúrate de devolver solo la fila de datos
    const etiquetaCreada = result.rows[0];
    res.status(201).json(etiquetaCreada);
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'La etiqueta ya existe' });
    } else {
      // Log del error para depuración, evitando referencias circulares
      console.error('Error en createEtiquetaController:', error.message);
      res.status(500).json({ error: 'Error al crear la etiqueta' });
    }
  }
};

// Listar todas las etiquetas
const getEtiquetas = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM etiquetas_seguimiento ORDER BY nombre');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error en getEtiquetasController:', error.message);
    res.status(500).json({ error: 'Error al obtener las etiquetas' });
  }
};

// Obtener una etiqueta por ID
const getEtiquetaById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM etiquetas_seguimiento WHERE id = $1', [id]);
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Etiqueta no encontrada' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error en getEtiquetaByIdController:', error.message);
    res.status(500).json({ error: 'Error al obtener la etiqueta' });
  }
};

// Actualizar una etiqueta
const updateEtiqueta = async (req, res) => {
  const { id } = req.params;
  const { nombre, categoria } = req.body;
  try {
    if (!nombre || !categoria) {
      return res.status(400).json({ error: 'Nombre y categoría son requeridos' });
    }
    const result = await pool.query(
      'UPDATE etiquetas_seguimiento SET nombre = $1, categoria = $2 WHERE id = $3 RETURNING *',
      [nombre, categoria, id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Etiqueta no encontrada' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'La etiqueta ya existe' });
    } else {
      console.error('Error en updateEtiquetaController:', error.message);
      res.status(500).json({ error: 'Error al actualizar la etiqueta' });
    }
  }
};

// Eliminar una etiqueta
const deleteEtiqueta = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM etiquetas_seguimiento WHERE id = $1 RETURNING *',
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Etiqueta no encontrada' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error en deleteEtiquetaController:', error.message);
    res.status(500).json({ error: 'Error al eliminar la etiqueta' });
  }
};

export {
  createEtiqueta,
  getEtiquetas,
  getEtiquetaById,
  updateEtiqueta,
  deleteEtiqueta,
};