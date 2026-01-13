const Category = require('../models/Category.js');

const getCategories = async (req, res, next) => {
    try {
    const categorias = await Category.find().sort({ nombre: 1 });
    res.json(categorias);
    } catch (error) {
        next(error);
    }
};

const createCategory = async (req, res, next) => {
    try {
        const categoria = await Category.create(req.body);
        res.status(201).json(categoria);
    } catch (error) {
        next(error);
    }
};

const updateCategory = async (req, res, next) => {
    try {
        const categoria = await Category.findByIdAndUpdate(req.params.id, req.body, {new: true, runValidators: true});
        if (!categoria) {
            return res.status(404).json({message: 'categoría no encontrada'});
        }
        res.json(categoria);
    } catch (error) {
        next(error);
    }
};

const deleteCategory = async (req, res, next) => {
    try {
        const categoria = await Category.findByIdAndDelete(req.params.id);
        if (!categoria) {
            return res.status(404).json({ message: 'Categoría no encontrada'});
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
};