import pool from '../database.js';

const createCategorie = async (name, type) => {
  const result = await pool.query(
    'INSERT INTO categories (name, type) VALUES ($1, $2) RETURNING *',
    [name, type]
  );
  return result.rows[0];
};

const getCategories = async () => {
  const result = await pool.query('SELECT * FROM categories');
  return result.rows;
};

const getCategorieById = async (id) => {
  const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  return result.rows[0];
};

const updateCategorie = async (id, name, type) => {
  const result = await pool.query(
    'UPDATE categories SET name = $1, type = $2 WHERE id = $3 RETURNING *',
    [name, type, id]
  );
  return result.rows[0];
};

const deleteCategorie = async (id) => {
  const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

export { createCategorie, getCategories, getCategorieById, updateCategorie, deleteCategorie };
