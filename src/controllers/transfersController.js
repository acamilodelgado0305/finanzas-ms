import pool from '../database.js';



const createTransferController = async (req, res) => {
  const { userId, fromAccount, toAccount, amount, vouchers, description } = req.body;
  const client = await pool.connect();

  try {
    // Validar datos de entrada
    if (!userId || !fromAccount || !toAccount || !amount || amount <= 0) {
      return res.status(400).json({
        error: "Datos inválidos",
        details: "Se requieren userId, fromAccount, toAccount y un amount positivo",
      });
    }

    // Convertir `vouchers` a un arreglo si es una cadena
    const formattedVouchers = typeof vouchers === "string"
      ? vouchers.split("\n").filter((url) => url.trim() !== "")
      : Array.isArray(vouchers)
        ? vouchers
        : [];

    // Iniciar una transacción
    await client.query('BEGIN');

    // Verificar que las cuentas existan y obtener sus saldos
    const accountQuery = 'SELECT id, balance FROM accounts WHERE id = $1';
    const fromAccountResult = await client.query(accountQuery, [fromAccount]);
    const toAccountResult = await client.query(accountQuery, [toAccount]);

    if (fromAccountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: "Cuenta no encontrada",
        details: `La cuenta de origen con ID ${fromAccount} no existe`,
      });
    }

    if (toAccountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: "Cuenta no encontrada",
        details: `La cuenta de destino con ID ${toAccount} no existe`,
      });
    }

    const fromAccountBalance = parseFloat(fromAccountResult.rows[0].balance);

    // Verificar que la cuenta de origen tenga saldo suficiente
    if (fromAccountBalance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: "Saldo insuficiente",
        details: `La cuenta de origen no tiene suficiente saldo para transferir ${amount}`,
      });
    }

    // Actualizar el saldo de la cuenta de origen (restar amount)
    const updateFromAccountQuery = `
      UPDATE accounts
      SET balance = balance - $1
      WHERE id = $2
      RETURNING balance;
    `;
    const fromAccountUpdateResult = await client.query(updateFromAccountQuery, [amount, fromAccount]);

    // Actualizar el saldo de la cuenta de destino (sumar amount)
    const updateToAccountQuery = `
      UPDATE accounts
      SET balance = balance + $1
      WHERE id = $2
      RETURNING balance;
    `;
    const toAccountUpdateResult = await client.query(updateToAccountQuery, [amount, toAccount]);

    // Insertar la transferencia
    const transferQuery = `
      INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, vouchers, description, date)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const transferValues = [userId, fromAccount, toAccount, amount, formattedVouchers, description];
    const transferResult = await client.query(transferQuery, transferValues);

    // Confirmar la transacción
    await client.query('COMMIT');

    // Responder con los detalles de la transferencia
    res.status(201).json({
      transfer: transferResult.rows[0],
      fromAccountNewBalance: parseFloat(fromAccountUpdateResult.rows[0].balance),
      toAccountNewBalance: parseFloat(toAccountUpdateResult.rows[0].balance),
    });
  } catch (err) {
    // Revertir la transacción en caso de error
    await client.query('ROLLBACK');
    console.error("Error creando transferencia", err);
    res.status(500).json({ error: "Error creando transferencia", details: err.message });
  } finally {
    // Liberar el cliente
    client.release();
  }
};

const getTransfersController = async (req, res) => {
  try {
    const query = 'SELECT * FROM transfers ORDER BY date DESC;';
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error obteniendo transferencias", err);
    res.status(500).json({ error: "Error obteniendo transferencias", details: err.message });
  }
};

const getTransferByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'SELECT * FROM transfers WHERE id = $1;';
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transferencia no encontrada" });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error obteniendo transferencia", err);
    res.status(500).json({ error: "Error obteniendo transferencia", details: err.message });
  }
};

const updateTransferController = async (req, res) => {
  const { id } = req.params;
  const { userId, fromAccount, toAccount, amount, date, vouchers, description } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Obtener la transferencia actual
    const currentTransferQuery = 'SELECT from_account_id, to_account_id, amount FROM transfers WHERE id = $1';
    const currentTransferResult = await client.query(currentTransferQuery, [id]);

    if (currentTransferResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Transferencia no encontrada" });
    }

    const currentTransfer = currentTransferResult.rows[0];
    const oldFromAccount = currentTransfer.from_account_id;
    const oldToAccount = currentTransfer.to_account_id;
    const oldAmount = parseFloat(currentTransfer.amount);

    // Revertir los saldos de la transferencia anterior
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [oldAmount, oldFromAccount]
    );
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [oldAmount, oldToAccount]
    );

    // Verificar que las nuevas cuentas existan y tengan saldo suficiente
    const fromAccountResult = await client.query('SELECT balance FROM accounts WHERE id = $1', [fromAccount]);
    if (fromAccountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: "Cuenta no encontrada",
        details: `La cuenta de origen con ID ${fromAccount} no existe`,
      });
    }

    const toAccountResult = await client.query('SELECT balance FROM accounts WHERE id = $1', [toAccount]);
    if (toAccountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: "Cuenta no encontrada",
        details: `La cuenta de destino con ID ${toAccount} no existe`,
      });
    }

    const fromAccountBalance = parseFloat(fromAccountResult.rows[0].balance);
    if (fromAccountBalance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: "Saldo insuficiente",
        details: `La cuenta de origen no tiene suficiente saldo para transferir ${amount}`,
      });
    }

    // Aplicar los nuevos saldos
    const updateFromAccountQuery = 'UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING balance';
    const updateToAccountQuery = 'UPDATE accounts SET balance = balance + $1 WHERE id = $2 RETURNING balance';
    const fromAccountUpdateResult = await client.query(updateFromAccountQuery, [amount, fromAccount]);
    const toAccountUpdateResult = await client.query(updateToAccountQuery, [amount, toAccount]);

    // Actualizar la transferencia
    const updateTransferQuery = `
      UPDATE transfers
      SET user_id = $1, from_account_id = $2, to_account_id = $3, amount = $4, date = $5, vouchers = $6, description = $7
      WHERE id = $8
      RETURNING *;
    `;
    const values = [userId, fromAccount, toAccount, amount, date || new Date(), vouchers, description, id];
    const transferResult = await client.query(updateTransferQuery, values);

    await client.query('COMMIT');

    res.status(200).json({
      transfer: transferResult.rows[0],
      fromAccountNewBalance: parseFloat(fromAccountUpdateResult.rows[0].balance),
      toAccountNewBalance: parseFloat(toAccountUpdateResult.rows[0].balance),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error actualizando transferencia", err);
    res.status(500).json({ error: "Error actualizando transferencia", details: err.message });
  } finally {
    client.release();
  }
};

const deleteTransferController = async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'DELETE FROM transfers WHERE id = $1 RETURNING *;';
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transferencia no encontrada" });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error eliminando transferencia", err);
    res.status(500).json({ error: "Error eliminando transferencia", details: err.message });
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