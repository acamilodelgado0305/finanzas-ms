import { createPagoPending, getAllPagosPending, getPagoPendingById, updatePagoPending, deletePagoPending } from "../models/pagospendingModel.js";

// Crear un nuevo pago pendiente
export const createPago = async (req, res) => {
  try {
    const { descripcion, amount, date, favorite } = req.body;
    const newPago = await createPagoPending(descripcion, amount, date, favorite);
    res.status(201).json(newPago);
  } catch (error) {
    res.status(500).json({ message: "Error al crear el pago pendiente", error });
  }
};

// Obtener todos los pagos pendientes
export const getPagos = async (req, res) => {
  try {
    const pagos = await getAllPagosPending();
    res.status(200).json(pagos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los pagos pendientes", error });
  }
};

// Obtener un pago pendiente por ID
export const getPagoById = async (req, res) => {
  try {
    const { id } = req.params;
    const pago = await getPagoPendingById(id);
    if (!pago) {
      return res.status(404).json({ message: "Pago pendiente no encontrado" });
    }
    res.status(200).json(pago);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el pago pendiente", error });
  }
};

// Actualizar un pago pendiente
export const updatePago = async (req, res) => {
  try {
    const { id } = req.params;
    const { descripcion, amount, date, favorite } = req.body;
    const updatedPago = await updatePagoPending(id, descripcion, amount, date, favorite);
    if (!updatedPago) {
      return res.status(404).json({ message: "Pago pendiente no encontrado para actualizar" });
    }
    res.status(200).json(updatedPago);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el pago pendiente", error });
  }
};

// Eliminar un pago pendiente
export const deletePago = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPago = await deletePagoPending(id);
    if (!deletedPago) {
      return res.status(404).json({ message: "Pago pendiente no encontrado para eliminar" });
    }
    res.status(200).json({ message: "Pago pendiente eliminado", deletedPago });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el pago pendiente", error });
  }
};
