const express = require('express');
const {
    getZones,
    createZone,
    updateZone,
    deleteZone
} = require('../controllers/zoneController.js');
const authJWT = require('../middlewares/authJWT.js');
const roleGuard = require('../middlewares/roleGuard.js');
const validate = require('../middlewares/validate.js')
const { zoneBody } = require('../validators/zoneValidator.js');

const router = express.Router();

router.get('/', authJWT, getZones);
router.post('/', authJWT, roleGuard(['Admin']), zoneBody, validate, createZone);
router.put('/:id', authJWT, roleGuard(['Admin']), zoneBody, validate, updateZone);
router.delete('/:id', authJWT, roleGuard(['Admin']), deleteZone);

module.exports = router;