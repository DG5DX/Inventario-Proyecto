const express = require('express');
const {
  getLoans,
  createLoan,
  approveLoan,
  rejectLoan,
  returnLoan,
  delayLoan,
  getLoan,
  deleteLoan 
} = require('../controllers/loanController.js');
const authJWT = require('../middlewares/authJWT.js');
const roleGuard = require('../middlewares/roleGuard.js');
const validate = require('../middlewares/validate.js');
const {
  createLoanValidator,
  approveLoanValidator,
  delayLoanValidator
} = require('../validators/loanValidator.js');

const router = express.Router();

router.use(authJWT);

router.get('/', getLoans);
router.get('/:id', getLoan);
router.post('/', roleGuard(['Comun']), createLoanValidator, validate, createLoan);
router.post('/:id/aprobar', roleGuard(['Admin']), approveLoanValidator, validate, approveLoan);
router.post('/:id/rechazar', roleGuard(['Admin']), rejectLoan);
router.post('/:id/devolver', roleGuard(['Admin']), returnLoan);
router.post('/:id/aplazar', roleGuard(['Admin']), delayLoanValidator, validate, delayLoan);

router.delete('/:id', roleGuard(['Admin']), deleteLoan);

module.exports = router;