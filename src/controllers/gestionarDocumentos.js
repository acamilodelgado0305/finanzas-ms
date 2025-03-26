import pool from "../database.js";
import { v4 as uuidv4 } from "uuid";

// 1. Crear un nuevo documento
export const createDocumento = async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const {
            tipo_documento,
            user_id_enviado,
            user_id_recibido,
            estado,
            comentario,
            id_documento_externo // El ID del documento externo (factura, transferencia, etc.)
        } = req.body;

        // Validación básica
        if (!tipo_documento || !user_id_enviado || !user_id_recibido || !estado || !id_documento_externo) {
            return res.status(400).json({
                error: "Campos requeridos faltantes",
                details: "Los campos tipo_documento, user_id_enviado, user_id_recibido, estado, y id_documento_externo son obligatorios",
            });
        }

        // Generar el ID del documento
        const idDocumento = uuidv4();

        // Insertar el documento en la base de datos
        const queryDocumento = `
          INSERT INTO documentos (
            id, tipo_documento, user_id_enviado, user_id_recibido, estado, comentario, fecha_creacion, id_documento_externo
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *;
        `;
        const valuesDocumento = [
            idDocumento,
            tipo_documento,
            user_id_enviado,
            user_id_recibido,
            estado,
            comentario || null,
            new Date(),
            id_documento_externo, // ID del documento externo
        ];

        const resultDocumento = await client.query(queryDocumento, valuesDocumento);

        await client.query("COMMIT");

        res.status(201).json({
            message: "Documento creado exitosamente",
            data: resultDocumento.rows[0],
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error en createDocumento:", error);
        res.status(500).json({
            error: "Error interno del servidor",
            details: error.message,
        });
    } finally {
        client.release();
    }
};

// 2. Aceptar o rechazar un documento
export const aceptarRechazarDocumento = async (req, res) => {
    const { id } = req.params; // Obtener el ID del documento desde los parámetros de la URL
    const { estado, comentario } = req.body; // Nuevo estado y comentario

    try {
        // Actualizamos el estado del documento
        const query = `
        UPDATE documentos
        SET estado = $1, comentario = $2
        WHERE id = $3
        RETURNING *;
      `;
        const values = [estado, comentario || null, id];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Documento no encontrado",
                details: `No se encontró un documento con el ID: ${id}`,
            });
        }

        res.status(200).json({
            message: "Estado del documento actualizado exitosamente",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Error al actualizar el estado del documento:", error);
        res.status(500).json({
            error: "Error interno del servidor",
            details: error.message,
        });
    }
};

// 3. Eliminar un documento
export const eliminarDocumento = async (req, res) => {
    const { id } = req.params; // Obtener el ID del documento desde los parámetros de la URL

    try {
        // Eliminamos el documento de la base de datos
        const query = "DELETE FROM documentos WHERE id = $1 RETURNING *";
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Documento no encontrado",
                details: `No se encontró un documento con el ID: ${id}`,
            });
        }

        res.status(200).json({
            message: "Documento eliminado exitosamente",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Error al eliminar el documento:", error);
        res.status(500).json({
            error: "Error interno del servidor",
            details: error.message,
        });
    }
};

// 4. Obtener todos los documentos de un usuario
export const obtenerDocumentosPorUsuario = async (req, res) => {
    const { userId } = req.params; // Obtener el ID del usuario desde los parámetros de la URL

    try {
        const query = `
          SELECT id, tipo_documento, user_id_enviado, user_id_recibido, estado, comentario, fecha_creacion, id_documento_externo
          FROM documentos
          WHERE user_id_recibido = $1
          ORDER BY fecha_creacion DESC;
        `;
        const result = await pool.query(query, [userId]);

        res.status(200).json({
            message: "Documentos obtenidos exitosamente",
            data: result.rows,
        });
    } catch (error) {
        console.error("Error al obtener documentos del usuario:", error);
        res.status(500).json({
            error: "Error interno del servidor",
            details: error.message,
        });
    }
};

// 5. Obtener un documento específico por ID
export const obtenerDocumentoPorId = async (req, res) => {
    const { id } = req.params; // Obtener el ID del documento desde los parámetros de la URL

    try {
        const query = "SELECT * FROM documentos WHERE id = $1";
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Documento no encontrado",
                details: `No se encontró un documento con el ID: ${id}`,
            });
        }

        res.status(200).json({
            message: "Documento obtenido exitosamente",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Error al obtener el documento:", error);
        res.status(500).json({
            error: "Error interno del servidor",
            details: error.message,
        });
    }
};
