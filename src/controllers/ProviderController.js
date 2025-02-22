import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';

// Esquema de validación con Joi
const providerSchema = Joi.object({
  tipoTercero: Joi.string().required(),
  tipoPersona: Joi.string().required(),
  tipoIdentificacion: Joi.string().required(),
  identificacion: Joi.string().optional().allow(''),
  nombreComercial: Joi.string().optional().allow(''),
  codigoSucursal: Joi.string().optional(),
  nombresContacto: Joi.string().required(),
  apellidosContacto: Joi.string().required(),
  ciudad: Joi.string().required(),
  direccion: Joi.string().required(),
  nombresContactoFacturacion: Joi.string().optional(),
  apellidosContactoFacturacion: Joi.string().optional(),
  correoElectronicoFacturacion: Joi.string().email().optional(),
  tipoRegimen: Joi.string().required(),
  telefonoFacturacion: Joi.string().optional(),
  codigoPostal: Joi.string().optional(),
  nit: Joi.string().optional().allow(''),
  dv: Joi.string().optional().allow(''),
});

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
      tipoTercero,
      tipoPersona,
      tipoIdentificacion,
      identificacion,
      nombreComercial,
      codigoSucursal,
      nombresContacto,
      apellidosContacto,
      ciudad,
      direccion,
      nombresContactoFacturacion,
      apellidosContactoFacturacion,
      correoElectronicoFacturacion,
      tipoRegimen,
      telefonoFacturacion,
      codigoPostal,
      nit,
      dv,
    } = req.body;

    // Generar un UUID para el ID del proveedor
    const id = uuidv4();

    // Consulta SQL para insertar el proveedor
    const query = `
      INSERT INTO proveedores (
        id,
        tipo_tercero,
        tipo_persona,
        tipo_identificacion,
        numero_identificacion,
        nombre_comercial,
        tipo_regimen,
        direccion,
        ciudad,
        nombres_contacto,
        apellidos_contacto,
        nombres_contacto_facturacion,
        apellidos_contacto_facturacion,
        correo_contacto_facturacion,
        telefono_facturacion,
        codigo_postal,
        codigo_sucursal,
        nit,
        dv, 
        estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19 ,$20)
      RETURNING *`;

    // Valores para la consulta SQL
    const values = [
      id,
      tipoTercero,
      tipoPersona,
      tipoIdentificacion,
      identificacion,
      nombreComercial || '',
      tipoRegimen,
      direccion,
      ciudad,
      nombresContacto,
      apellidosContacto,
      nombresContactoFacturacion || '',
      apellidosContactoFacturacion || '',
      correoElectronicoFacturacion || null,
      telefonoFacturacion || '',
      codigoPostal || '',
      codigoSucursal || '',
      nit || null,
      dv || null,
      'activo',
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

// Obtener todos los proveedores
export const getAllProviders = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los proveedores' });
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
    tipoTercero,
    tipoPersona,
    tipoIdentificacion,
    identificacion,
    nombreComercial,
    tipoRegimen,
    direccion,
    ciudad,
    nombresContacto,
    apellidosContacto,
    nombresContactoFacturacion,
    apellidosContactoFacturacion,
    telefonoFacturacion,
    codigoPostal,
    codigoSucursal,
    nit,
    estado,
    dv,  // Incluir dv aquí también
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE proveedores
      SET tipo_tercero = $1, tipo_persona = $2, tipo_identificacion = $3, numero_identificacion = $4, 
          nombre_comercial = $5, tipo_regimen = $6, direccion = $7, ciudad = $8, nombres_contacto = $9, 
          apellidos_contacto = $10, nombres_contacto_facturacion = $11, apellidos_contacto_facturacion = $12, 
          telefono_facturacion = $13, codigo_postal = $14, codigo_sucursal = $15, nit = $16, dv = $17, estado = $18
      WHERE id = $19 RETURNING *`,
      [
        tipoTercero,
        tipoPersona,
        tipoIdentificacion,
        identificacion,
        nombreComercial,
        tipoRegimen,
        direccion,
        ciudad,
        nombresContacto,
        apellidosContacto,
        nombresContactoFacturacion,
        apellidosContactoFacturacion,
        telefonoFacturacion,
        codigoPostal,
        codigoSucursal,
        nit,
        dv,
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

// Eliminar un proveedor
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
