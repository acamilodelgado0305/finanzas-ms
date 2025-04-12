import Joi from 'joi';

const providerSchema = Joi.object({
    tipoIdentificacion: Joi.string().required(),
    numeroIdentificacion: Joi.string().required(),
    nombre: Joi.string().optional(),  // Hacer 'nombre' opcional para ambos casos
    nombreComercial: Joi.string().optional(),  // Cambiado a opcional en todos los casos
    nombresContacto: Joi.string().allow('').required(),
    apellidosContacto: Joi.string().allow('').required(),
    direccion: Joi.string().required(),
    ciudad: Joi.string().required(),
    departamento: Joi.string().optional(),  // Departamento no obligatorio
    pais: Joi.string().required(),
    prefijo: Joi.string().optional(),  // Descripción adicional (opcional)
    telefono: Joi.array().items(
        Joi.object({
            numero: Joi.string().required(),
            tipo: Joi.string().valid('Personal', 'Oficina', 'Soporte', 'Facturación').required(),
        })
    ).required(),
    correo: Joi.array().items(
        Joi.object({
            email: Joi.string().email().required(),
            tipo: Joi.string().valid('Facturación', 'Soporte', 'Contacto General').required(),
        })
    ).required(),
    adjuntos: Joi.array().items(
        Joi.object({
            tipo: Joi.string().valid('Cámara de Comercio', 'RUT', 'Otros').required(),
            archivo: Joi.string().required(),
        })
    ).optional(),  // Adjuntos no obligatorio
    sitioweb: Joi.string().uri().optional(),  // Sitio web opcional
    medioPago: Joi.string().optional(),  // Medio de pago opcional
    estado: Joi.string().valid('activo', 'inactivo').default('activo'),  // Estado obligatorio
    fechaVencimiento: Joi.date().optional(),  // Fecha de vencimiento opcional
});

export { providerSchema };
