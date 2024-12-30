import pool from '../database.js';
import {
  createTransfer,
  getTransfers,
  getTransferById,
  updateTransfer,
  deleteTransfer,
} from "../models/transfersModel.js";

const createTransferController = async (req, res) => {
  const { userId, fromAccountId, toAccountId, amount, vouchers, description } = req.body;

  try {
    // Convertir `vouchers` a un arreglo si es una cadena
    const formattedVouchers = typeof vouchers === "string"
      ? vouchers.split("\n").filter((url) => url.trim() !== "")
      : Array.isArray(vouchers)
        ? vouchers
        : [];

    const transfer = await createTransfer(
      userId,
      fromAccountId,
      toAccountId,
      amount,
      formattedVouchers,
      description
    );

    res.status(201).json(transfer);
  } catch (err) {
    console.error("Error creando transferencia", err);
    res.status(500).json({ error: "Error creando transferencia" });
  }
};


const getTransfersController = async (req, res) => {
  try {
    const transfers = await getTransfers();
    res.status(200).json(transfers);
  } catch (err) {
    console.error("Error obteniendo transferencias", err);
    res.status(500).json({ error: "Error obteniendo transferencias" });
  }
};

const getTransferByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const transfer = await getTransferById(id);
    if (!transfer) {
      return res.status(404).json({ error: "Transferencia no encontrada" });
    }
    res.status(200).json(transfer);
  } catch (err) {
    console.error("Error obteniendo transferencia", err);
    res.status(500).json({ error: "Error obteniendo transferencia" });
  }
};

const updateTransferController = async (req, res) => {
  const { id } = req.params;
  const {
    userId,
    fromAccountId,
    toAccountId,
    amount,
    date,
    vouchers,
    description,
  } = req.body;
  try {
    const transfer = await updateTransfer(
      id,
      userId,
      fromAccountId,
      toAccountId,
      amount,
      date,
      vouchers,
      description
    );
    if (!transfer) {
      return res.status(404).json({ error: "Transferencia no encontrada" });
    }
    res.status(200).json(transfer);
  } catch (err) {
    console.error("Error actualizando transferencia", err);
    res.status(500).json({ error: "Error actualizando transferencia" });
  }
};

const deleteTransferController = async (req, res) => {
  const { id } = req.params;
  try {
    const transfer = await deleteTransfer(id);
    if (!transfer) {
      return res.status(404).json({ error: "Transferencia no encontrada" });
    }
    res.status(200).json(transfer);
  } catch (err) {
    console.error("Error eliminando transferencia", err);
    res.status(500).json({ error: "Error eliminando transferencia" });
  }
};
const TransferManageVouchers = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id, action, vouchers } = req.body;

    // Validar que el id de la transferencia exista
    if (!id) {
      return res.status(400).json({
        error: 'Campo requerido faltante',
        details: 'El campo id es obligatorio'
      });
    }

    // Obtener el registro actual
    const getCurrentVouchersQuery = 'SELECT vouchers FROM transfers WHERE id = $1';
    const currentResult = await client.query(getCurrentVouchersQuery, [id]);

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Transferencia no encontrada',
        details: 'La transferencia especificada no existe'
      });
    }

    let currentVouchers = currentResult.rows[0].vouchers || [];
    let updatedVouchers = [...currentVouchers];

    switch (action) {
      case 'add':
        if (!vouchers || !Array.isArray(vouchers)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Datos inválidos',
            details: 'Se deben proporcionar vouchers para agregar'
          });
        }
        updatedVouchers = [...currentVouchers, ...vouchers];
        break;

      case 'remove':
        if (!vouchers || !Array.isArray(vouchers)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Datos inválidos',
            details: 'Se deben proporcionar vouchers para eliminar'
          });
        }
        updatedVouchers = currentVouchers.filter(v => !vouchers.includes(v));
        break;

      case 'update':
        if (!vouchers || !Array.isArray(vouchers)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Datos inválidos',
            details: 'Se debe proporcionar el nuevo array de vouchers'
          });
        }
        updatedVouchers = vouchers;
        break;

      default:
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Acción inválida',
          details: 'La acción debe ser "add", "remove" o "update"'
        });
    }

    // Convertir el array a formato PostgreSQL
    const processedVouchers = '{' + updatedVouchers
      .filter(v => v.trim())
      .map(v => `"${v.replace(/"/g, '\\"')}"`)
      .join(',') + '}';

    // Actualizar los vouchers en la base de datos
    const updateQuery = 'UPDATE transfers SET vouchers = $1::text[] WHERE id = $2 RETURNING *';
    const result = await client.query(updateQuery, [processedVouchers, id]);

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Vouchers actualizados exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en TransferManageVouchers:', error);

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
};

const getTransferVouchers = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar que se proporcionó un ID
    if (!id) {
      return res.status(400).json({
        error: 'ID no proporcionado',
        details: 'Se requiere un ID válido para obtener los comprobantes'
      });
    }

    // Consultar solo la columna vouchers de la transferencia específica
    const query = 'SELECT vouchers FROM transfers WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Transferencia no encontrada',
        details: `No se encontró una transferencia con el ID: ${id}`
      });
    }

    // Devolver el array de vouchers
    res.status(200).json({
      id,
      vouchers: result.rows[0].vouchers || []
    });

  } catch (error) {
    console.error('Error en getTransferVouchers:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

export {
  createTransferController,
  getTransfersController,
  getTransferByIdController,
  updateTransferController,
  deleteTransferController,
  TransferManageVouchers,
  getTransferVouchers,
};
