import pool from '../database.js'; // Importa la conexión de la base de datos
import { v4 as uuidv4 } from 'uuid';

export const createAccountingAccount = async (req, res) => {
    const { code, name } = req.body;

    // Validación básica
    if (!code || !name) {
        return res.status(400).json({ error: 'Código y nombre son requeridos' });
    }

    const id = uuidv4(); // Generamos un UUID para la cuenta contable

    try {
        // Insertar en la base de datos con el ID generado
        const result = await pool.query(
            'INSERT INTO accounting_accounts (id, code, name) VALUES ($1, $2, $3) RETURNING *',
            [id, code, name]
        );

        res.status(201).json({
            message: 'Cuenta contable creada exitosamente',
            data: result.rows[0],  // Debería ahora incluir el id generado
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear la cuenta contable', details: error.message });
    }
};

export const getAllAccountingAccounts = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM accounting_accounts');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las cuentas contables' });
    }
};


export const getAccountingAccountById = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM accounting_accounts WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cuenta contable no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la cuenta contable', details: error.message });
    }
};


export const updateAccountingAccount = async (req, res) => {
    const { id } = req.params;
    const { code, name } = req.body;

    try {
        const result = await pool.query(
            'UPDATE accounting_accounts SET code = $1, name = $2 WHERE id = $3 RETURNING *',
            [code, name, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cuenta contable no encontrada' });
        }

        res.json({
            message: 'Cuenta contable actualizada exitosamente',
            data: result.rows[0],
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la cuenta contable', details: error.message });
    }
};


export const deleteAccountingAccount = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM accounting_accounts WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cuenta contable no encontrada' });
        }

        res.json({ message: 'Cuenta contable eliminada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la cuenta contable', details: error.message });
    }
};
