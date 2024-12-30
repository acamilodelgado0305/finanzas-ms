import express from 'express';
import {
  createTransferController,
  getTransfersController,
  getTransferByIdController,
  updateTransferController,
  deleteTransferController,
  getTransferVouchers,
  TransferManageVouchers,
} from '../controllers/transfersController.js';

const router = express.Router();

router.post('/transfers', createTransferController);
router.get('/transfers', getTransfersController);
router.get('/transfers/:id', getTransferByIdController);
router.put('/transfers/:id', updateTransferController);
router.delete('/transfers/:id', deleteTransferController);

// Rutas para gestionar vouchers
router.get('/transfers/:id/vouchers', getTransferVouchers);
router.patch('/transfers/:id/vouchers', TransferManageVouchers);



export default router;
