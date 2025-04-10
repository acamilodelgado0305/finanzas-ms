import Joi from 'joi';

const providerSchema = Joi.object({
    tipoIdentificacion: Joi.string().required(),
    numeroIdentificacion: Joi.string().required(),

    // Hacer 'nombre' opcional, sin importar si el tipoIdentificacion es 'NIT' o 'CC'
    nombre: Joi.string().optional(),  // Hacer 'nombre' opcional para ambos casos

    nombreComercial: Joi.when('tipoIdentificacion', {
        is: 'NIT',
        then: Joi.string().required(), // Si es NIT, 'nombreComercial' es obligatorio
        otherwise: Joi.string().optional(), // Si no es NIT, 'nombreComercial' es opcional
    }),

    nombresContacto: Joi.string().allow('').required(),
    apellidosContacto: Joi.string().allow('').required(),
    ciudad: Joi.string().required(),
    direccion: Joi.string().required(),

    // Departamento no obligatorio y puede ser cualquier valor
    departamento: Joi.string().optional(),

    // Descripción adicional (opcional)
    descripcion: Joi.string().optional(),

    // Teléfonos: Permitir múltiples teléfonos con tipos
    telefono: Joi.array().items(
        Joi.object({
            numero: Joi.string().required(),
            tipo: Joi.string().valid('Personal', 'Oficina', 'Soporte', 'Facturación').required(),
        })
    ).required(),

    // Correos: Permitir múltiples correos con tipos
    correo: Joi.array().items(
        Joi.object({
            email: Joi.string().email().required(),
            tipo: Joi.string().valid('Facturación', 'Soporte', 'Contacto General').required(),
        })
    ).required(),

    // Archivos adjuntos: Permitir múltiples documentos relevantes
    adjuntos: Joi.array().items(
        Joi.object({
            tipo: Joi.string().valid('Cámara de Comercio', 'RUT', 'Otros').required(),
            archivo: Joi.string().required(), // Archivo puede ser una URL o el nombre del archivo
        })
    ).required(),

    // Sitio Web: URL válida (opcional)
    sitioweb: Joi.string().uri().optional(),

    // Método de pago: Banco, Nequi, Cajero, Otro (opcional)
    medioPago: Joi.string().valid('Banco', 'Nequi', 'Cajero', 'Otro').optional(),

    // Estado del proveedor: Activo o Inactivo
    estado: Joi.string().valid('activo', 'inactivo').default('activo'),

    // Fecha de vencimiento: Para la gestión y actualización de la información
    fechaVencimiento: Joi.date().optional(),
});

export { providerSchema };
