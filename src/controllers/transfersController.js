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

export {
  createTransferController,
  getTransfersController,
  getTransferByIdController,
  updateTransferController,
  deleteTransferController,
};
