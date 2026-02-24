const express = require('express');
const {
    getClassrooms,
    createClassroom,
    updateClassroom,
    deleteClassroom
} = require('../controllers/classroomController.js');
const authJWT = require('../middlewares/authJWT.js');
const roleGuard = require('../middlewares/roleGuard.js');
const validate = require('../middlewares/validate.js');
const { classroomBody } = require('../validators/classroomValidator.js');

const router = express.Router();

router.get('/', authJWT, getClassrooms);
router.post('/', authJWT, roleGuard(['Admin']), classroomBody, validate, createClassroom);
router.put('/:id', authJWT, roleGuard(['Admin']), classroomBody, validate, updateClassroom);
router.delete('/:id', authJWT, roleGuard(['Admin']), deleteClassroom);

module.exports = router;