const express = require('express');
const {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} = require('../controllers/categoryController.js');
const authJWT = require('../middlewares/authJWT.js');
const roleGuard = require('../middlewares/roleGuard.js');
const validate = require('../middlewares/validate.js')
const { categoryBody } = require('../validators/categoryValidator.js');

const router = express.Router();

router.use(authJWT, roleGuard(['Admin']));

router.get('/', getCategories);
router.post('/', categoryBody, validate, createCategory);
router.put('/:id', categoryBody, validate, updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;