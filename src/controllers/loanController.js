const loanService = require('../services/loanService.js');

const getLoans = async (req, res, next) => {
  try {
    const loans = await loanService.listLoans(req.user, req.query);
    res.json(loans);
  } catch (error) {
    next(error);
  }
};

const createLoan = async (req, res, next) => {
  try {
    const loan = await loanService.createLoan(req.user._id, req.body);
    res.status(201).json(loan);
  } catch (error) {
    next(error);
  }
};

const approveLoan = async (req, res) => {
  try {
    const {
      fecha_estimada,
      approvals = [],
      itemsToRemove = [],
      observacion_aprobacion,
      cuentadante_principal
    } = req.body;
    const loan = await loanService.approveLoan(req.params.id, fecha_estimada, {
      approvals,
      itemsToRemove,
      observacion_aprobacion,
      cuentadante_principal: cuentadante_principal || undefined,
    });
    res.json(loan);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
};

const rejectLoan = async (req, res) => {
  try {
    const loan = await loanService.rejectLoan(req.params.id, req.body.observacion_rechazo);
    res.json(loan);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
};

const returnLoan = async (req, res) => {
  try {
    const loan = await loanService.returnLoan(req.params.id);
    res.json(loan);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
};

const confirmPartialReturn = async (req, res) => {
  try {
    const { loanItemId, cantidadConfirmada, observacion_recepcion } = req.body;
    if (!loanItemId)
      return res.status(400).json({ message: 'loanItemId es requerido.' });
    const cant = Number(cantidadConfirmada);
    if (isNaN(cant) || cant < 0 || !Number.isInteger(cant))
      return res.status(400).json({ message: 'La cantidad debe ser un número entero no negativo.' });
    const result = await loanService.confirmPartialReturn(
      req.params.id,
      loanItemId,
      cant,
      observacion_recepcion ? String(observacion_recepcion).trim() : undefined
    );
    res.json(result);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
};

const delayLoan = async (req, res) => {
  try {
    const loan = await loanService.delayLoan(req.params.id, req.body.nueva_fecha_estimada);
    res.json(loan);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
};

const getLoan = async (req, res) => {
  try {
    const loan = await loanService.getLoanById(req.user, req.params.id);
    res.json(loan);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
};

const deleteLoan = async (req, res, next) => {
  try {
    await loanService.deleteLoan(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const notifyReturn = async (req, res, next) => {
  try {
    const result = await loanService.notifyReturnRequest(req.params.id, req.user._id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const forceCloseLoan = async (req, res) => {
  try {
    const { observacion_cierre } = req.body;
    const loan = await loanService.forceCloseLoan(req.params.id, observacion_cierre?.trim() || undefined);
    res.json(loan);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
};

module.exports = {
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
};