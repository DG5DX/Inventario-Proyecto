const express = require('express');
const {
    getItems,
    getItem,
    getItemStockInfo,
    adjustStock,
    createItem,
    updateItem,
    deleteItem,
    reactivarItem,
    bulkCreateItems,
} = require('../controllers/itemController.js');
const authJWT    = require('../middlewares/authJWT.js');
const roleGuard  = require('../middlewares/roleGuard.js');
const validate   = require('../middlewares/validate.js');
const { itemScope, injectScope } = require('../middlewares/scopeGuard.js');
const { itemBody, itemsQuery }   = require('../validators/itemValidator.js');

const router = express.Router();

// Lectura pública para usuarios autenticados (todos los roles)
// injectScope filtra automáticamente para Admins
router.get('/',    authJWT, injectScope, itemsQuery, validate, getItems);
router.get('/:id', authJWT, getItem);

// Stock info y ajuste: Admin restringido a su scope
router.get( '/:id/stock-info',   authJWT, roleGuard(['Admin']), itemScope, getItemStockInfo);
router.post('/:id/ajuste-stock', authJWT, roleGuard(['Admin']), itemScope, adjustStock);

// Importación masiva: Admin restringido a sus ambientes
router.post('/bulk', authJWT, roleGuard(['Admin']), injectScope, bulkCreateItems);

// CRUD: Admin restringido a sus ambientes via itemScope
router.post('/',    authJWT, roleGuard(['Admin']), itemBody, validate, itemScope, createItem);
router.put( '/:id', authJWT, roleGuard(['Admin']), itemBody, validate, itemScope, updateItem);
router.delete('/:id',         authJWT, roleGuard(['Admin']),      itemScope, deleteItem);
router.patch('/:id/reactivar', authJWT, roleGuard(['SuperAdmin']),           reactivarItem);

module.exports = router;