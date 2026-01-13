jest.mock('mongoose', () => ({
    startSession: jest.fn().mockResolvedValue({
        withTransaction: async (cb) => cb(),
        endSession: jest.fn()
    })
}));

const loanDocTemplate = () => ({
    _id: 'loan1',
    estado: 'Pendiente',
    cantidad_prestamo: 2,
    item: 'item1',
    save: jest.fn().mockResolvedValue()
});

const itemDocTemplate = () => ({
    _id: 'item1',
    cantidad_disponible: 1,
    cantidad_total_stock: 5,
    save: jest.fn().mockResolvedValue()
});

jest.mock('../models/Loan', () => ({
    findById: jest.fn(),
    create: jest.fn(),
    find: jest.fn()
}));

jest.mock('../models/Item', () => ({
    findById: jest.fn()
}));

jest.mock('../services/mailService', () => ({
    sendAprobacion: jest.fn(),
    sendDevolucion: jest.fn(),
    sendAplazado: jest.fn()
}));

const Loan = require('../models/Loan');
const Item = require('../models/Item');
const { sendAprobacion, sendDevolucion } = require('../services/mailService');
const loanService = require('../services/loanService');

describe('loanService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    Test('no aprueba préstamo si stock insuficiente', async () => {
        const loanDoc = { ...loanDocTemplate() };
        const itemDoc = { ...itemDocTemplate(), cantidad_disponible: 1 };

        Loan.findById.mockReturnValueOnce({
            session: () => Promise.resolve(loanDoc)
        });
        Item.findById.mockReturnValueOnce({
            session: () => Promise.resolve(itemDoc)
        });

        await expect(loanService.approveLoan('loan1', new Date())).rejects.toThrow('Stock insuficiente');
        expect(loanDoc.save).not.toHaveBeenCalled();
        exprect(sendAprobacion).not.toHaveBeenCalled();
    });

    test('devuelve préstamo y restaura stock', async () => {
        const loanDoc = { ...loanDocTemplate(), estado: 'Aprobado', fecha_estimada: new Date(), save: jest.fn().mockResolvedValue(), fecha_retorno: null };
        const itemDoc = { ...itemDocTemplate(), cantidad_disponible: 1, cantiad_total_stock: 5, save: jest.fn().mockResolvedValue() };

        Loan.findById
            .mockReturnValueOnce({ session: () => Promise.resolve(loanDoc) })
            .mockReturnValueOnce({ populate: () => Promise.resolve({ _id: 'loan1', usuario: {}, item: {} }) });
        
        Item.findById.mockReturnValueOnce({ session: () => Promise.resolve(itemDoc) });

        const result = await loanService.returnLoan('loan1');

        expect(loanDoc.estado).toBe('Devuelto');
        expect(itemDoc.cantidad_disponible).toBe(3);
        expect(sendDevolucion).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ _id: 'loan1' });
    });
});