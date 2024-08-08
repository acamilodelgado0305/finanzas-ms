import {
  createCategorie,
  getCategories,
  getCategorieById,
  updateCategorie,
  deleteCategorie,
} from '../models/categorieModel.js';

const createCategorieController = async (req, res) => {
  const { name, type } = req.body;
  try {
    const categorie = await createCategorie(name, type);
    res.status(201).json(categorie);
  } catch (err) {
    console.error('Error creando categoria', err);
    res.status(500).json({ error: 'Error creando categoria' });
  }
};

const getCategoriesController = async (req, res) => {
  try {
    const categories = await getCategories();
    res.status(200).json(categories);
  } catch (err) {
    console.error('Error obteniendo categorias', err);
    res.status(500).json({ error: 'Error obteniendo categorias' });
  }
};

const getCategorieByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const categorie = await getCategorieById(id);
    if (!categorie) {
      return res.status(404).json({ error: 'Categoria no encontrada' });
    }
    res.status(200).json(categorie);
  } catch (err) {
    console.error('Error obteniendo categoria', err);
    res.status(500).json({ error: 'Error obteniendo categoria' });
  }
};

const updateCategorieController = async (req, res) => {
  const { id } = req.params;
  const { name, type } = req.body;
  try {
    const categorie = await updateCategorie(id, name, type);
    if (!categorie) {
      return res.status(404).json({ error: 'Categoria no encontrada' });
    }
    res.status(200).json(categorie);
  } catch (err) {
    console.error('Error actualizando categoria', err);
    res.status(500).json({ error: 'Error actualizando categoria' });
  }
};

const deleteCategorieController = async (req, res) => {
  const { id } = req.params;
  try {
    const categorie = await deleteCategorie(id);
    if (!categorie) {
      return res.status(404).json({ error: 'Categoria no encontrada' });
    }
    res.status(200).json(categorie);
  } catch (err) {
    console.error('Error eliminando categoria', err);
    res.status(500).json({ error: 'Error eliminando categoria' });
  }
};

export {
  createCategorieController,
  getCategoriesController,
  getCategorieByIdController,
  updateCategorieController,
  deleteCategorieController,
};
