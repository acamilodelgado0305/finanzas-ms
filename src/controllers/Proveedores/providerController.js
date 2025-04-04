import { v4 as uuidv4 } from 'uuid';
import pool from '../../database.js';
import { providerSchema } from '../../schemas/providerSchema.js';

export const createProvider = async (req, res) => {
  try {
    // Validar los datos con Joi
    const { error } = providerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details,
      });
    }

    // Extraer los datos de la solicitud
    const {
      tipoIdentificacion,
      numeroIdentificacion,
      nombre,
      nombresContacto,
      apellidosContacto,
      ciudad,
      direccion,
      departamento,
      descripcion,
      telefono,
      correo,
      adjuntos, // Si hay adjuntos, los manejamos aquí
      sitioweb,
      medioPago,
      estado,
      fechaVencimiento,
    } = req.body;

    // Archivos adjuntos procesados
    const uploadedFiles = req.files || [];
    let attachments = [];

    // Si hay archivos subidos, agregarlos al array adjuntos
    if (uploadedFiles.length > 0) {
      attachments = uploadedFiles.map(file => ({
        tipo: file.fieldname,
        archivo: file.path, // Guardamos la ruta del archivo
      }));
    }

    // Generar un UUID para el proveedor
    const id = uuidv4();

    // Convertir los arrays a JSON válidos
    const telefonoJSON = JSON.stringify(telefono);  // Convertir el array de teléfonos a JSON
    const correoJSON = JSON.stringify(correo);      // Convertir el array de correos a JSON
    const adjuntosJSON = JSON.stringify(attachments); // Convertir los adjuntos a JSON

    // Iniciar la transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insertar el proveedor
      const proveedorQuery = `
        INSERT INTO proveedores (
          id,
          tipo_identificacion,
          numero_identificacion,
          nombre_comercial,
          nombres_contacto,
          apellidos_contacto,
          direccion,
          departamento,
          ciudad,
          telefono,
          correo,
          adjuntos,
          medio_pago,
          sitioweb,
          estado,
          fecha_vencimiento
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`;

      const proveedorValues = [
        id,
        tipoIdentificacion,
        numeroIdentificacion,
        nombre,
        nombresContacto,
        apellidosContacto,
        direccion,
        departamento,
        ciudad,
        telefonoJSON, // Usamos el JSON convertido
        correoJSON,   // Usamos el JSON convertido
        adjuntosJSON, // Usamos el JSON convertido
        medioPago || 'Otro',
        sitioweb || null,
        estado || 'activo',
        fechaVencimiento || null
      ];

      // Ejecutar la consulta para insertar el proveedor
      const proveedorResult = await client.query(proveedorQuery, proveedorValues);

      // Insertar en la tabla terceros
      const terceroQuery = `
        INSERT INTO terceros (id, nombre, tipo)
        VALUES ($1, $2, $3)
        RETURNING *`;

      const terceroValues = [id, nombre, 'proveedor'];
      await client.query(terceroQuery, terceroValues);

      // Confirmar la transacción
      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Proveedor creado exitosamente',
        data: proveedorResult.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al crear el proveedor:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
};

// Obtener todos los proveedores
export const getAllProviders = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores');
    res.json(result.rows);  // Se devolverán los proveedores con todos los campos, incluyendo los nuevos
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
    tipoIdentificacion,
    numeroIdentificacion,
    nombre,
    nombresContacto,
    apellidosContacto,
    ciudad,
    direccion,
    departamento,
    telefono,
    correo,
    adjuntos,
    sitioweb,
    medioPago,
    estado,
    fechaVencimiento,

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
           departamento = $7,
           ciudad = $8,
           telefono = $9,
           correo = $10,
           adjuntos = $11,
           medio_pago = $12,
           sitioweb = $13,
           estado = $14,
           fecha_vencimiento = $15,
       WHERE id = $16 RETURNING *`,
      [
        tipoIdentificacion,
        numeroIdentificacion,
        nombre,
        nombresContacto,
        apellidosContacto,
        direccion,
        departamento,
        ciudad,
        telefono,
        correo,
        adjuntos,
        medioPago || 'Otro',
        sitioweb || null,
        estado || 'activo',
        fechaVencimiento || null,
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

