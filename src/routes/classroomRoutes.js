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

router.use(authJWT, roleGuard(['Admin']));

router.get('/', getClassrooms);
router.post('/', classroomBody, validate, createClassroom);
router.put('/:id', classroomBody, validate, updateClassroom);
router.delete('/:id', deleteClassroom);

module.exports = router;