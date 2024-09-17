import {
    createAccount,
    getAccounts,
    getAccountById,
    updateAccount,
    deleteAccount,
    getTotalBalance
  } from '../models/accountModel.js';
  
  const createAccountController = async (req, res) => {
    const { name, balance, type,plus } = req.body;
    try {
      const account = await createAccount(name, balance, type,plus);
      res.status(201).json(account);
    } catch (err) {
      console.error('Error creando cuenta', err);
      res.status(500).json({ error: 'Error creando cuenta' });
    }
  };
  
  const getAccountsController = async (req, res) => {
    try {
      const accounts = await getAccounts();
      res.status(200).json(accounts);
    } catch (err) {
      console.error('Error obteniendo cuentas', err);
      res.status(500).json({ error: 'Error obteniendo cuentas' });
    }
  };
  
  const getAccountByIdController = async (req, res) => {
    const { id } = req.params;
    try {
      const account = await getAccountById(id);
      if (!account) {
        return res.status(404).json({ error: 'Cuenta no encontrada' });
      }
      res.status(200).json(account);
    } catch (err) {
      console.error('Error obteniendo cuenta', err);
      res.status(500).json({ error: 'Error obteniendo cuenta' });
    }
  };
  
  const updateAccountController = async (req, res) => {
    const { id } = req.params;
    const { name, balance,type,plus } = req.body;
    try {
      const account = await updateAccount(id, name, balance,type, plus);
      if (!account) {
        return res.status(404).json({ error: 'Cuenta no encontrada' });
      }
      res.status(200).json(account);
    } catch (err) {
      console.error('Error actualizando cuenta', err);
      res.status(500).json({ error: 'Error actualizando cuenta' });
    }
  };
  
  const deleteAccountController = async (req, res) => {
    const { id } = req.params;
    try {
      const account = await deleteAccount(id);
      if (!account) {
        return res.status(404).json({ error: 'Cuenta no encontrada' });
      }
      res.status(200).json(account);
    } catch (err) {
      console.error('Error eliminando cuenta', err);
      res.status(500).json({ error: 'Error eliminando cuenta' });
    }
  };

  const getTotalBalanceController = async (req, res) => {
    try {
      const totalBalance = await getTotalBalance();
      res.status(200).json({ totalBalance });
    } catch (err) {
      console.error('Error obteniendo el total de balances', err);
      res.status(500).json({ error: 'Error obteniendo el total de balances' });
    }
  };
  
  export {
    createAccountController,
    getAccountsController,
    getAccountByIdController,
    updateAccountController,
    deleteAccountController,
    getTotalBalanceController
  };
  