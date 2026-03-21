const Cuentadante = require('../models/Cuentadante.js');

const getAll = async (req, res, next) => {
    try {
        const soloInactivos = req.query.inactivos === 'true';
        const query = soloInactivos ? { activo: false } : { activo: true };
        const lista = await Cuentadante.find(query).sort({ nombre: 1 });
        res.json(lista);
    } catch (err) { next(err); }
};

const create = async (req, res, next) => {
    try {
        const { nombre, numero_identificacion } = req.body;
        const existente = await Cuentadante.findOne({ nombre: { $regex: `^${nombre.trim()}$`, $options: 'i' }, activo: true });
        if (existente) return res.status(409).json({ message: 'Ya existe un cuentadante activo con ese nombre' });
        const doc = await Cuentadante.create({ nombre: nombre.trim(), numero_identificacion: numero_identificacion.trim() });
        res.status(201).json(doc);
    } catch (err) { next(err); }
};

const update = async (req, res, next) => {
    try {
        const { nombre, numero_identificacion } = req.body;
        const doc = await Cuentadante.findByIdAndUpdate(
            req.params.id,
            { nombre: nombre.trim(), numero_identificacion: numero_identificacion.trim() },
            { new: true, runValidators: true }
        );
        if (!doc) return res.status(404).json({ message: 'Cuentadante no encontrado' });
        res.json(doc);
    } catch (err) { next(err); }
};

// Inhabilitar en vez de eliminar
const remove = async (req, res, next) => {
    try {
        const doc = await Cuentadante.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Cuentadante no encontrado' });
        if (!doc.activo) return res.status(409).json({ message: 'El cuentadante ya está inhabilitado' });

        // Verificar ítems activos que lo usan
        const Item = require('../models/Item.js');
        const enUso = await Item.countDocuments({ cuentadante: req.params.id, activo: true });
        if (enUso > 0) {
            return res.status(409).json({
                message: `No se puede inhabilitar: hay ${enUso} ítem(s) activo(s) con este cuentadante asignado.`
            });
        }
        doc.activo = false;
        await doc.save();
        res.json({ message: `Cuentadante "${doc.nombre}" inhabilitado`, doc });
    } catch (err) { next(err); }
};

const reactivar = async (req, res, next) => {
    try {
        const doc = await Cuentadante.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Cuentadante no encontrado' });
        if (doc.activo) return res.status(409).json({ message: 'El cuentadante ya está activo' });
        doc.activo = true;
        await doc.save();
        res.json({ message: `Cuentadante "${doc.nombre}" reactivado`, doc });
    } catch (err) { next(err); }
};

module.exports = { getAll, create, update, remove, reactivar };