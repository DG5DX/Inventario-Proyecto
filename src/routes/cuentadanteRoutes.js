const express = require('express');
const { getAll, create, update, remove, reactivar } = require('../controllers/cuentadanteController.js');
const authJWT   = require('../middlewares/authJWT.js');
const roleGuard = require('../middlewares/roleGuard.js');
const { body }  = require('express-validator');
const validate  = require('../middlewares/validate.js');

const router = express.Router();

const bodyValidator = [
    body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio').isLength({ max: 150 })
];

router.use(authJWT);

router.get('/', getAll);
router.post('/',               roleGuard(['Admin']),      bodyValidator, validate, create);
router.put('/:id',             roleGuard(['Admin']),      bodyValidator, validate, update);
router.delete('/:id',         roleGuard(['SuperAdmin']), remove);
router.patch('/:id/reactivar', roleGuard(['SuperAdmin']), reactivar);

module.exports = router;