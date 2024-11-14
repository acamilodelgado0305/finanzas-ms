import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';

// Obtener todos los proveedores
export const getAllProviders = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los proveedores' });
  }
};

// Crear un nuevo proveedor
export const createProvider = async (req, res) => {
  try {
    const {
      tipo_identificacion,
      numero_identificacion,
      dv,
      tipo_persona,
      razon_social,
      nombre_comercial,
      tipo_regimen,
      direccion,
      ciudad,
      departamento,
      pais,
      codigo_postal,
      telefono,
      email,
      codigo_actividad_economica,
      responsabilidad_fiscal,
      matricula_mercantil,
      estado
    } = req.body;

    // Generar UUID
    const id = uuidv4();

    // Validación de campos requeridos
    if (!tipo_identificacion || !numero_identificacion || !tipo_persona || !razon_social || !direccion || !ciudad || !departamento || !email) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos tipo_identificacion, numero_identificacion, tipo_persona, razon_social, direccion, ciudad, departamento y email son obligatorios'
      });
    }

    const query = `
      INSERT INTO proveedores (
        id,
        tipo_identificacion,
        numero_identificacion,
        dv,
        tipo_persona,
        razon_social,
        nombre_comercial,
        tipo_regimen,
        direccion,
        ciudad,
        departamento,
        pais,
        codigo_postal,
        telefono,
        email,
        codigo_actividad_economica,
        responsabilidad_fiscal,
        matricula_mercantil,
        estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`;

    const values = [
      id,
      tipo_identificacion,
      numero_identificacion,
      dv || null,
      tipo_persona,
      razon_social,
      nombre_comercial || '',
      tipo_regimen,
      direccion,
      ciudad,
      departamento,
      pais || 'Colombia',
      codigo_postal || '',
      telefono || '',
      email,
      codigo_actividad_economica || '',
      responsabilidad_fiscal || '',
      matricula_mercantil || '',
      estado || true
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      message: 'Proveedor creado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error en createProvider:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Conflicto',
        details: 'Ya existe un proveedor con estos datos'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

// Obtener un proveedor por ID
export const getProviderById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM proveedores WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el proveedor' });
  }
};

// Actualizar un proveedor
export const updateProvider = async (req, res) => {
  const { id } = req.params;
  const {
    tipo_identificacion,
    numero_identificacion,
    dv,
    tipo_persona,
    razon_social,
    nombre_comercial,
    tipo_regimen,
    direccion,
    ciudad,
    departamento,
    pais,
    codigo_postal,
    telefono,
    email,
    codigo_actividad_economica,
    responsabilidad_fiscal,
    matricula_mercantil,
    estado
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE proveedores
      SET tipo_identificacion = $1, numero_identificacion = $2, dv = $3, tipo_persona = $4, razon_social = $5,
          nombre_comercial = $6, tipo_regimen = $7, direccion = $8, ciudad = $9, departamento = $10,
          pais = $11, codigo_postal = $12, telefono = $13, email = $14, codigo_actividad_economica = $15,
          responsabilidad_fiscal = $16, matricula_mercantil = $17, estado = $18
      WHERE id = $19 RETURNING *`,
      [
        tipo_identificacion,
        numero_identificacion,
        dv,
        tipo_persona,
        razon_social,
        nombre_comercial,
        tipo_regimen,
        direccion,
        ciudad,
        departamento,
        pais,
        codigo_postal,
        telefono,
        email,
        codigo_actividad_economica,
        responsabilidad_fiscal,
        matricula_mercantil,
        estado,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Proveedor no encontrado',
        details: `No se encontró ningún proveedor con el ID ${id}`
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Proveedor actualizado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error en updateProvider:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Conflicto',
        details: 'Ya existe un proveedor con estos datos únicos'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

// Eliminar un proveedor
export const deleteProvider = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM proveedores WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Proveedor no encontrado',
        details: `No se encontró ningún proveedor con el ID ${id}`
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Proveedor eliminado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error en deleteProvider:', error);

    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Conflicto de dependencia',
        details: 'Este proveedor no puede ser eliminado porque está referenciado en otras tablas'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};
