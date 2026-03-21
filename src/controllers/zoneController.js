const Zone      = require('../models/Zone.js');
const Classroom = require('../models/Classroom.js');

const getZones = async (req, res, next) => {
    try {
        const soloInactivos = req.query.inactivos === 'true';
        const query = soloInactivos ? { activo: false } : { activo: true };
        const zonas = await Zone.find(query).sort({ nombre: 1 });
        res.json(zonas);
    } catch (error) { next(error); }
};

const createZone = async (req, res, next) => {
    try {
        const zona = await Zone.create(req.body);
        res.status(201).json(zona);
    } catch (error) { next(error); }
};

const updateZone = async (req, res, next) => {
    try {
        const zona = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!zona) return res.status(404).json({ message: 'Zona no encontrada' });
        res.json(zona);
    } catch (error) { next(error); }
};

// Inhabilitar sede — solo si NO tiene ambientes activos
const deleteZone = async (req, res, next) => {
    try {
        const zona = await Zone.findById(req.params.id);
        if (!zona) return res.status(404).json({ message: 'Zona no encontrada' });
        if (!zona.activo) return res.status(409).json({ message: 'La sede ya está inhabilitada' });

        const ambientesActivos = await Classroom.countDocuments({ zona: zona._id, activo: true });
        if (ambientesActivos > 0) {
            return res.status(409).json({
                message: `No se puede inhabilitar la sede "${zona.nombre}" porque tiene ${ambientesActivos} ambiente(s) activo(s). Inhabilita primero todos sus ambientes.`,
                ambientesActivos,
            });
        }

        zona.activo = false;
        await zona.save();
        res.json({ message: `Sede "${zona.nombre}" inhabilitada correctamente.`, zona });
    } catch (error) { next(error); }
};

const reactivarZone = async (req, res, next) => {
    try {
        const zona = await Zone.findById(req.params.id);
        if (!zona) return res.status(404).json({ message: 'Zona no encontrada' });
        if (zona.activo) return res.status(409).json({ message: 'La sede ya está activa' });
        zona.activo = true;
        await zona.save();
        res.json({ message: `Sede "${zona.nombre}" reactivada`, zona });
    } catch (error) { next(error); }
};

module.exports = { getZones, createZone, updateZone, deleteZone, reactivarZone };