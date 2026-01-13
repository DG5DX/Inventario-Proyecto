const Classroom = require('../models/Classroom.js');

const getClassrooms = async (req, res, next) => {
    try {
        const aulas = await Classroom.find().sort({ nombre: 1 });
        res.json(aulas);
    } catch (error) {
        next(error);
    }
};

const createClassroom = async (req, res, next) => {
    try {
        const aula = await Classroom.create(req.body);
        res.status(201).json(aula);
    } catch (error) {
        next(error);
    }
};

const updateClassroom = async (req, res, next) => {
    try {
        const aula = await Classroom.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!aula) {
            return res.status(404).json({ message: 'Aula no encontrada' });
        }
        res.json(aula);
    } catch (error) {
        next(error);
    }
};

const deleteClassroom = async (req, res, next) => {
    try {
        const aula = await Classroom.findByIdAndDelete(req.params.id);
        if (!aula) {
            return res.status(404).json({ message: 'Aula no encontrada' });
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getClassrooms,
    createClassroom,
    updateClassroom,
    deleteClassroom
};