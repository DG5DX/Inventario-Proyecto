const express = require('express');
const {
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem
} = require('../controllers/itemController.js');
const authJWT = require('../middlewares/authJWT.js');
const roleGuard = require('../middlewares/roleGuard.js');
const validate = require('../middlewares/validate.js');
const { itemBody, itemsQuery } = require('../validators/itemValidator.js');

const router = express.Router();

router.get('/', authJWT, itemsQuery, validate, getItems);
router.get('/:id', authJWT, getItem);
router.post('/', authJWT, roleGuard(['Admin']), itemBody, validate, createItem);
router.put('/:id', authJWT, roleGuard(['Admin']), itemBody, validate, updateItem);
router.delete('/:id', authJWT, roleGuard(['Admin']), deleteItem);

module.exports = router;