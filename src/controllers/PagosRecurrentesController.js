import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid'; // Para generar UUIDs

// Crear un nuevo pago pendiente
export const createPago = async (req, res) => {
  try {
    const { descripcion, valor, date, cuenta, categoria, recurrencia } = req.body;

    // Validar que todos los campos obligatorios estén presentes
    if (!descripcion || !valor || !date || !cuenta || !categoria || !recurrencia) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    // Generar un UUID para el id
    const id = uuidv4();

    // Consulta SQL para insertar un nuevo pago (sin favorite)
    const query = `
      INSERT INTO pagosrecurrentes (id, descripcion, valor, date, cuenta, categoria, recurrencia)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [id, descripcion, valor, date, cuenta, categoria, recurrencia];

    const { rows } = await pool.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    // Manejo de errores, por ejemplo, si las claves foráneas no existen
    if (error.code === '23503') { // Error de clave foránea en PostgreSQL
      return res.status(400).json({ message: "El valor de 'cuenta' o 'categoria' no existe en las tablas referenciadas" });
    }
    res.status(500).json({ message: "Error al crear el pago pendiente", error: error.message });
  }
};

// Obtener todos los pagos pendientes
export const getPagos = async (req, res) => {
  try {
    const query = `SELECT * FROM pagosrecurrentes;`;
    const { rows } = await pool.query(query);
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los pagos pendientes", error: error.message });
  }
};

// Obtener un pago pendiente por ID
export const getPagoById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar que el ID sea un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ message: "ID inválido, debe ser un UUID" });
    }

    const query = `SELECT * FROM pagosrecurrentes WHERE id = $1;`;
    const values = [id];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Pago pendiente no encontrado" });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el pago pendiente", error: error.message });
  }
};

// Actualizar un pago pendiente
export const updatePago = async (req, res) => {
  try {
    const { id } = req.params;
    const { descripcion, valor, date, cuenta, categoria, recurrencia } = req.body;

    // Validar que el ID sea un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ message: "ID inválido, debe ser un UUID" });
    }

    // Construir la consulta dinámicamente para actualizar solo los campos proporcionados
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (descripcion) {
      fields.push(`descripcion = $${paramIndex++}`);
      values.push(descripcion);
    }
    if (valor) {
      fields.push(`valor = $${paramIndex++}`);
      values.push(valor);
    }
    if (date) {
      fields.push(`date = $${paramIndex++}`);
      values.push(date);
    }
    if (cuenta) {
      fields.push(`cuenta = $${paramIndex++}`);
      values.push(cuenta);
    }
    if (categoria) {
      fields.push(`categoria = $${paramIndex++}`);
      values.push(categoria);
    }
    if (recurrencia) {
      fields.push(`recurrencia = $${paramIndex++}`);
      values.push(recurrencia);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });
    }

    values.push(id); // El ID va al final para el WHERE
    const query = `
      UPDATE pagosrecurrentes
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Pago pendiente no encontrado para actualizar" });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    if (error.code === '23503') { // Error de clave foránea
      return res.status(400).json({ message: "El valor de 'cuenta' o 'categoria' no existe en las tablas referenciadas" });
    }
    res.status(500).json({ message: "Error al actualizar el pago pendiente", error: error.message });
  }
};

// Eliminar un pago pendiente
export const deletePago = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar que el ID sea un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ message: "ID inválido, debe ser un UUID" });
    }

    const query = `DELETE FROM pagosrecurrentes WHERE id = $1 RETURNING *;`;
    const values = [id];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Pago pendiente no encontrado para eliminar" });
    }
    res.status(200).json({ message: "Pago pendiente eliminado", deletedPago: rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el pago pendiente", error: error.message });
  }
};