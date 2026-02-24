const express = require('express');
const authRoutes = require('./authRoutes.js');
const zoneRoutes = require('./zoneRoutes.js');
const classroomRoutes = require('./classroomRoutes.js');
const itemRoutes = require('./itemRoutes.js');
const loanRoutes = require('./loanRoutes.js');
const userRoutes = require('./userRoutes.js')

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/zonas', zoneRoutes);
router.use('/aulas', classroomRoutes);
router.use('/items', itemRoutes);
router.use('/prestamos', loanRoutes);
router.use('/users', userRoutes);

module.exports = router;