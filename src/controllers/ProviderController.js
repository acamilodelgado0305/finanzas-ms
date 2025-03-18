import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';

// Esquema de validación con Joi
const providerSchema = Joi.object({
  tipoIdentificacion: Joi.string().required(),
  numeroIdentificacion: Joi.string().required(),
  nombreComercial: Joi.string().required(),
  nombresContacto: Joi.string().required(),
  apellidosContacto: Joi.string().required(),
  ciudad: Joi.string().required(),
  direccion: Joi.string().required(),
  correoContactoFacturacion: Joi.string().email().required(),
  telefonoFacturacion: Joi.string().required(),
  estado: Joi.string().valid('activo', 'inactivo').default('activo'),
});

export const createProvider = async (req, res) => {
  try {
    // Validar los datos de entrada con Joi
    const { error } = providerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details,
      });
    }

    // Extraer los datos del cuerpo de la solicitud
    const {
      tipoIdentificacion,
      numeroIdentificacion,
      nombreComercial,
      nombresContacto,
      apellidosContacto,
      ciudad,
      direccion,
      correoContactoFacturacion,
      telefonoFacturacion,
      estado,
    } = req.body;

    // Generar un UUID para el ID
    const id = uuidv4();

    // Iniciar una transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insertar en la tabla proveedores
      const proveedorQuery = `
        INSERT INTO proveedores (
          id,
          tipo_identificacion,
          numero_identificacion,
          nombre_comercial,
          nombres_contacto,
          apellidos_contacto,
          direccion,
          ciudad,
          correo_contacto_facturacion,
          telefono_facturacion,
          estado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`;
      const proveedorValues = [
        id,
        tipoIdentificacion,
        numeroIdentificacion,
        nombreComercial,
        nombresContacto,
        apellidosContacto,
        direccion,
        ciudad,
        correoContactoFacturacion,
        telefonoFacturacion,
        estado || 'activo',
      ];

      // Ejecutar la consulta para proveedores
      const proveedorResult = await client.query(proveedorQuery, proveedorValues);

      // Insertar en la tabla terceros
      const terceroQuery = `
        INSERT INTO terceros (id, nombre, tipo)
        VALUES ($1, $2, $3)
        RETURNING *`;
      const terceroValues = [id, nombreComercial, 'proveedor'];
      const terceroResult = await client.query(terceroQuery, terceroValues);

      // Confirmar la transacción
      await client.query('COMMIT');

      // Respuesta exitosa
      res.status(201).json({
        success: true,
        message: 'Proveedor y tercero creados exitosamente',
        data: {
          proveedor: proveedorResult.rows[0],
          tercero: terceroResult.rows[0],
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en createProvider:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Conflicto',
        details: 'Ya existe un proveedor con estos datos',
      });
    }
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
};

// Obtener todos los proveedores (sin cambios)
export const getAllProviders = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los proveedores' });
  }
};

// Obtener un proveedor por ID (sin cambios)
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

// Actualizar un proveedor (sin cambios relevantes aquí, pero ajustado)
export const updateProvider = async (req, res) => {
  const { id } = req.params;
  const {
    tipoIdentificacion,
    numeroIdentificacion,
    nombreComercial,
    nombresContacto,
    apellidosContacto,
    ciudad,
    direccion,
    correoContactoFacturacion,
    telefonoFacturacion,
    estado,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE proveedores
       SET tipo_identificacion = $1,
           numero_identificacion = $2,
           nombre_comercial = $3,
           nombres_contacto = $4,
           apellidos_contacto = $5,
           direccion = $6,
           ciudad = $7,
           correo_contacto_facturacion = $8,
           telefono_facturacion = $9,
           estado = $10
       WHERE id = $11 RETURNING *`,
      [
        tipoIdentificacion,
        numeroIdentificacion,
        nombreComercial,
        nombresContacto,
        apellidosContacto,
        direccion,
        ciudad,
        correoContactoFacturacion,
        telefonoFacturacion,
        estado,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Proveedor no encontrado',
        details: `No se encontró ningún proveedor con el ID ${id}`,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Proveedor actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error en updateProvider:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Conflicto',
        details: 'Ya existe un proveedor con estos datos únicos',
      });
    }
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
};

// Eliminar un proveedor (sin cambios)
export const deleteProvider = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM proveedores WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Proveedor no encontrado',
        details: `No se encontró ningún proveedor con el ID ${id}`,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Proveedor eliminado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error en deleteProvider:', error);
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Conflicto de dependencia',
        details: 'Este proveedor no puede ser eliminado porque está referenciado en otras tablas',
      });
    }
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
};