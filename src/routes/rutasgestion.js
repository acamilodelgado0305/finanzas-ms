import express from "express";
import {
    createDocumento, // Esta es la nueva ruta para crear un documento
    aceptarRechazarDocumento,
    obtenerDocumentosPorUsuario,
    eliminarDocumento,
    obtenerDocumentoPorId,
} from "../controllers/gestionarDocumentos.js";

const router = express.Router();

// 1. Crear un nuevo documento
router.post("/documentos", createDocumento);

// 2. Obtener todos los documentos de un usuario
router.get("/documentos/:userId", obtenerDocumentosPorUsuario);

// 3. Obtener un documento específico por ID
router.get("/documento/:id", obtenerDocumentoPorId);

// 4. Aceptar o rechazar un documento
router.put("/documento/:id", aceptarRechazarDocumento);

// 5. Eliminar un documento
router.delete("/documento/:id", eliminarDocumento);

export default router;
