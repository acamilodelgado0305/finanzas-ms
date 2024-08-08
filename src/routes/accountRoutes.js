import express from 'express';
import {
  createAccountController,
  getAccountsController,
  getAccountByIdController,
  updateAccountController,
  deleteAccountController
} from '../controllers/accountController.js';

const router = express.Router();

router.post('/accounts', createAccountController);
router.get('/accounts', getAccountsController);
router.get('/accounts/:id', getAccountByIdController);
router.put('/accounts/:id', updateAccountController);
router.delete('/accounts/:id', deleteAccountController);

export default router;
