const express = require('express');
const {
  getLoans,
  createLoan,
  approveLoan,
  rejectLoan,
  returnLoan,
  confirmPartialReturn,
  delayLoan,
  getLoan,
  deleteLoan,
  notifyReturn,
  forceCloseLoan
} = require('../controllers/loanController.js');
const authJWT    = require('../middlewares/authJWT.js');
const roleGuard  = require('../middlewares/roleGuard.js');
const validate   = require('../middlewares/validate.js');
const { loanScope, injectScope } = require('../middlewares/scopeGuard.js');
const {
  createLoanValidator,
  approveLoanValidator,
  delayLoanValidator,
  rejectLoanValidator
} = require('../validators/loanValidator.js');

const router = express.Router();

router.use(authJWT);

// Listar: injectScope inyecta filtro para Admins automáticamente
router.get('/',    injectScope, getLoans);
router.get('/:id', getLoan);

// Crear préstamo (usuarios comunes)
router.post('/', createLoanValidator, validate, createLoan);

// Gestión admin: loanScope verifica que el préstamo sea de su scope
router.post('/:id/aprobar',         roleGuard(['Admin']), loanScope, approveLoanValidator, validate, approveLoan);
router.post('/:id/rechazar',        roleGuard(['Admin']), loanScope, rejectLoanValidator,  validate, rejectLoan);
router.post('/:id/devolver',        roleGuard(['Admin']), loanScope, returnLoan);
router.post('/:id/forzar-cierre',   roleGuard(['Admin']), loanScope, forceCloseLoan);
router.post('/:id/confirmar-parcial', roleGuard(['Admin']), loanScope, confirmPartialReturn);
router.post('/:id/aplazar',         roleGuard(['Admin']), loanScope, delayLoanValidator, validate, delayLoan);

// Notificación de devolución (usuario común)
router.post('/:id/notificar-devolucion', roleGuard(['Comun']), notifyReturn);

// Eliminar: solo SuperAdmin puede eliminar cualquier préstamo;
// Admin puede eliminar solo los de su scope
router.delete('/:id', roleGuard(['Admin']), loanScope, deleteLoan);

module.exports = router;