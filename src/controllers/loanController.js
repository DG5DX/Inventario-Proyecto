const loanService = require('../services/loanService');

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
    const loan = await loanService.approveLoan(req.params.id, req.body.fecha_estimada);
    res.json(loan);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
};

const rejectLoan = async (req, res) => {
  try {
    const loan = await loanService.rejectLoan(req.params.id);
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

module.exports = {
  getLoans,
  createLoan,
  approveLoan,
  rejectLoan,
  returnLoan,
  delayLoan,
  getLoan,
  deleteLoan
};