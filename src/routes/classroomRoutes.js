const express = require('express');
const { getClassrooms, createClassroom, updateClassroom, deleteClassroom, reactivarClassroom } = require('../controllers/classroomController.js');
const authJWT   = require('../middlewares/authJWT.js');
const roleGuard = require('../middlewares/roleGuard.js');
const validate  = require('../middlewares/validate.js');
const { classroomBody } = require('../validators/classroomValidator.js');

const router = express.Router();

// Lectura activas: todos los autenticados
router.get('/', authJWT, getClassrooms);

// Solo SuperAdmin: CRUD + inactivas + reactivar
router.post('/',               authJWT, roleGuard(['SuperAdmin']), classroomBody, validate, createClassroom);
router.put('/:id',             authJWT, roleGuard(['SuperAdmin']), classroomBody, validate, updateClassroom);
router.delete('/:id',         authJWT, roleGuard(['SuperAdmin']), deleteClassroom);
router.patch('/:id/reactivar', authJWT, roleGuard(['SuperAdmin']), reactivarClassroom);

module.exports = router;