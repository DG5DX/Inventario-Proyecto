const Zone = require('../models/Zone.js');

const getZones = async (req, res, next) => {
    try {
    const zonas = await Zone.find().sort({ nombre: 1 });
    res.json(zonas);
    } catch (error) {
        next(error);
    }
};

const createZone = async (req, res, next) => {
    try {
        const zona = await Zone.create(req.body);
        res.status(201).json(zona);
    } catch (error) {
        next(error);
    }
};

const updateZone = async (req, res, next) => {
    try {
        const zona = await Zone.findByIdAndUpdate(req.params.id, req.body, {new: true, runValidators: true});
        if (!zona) {
            return res.status(404).json({message: 'Zona no encontrada'});
        }
        res.json(zona);
    } catch (error) {
        next(error);
    }
};

const deleteZone = async (req, res, next) => {
    try {
        const zona = await Zone.findByIdAndDelete(req.params.id);
        if (!zona) {
            return res.status(404).json({ message: 'Zona no encontrada'});
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getZones,
    createZone,
    updateZone,
    deleteZone
};