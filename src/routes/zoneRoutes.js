const express = require('express');
const { getZones, createZone, updateZone, deleteZone, reactivarZone } = require('../controllers/zoneController.js');
const authJWT   = require('../middlewares/authJWT.js');
const roleGuard = require('../middlewares/roleGuard.js');
const validate  = require('../middlewares/validate.js');
const { zoneBody } = require('../validators/zoneValidator.js');

const router = express.Router();

// Lectura activas: todos los autenticados
router.get('/', authJWT, getZones);

// Solo SuperAdmin: CRUD + inactivas + reactivar
router.post('/',               authJWT, roleGuard(['SuperAdmin']), zoneBody, validate, createZone);
router.put('/:id',             authJWT, roleGuard(['SuperAdmin']), zoneBody, validate, updateZone);
router.delete('/:id',         authJWT, roleGuard(['SuperAdmin']), deleteZone);
router.patch('/:id/reactivar', authJWT, roleGuard(['SuperAdmin']), reactivarZone);

module.exports = router;