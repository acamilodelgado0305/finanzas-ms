import { v4 as uuidv4 } from 'uuid';
import pool from '../../database.js';
import { providerSchema } from '../../schemas/providerSchema.js';

export const createProvider = async (req, res) => {
  try {
    // Si el tipo de identificación es CC y nombreComercial está vacío, eliminamos nombreComercial
    if (req.body.tipoIdentificacion === 'CC' && !req.body.nombreComercial) {
      delete req.body.nombreComercial;
    }

    // Validar los datos con Joi
    const { error } = providerSchema.validate(req.body, { abortEarly: false });  // Agregando abortEarly: false para recoger todos los errores
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
      nombreComercial,
      nombresContacto,
      apellidosContacto,
      pais,
      prefijo,
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

    // Asegurarse de que 'telefono' y 'correo' sean arrays antes de hacer .map()
    const telefonoJSON = Array.isArray(telefono) ? JSON.stringify(telefono) : JSON.stringify([]);
    const correoJSON = Array.isArray(correo) ? JSON.stringify(correo) : JSON.stringify([]);
    const adjuntosJSON = adjuntos ? JSON.stringify(adjuntos) : JSON.stringify([]); // Adjuntos no es obligatorio

    // Si el tipo de identificación es NIT, el nombre no es obligatorio
    if (tipoIdentificacion === 'NIT' && !nombreComercial) {
      console.log("Advertencia: El campo 'nombreComercial' no es obligatorio para NIT.");
    }

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
          pais,
          prefijo,
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16 , $17, $18)
        RETURNING *`;

      const proveedorValues = [
        uuidv4(),
        tipoIdentificacion,
        numeroIdentificacion,
        nombreComercial || '',  // Aquí aseguramos que si no se proporciona, se deje vacío
        nombresContacto,
        apellidosContacto,
        pais,
        prefijo,
        direccion,
        departamento,
        ciudad,
        telefonoJSON,
        correoJSON,
        adjuntosJSON,
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

      const terceroValues = [uuidv4(), nombreComercial || 'No disponible', 'proveedor'];
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
    console.error('Error.. al crear el proveedor:', error);
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
    nombreComercial,
    nombresContacto,
    apellidosContacto,
    ciudad,
    direccion,
    pais,
    prefijo,
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
            pais = $16,
            prefijo = $17
        WHERE id = $18 RETURNING *`,
      [
        tipoIdentificacion,
        numeroIdentificacion,
        nombreComercial,
        nombresContacto,
        apellidosContacto,
        direccion,
        pais,
        prefijo,
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

