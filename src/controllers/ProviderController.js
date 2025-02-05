import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';

const providerSchema = Joi.object({
  tipo_identificacion: Joi.string().required(),
  numero_identificacion: Joi.string().required(),
  dv: Joi.string().length(1).optional(),
  tipo_persona: Joi.string().required(),
  razon_social: Joi.string().required(),
  nombre_comercial: Joi.string().optional(),
  tipo_regimen: Joi.string().required(),
  direccion: Joi.string().required(),
  ciudad: Joi.string().required(),
  departamento: Joi.string().required(),
  pais: Joi.string().default('Colombia'),
  codigo_postal: Joi.string().optional(),
  telefono: Joi.string().optional(),
  email: Joi.string().email().required(),
  codigo_actividad_economica: Joi.string().optional(),
  responsabilidad_fiscal: Joi.string().optional(),
  matricula_mercantil: Joi.string().optional(),
  estado: Joi.boolean().default(true)
});


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
    // Validar los datos de entrada con Joi
    const { error } = providerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details
      });
    }

    // Extraer los datos del cuerpo de la solicitud
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

    // Generar un UUID para el ID del proveedor
    const id = uuidv4();

    // Consulta SQL para insertar el proveedor
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

    // Valores para la consulta SQL
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

    // Ejecutar la consulta SQL
    const result = await pool.query(query, values);

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error en createProvider:', error);

    // Manejar errores de duplicidad (por ejemplo, NIT repetido)
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Conflicto',
        details: 'Ya existe un proveedor con estos datos'
      });
    }

    // Manejar otros errores
    res.status(500).json({
      success: false,
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
