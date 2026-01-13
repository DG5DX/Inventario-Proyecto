const Item = require('../models/Item.js');

const buildQuery = ({ categoria, aula, q }) => {
    const query = {};
    if (categoria) query.categoria = categoria;
    if (aula) query.aula = aula;
    if (q) {
        query.nombre = { $regex: q, $options: 'i' };
    }
    return query;
};

const getItems = async (req, res, next) => {
    try {
        const query = buildQuery(req.query);
        const items = await Item.find(query)
        .populate('categoria aula')
        .sort({ nombre: 1 });
        res.json(items);
    } catch (error) {
        next(error);
    }
};

const getItem = async (req, res, next) => {
    try {
        const item = await Item.findById(req.params.id).populate('categoria aula');
        if (!item) {
            return res.status(404).json({ message: 'Ítem no encontrado '});
        }
        res.json(item);
    } catch (error) {
        next(error);
    }
};

const createItem = async (req, res, next) => {
    try {
        const item = await Item.create(req.body);
        res.status(201).json(item);
    } catch (error){
        next(error);
    }
};

const updateItem = async (req, res, next) => {
    try {
        const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!item) {
            return res.status(404).json({ message: 'Ítem no encontrado' });
        }
        res.json(item);
    } catch (error) {
        next(error);
    }
};

const deleteItem = async (req, res, next) => {
    try {
        const item = await Item.findByIdAndDelete(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Ítem no encontrado' });
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
};