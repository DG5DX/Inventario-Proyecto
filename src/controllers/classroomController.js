const Classroom = require('../models/Classroom.js');
const Item      = require('../models/Item.js');

const getClassrooms = async (req, res, next) => {
    try {
        const soloInactivos = req.query.inactivos === 'true';
        const query = soloInactivos ? { activo: false } : { activo: true };
        if (req.query.zona) query.zona = req.query.zona;
        const aulas = await Classroom.find(query)
            .populate('zona', 'nombre descripcion')
            .sort({ nombre: 1 });
        res.json(aulas);
    } catch (error) { next(error); }
};

const createClassroom = async (req, res, next) => {
    try {
        const aula     = await Classroom.create(req.body);
        const populated = await aula.populate('zona', 'nombre descripcion');
        res.status(201).json(populated);
    } catch (error) { next(error); }
};

const updateClassroom = async (req, res, next) => {
    try {
        const aula = await Classroom.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
            .populate('zona', 'nombre descripcion');
        if (!aula) return res.status(404).json({ message: 'Aula no encontrada' });
        res.json(aula);
    } catch (error) { next(error); }
};

// Inhabilitar ambiente — solo si NO tiene ítems activos
const deleteClassroom = async (req, res, next) => {
    try {
        const aula = await Classroom.findById(req.params.id);
        if (!aula) return res.status(404).json({ message: 'Aula no encontrada' });
        if (!aula.activo) return res.status(409).json({ message: 'El ambiente ya está inhabilitado' });

        const itemsActivos = await Item.countDocuments({ aula: req.params.id, activo: true });
        if (itemsActivos > 0) {
            return res.status(409).json({
                message: `No se puede inhabilitar el ambiente "${aula.nombre}" porque tiene ${itemsActivos} ítem(s) activo(s). Inhabilita primero todos sus ítems.`,
                itemsActivos,
            });
        }

        aula.activo = false;
        await aula.save();
        res.json({ message: `Ambiente "${aula.nombre}" inhabilitado correctamente.`, aula });
    } catch (error) { next(error); }
};

const reactivarClassroom = async (req, res, next) => {
    try {
        // No populamos zona aquí — necesitamos el ObjectId puro para hacer findById
        const aula = await Classroom.findById(req.params.id);
        if (!aula) return res.status(404).json({ message: 'Aula no encontrada' });
        if (aula.activo) return res.status(409).json({ message: 'El ambiente ya está activo' });

        // aula.zona es un ObjectId puro (sin populate), findById lo recibe correctamente
        const Zone = require('../models/Zone.js');
        const zona = await Zone.findById(aula.zona);
        if (!zona || !zona.activo) {
            return res.status(409).json({
                message: `No se puede reactivar: la sede "${zona?.nombre || 'asociada'}" está inhabilitada. Reactiva la sede primero.`,
            });
        }

        aula.activo = true;
        await aula.save();
        // Populamos para devolver la respuesta completa
        await aula.populate('zona', 'nombre descripcion');
        res.json({ message: `Ambiente "${aula.nombre}" reactivado`, aula });
    } catch (error) { next(error); }
};

module.exports = { getClassrooms, createClassroom, updateClassroom, deleteClassroom, reactivarClassroom };