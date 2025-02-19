import express from 'express';
import {
    createAccountingAccount,
    getAllAccountingAccounts,
    getAccountingAccountById,
    updateAccountingAccount,
    deleteAccountingAccount
} from '../controllers/accounting_accountsController.js';

const router = express.Router();

// Rutas para las cuentas contables
router.post('/accountingAccounts', createAccountingAccount);
router.get('/accountingAccounts', getAllAccountingAccounts);
router.get('/accountingAccounts/:id', getAccountingAccountById);
router.put('/accountingAccounts/:id', updateAccountingAccount);
router.delete('/accountingAccounts/:id', deleteAccountingAccount);

export default router;
