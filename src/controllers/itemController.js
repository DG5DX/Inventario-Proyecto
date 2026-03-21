const Item      = require('../models/Item.js');
const Zone      = require('../models/Zone.js');
const Classroom = require('../models/Classroom.js');
const logger    = require('../config/logger.js');

const buildQuery = ({ zona, aula, q }) => {
    const query = {};
    if (zona) query.zona = zona;
    if (aula) query.aula = aula;
    if (q)    query.nombre = { $regex: q, $options: 'i' };
    return query;
};

// ── GET /items ─────────────────────────────────────────────────────────────────
const getItems = async (req, res, next) => {
    try {
        const query = buildQuery(req.query);

        // ?inactivos=true → solo SuperAdmin vía ruta protegida
        const soloInactivos = req.query.inactivos === 'true';
        query.activo = soloInactivos ? false : true;

        // Si es Admin (no SuperAdmin), filtrar solo sus ambientes asignados
        if (req.adminScope) {
            if (req.adminScope.length === 0) return res.json([]);
            if (query.aula) {
                if (!req.adminScope.includes(String(query.aula))) return res.json([]);
            } else {
                query.aula = { $in: req.adminScope };
            }
        }

        const items = await Item.find(query)
            .populate('zona aula cuentadante')
            .sort({ nombre: 1 });
        res.json(items);
    } catch (error) {
        next(error);
    }
};

// ── GET /items/:id ─────────────────────────────────────────────────────────────
const getItem = async (req, res, next) => {
    try {
        const item = await Item.findById(req.params.id).populate('zona aula cuentadante');
        if (!item) return res.status(404).json({ message: 'Ítem no encontrado' });
        res.json(item);
    } catch (error) {
        next(error);
    }
};

// ── POST /items ────────────────────────────────────────────────────────────────
const createItem = async (req, res, next) => {
    try {
        const body = { ...req.body };

        if (body.tipo_categoria === 'Equipo O Maquinaria') {
            const placa = (body.numero_placa || '').trim();
            if (!placa) {
                return res.status(422).json({ message: 'El número de placa SENA es obligatorio para equipos y maquinaria.' });
            }
            body.numero_placa = placa.toUpperCase();
        } else {
            delete body.numero_placa;
        }

        const item = await Item.create(body);
        res.status(201).json(item);
    } catch (error) {
        if (error.code === 11000 && error.keyPattern?.numero_placa) {
            return res.status(409).json({
                message: `La placa "${req.body.numero_placa}" ya está registrada. El número de placa SENA debe ser único.`
            });
        }
        next(error);
    }
};

// ── PUT /items/:id ─────────────────────────────────────────────────────────────
const updateItem = async (req, res, next) => {
    try {
        const body = { ...req.body };

        if (body.tipo_categoria === 'Equipo O Maquinaria') {
            const placa = (body.numero_placa || '').trim();
            if (!placa) {
                return res.status(422).json({ message: 'El número de placa SENA es obligatorio para equipos y maquinaria.' });
            }
            body.numero_placa = placa.toUpperCase();
        } else {
            delete body.numero_placa;
        }

        // Nunca permitir que el frontend sobreescriba cantidad_disponible directamente en edición.
        // El disponible solo se recalcula si cantidad_total_stock REALMENTE cambió respecto al valor en BD.
        delete body.cantidad_disponible;

        if (body.cantidad_total_stock !== undefined) {
            const nuevoTotal = Number(body.cantidad_total_stock);

            // Leer el ítem actual de BD para comparar
            const itemActual = await Item.findById(req.params.id).lean();
            if (!itemActual) return res.status(404).json({ message: 'Ítem no encontrado' });

            const totalActual = itemActual.cantidad_total_stock;

            // Solo recalcular disponible si el total realmente cambió
            if (nuevoTotal !== totalActual) {
                const Loan = require('../models/Loan.js');
                const prestamosActivos = await Loan.find({
                    estado: { $in: ['Aprobado', 'Aplazado'] },
                    'items.item': req.params.id,
                }).lean();

                let unidadesEnPrestamo = 0;
                for (const loan of prestamosActivos) {
                    for (const li of loan.items) {
                        if (String(li.item) === String(req.params.id) && li.estado_item === 'Aprobado') {
                            unidadesEnPrestamo += (li.cantidad_prestamo - (li.cantidad_confirmada || 0));
                        }
                    }
                }

                const diferencia = nuevoTotal - totalActual;
                // El disponible sube/baja proporcionalmente al cambio del total,
                // respetando las entradas y bajas ya aplicadas.
                const nuevoDisponible = Math.max(0, itemActual.cantidad_disponible + diferencia);
                // No puede superar el nuevo total menos lo que está en préstamo
                body.cantidad_disponible = Math.min(nuevoDisponible, Math.max(0, nuevoTotal - unidadesEnPrestamo));
            }
            // Si el total no cambió → no se toca cantidad_disponible (se preservan entradas/bajas)
        }

        const item = await Item.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
        if (!item) return res.status(404).json({ message: 'Ítem no encontrado' });
        res.json(item);
    } catch (error) {
        if (error.code === 11000 && error.keyPattern?.numero_placa) {
            return res.status(409).json({
                message: `La placa "${req.body.numero_placa}" ya está registrada. El número de placa SENA debe ser único.`
            });
        }
        next(error);
    }
};

// ── DELETE /items/:id → inhabilitar ───────────────────────────────────────────
const deleteItem = async (req, res, next) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Ítem no encontrado' });
        if (!item.activo) return res.status(409).json({ message: 'El ítem ya está inhabilitado' });
        item.activo = false;
        await item.save();
        res.json({ message: `Ítem "${item.nombre}" inhabilitado`, item });
    } catch (error) {
        next(error);
    }
};

// ── PATCH /items/:id/reactivar ─────────────────────────────────────────────────
const reactivarItem = async (req, res, next) => {
    try {
        // Sin populate: necesitamos item.aula e item.zona como ObjectIds puros
        // para pasarlos a findById correctamente.
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Ítem no encontrado' });
        if (item.activo) return res.status(409).json({ message: 'El ítem ya está activo' });

        const Classroom = require('../models/Classroom.js');
        const Zone      = require('../models/Zone.js');

        // item.aula e item.zona son ObjectIds — findById los acepta directamente
        const aula = await Classroom.findById(item.aula);
        if (!aula || !aula.activo) {
            return res.status(409).json({
                message: `No se puede reactivar: el ambiente "${aula?.nombre || 'asociado'}" está inhabilitado. Reactiva el ambiente primero.`,
            });
        }

        const zona = await Zone.findById(item.zona);
        if (!zona || !zona.activo) {
            return res.status(409).json({
                message: `No se puede reactivar: la sede "${zona?.nombre || 'asociada'}" está inhabilitada. Reactiva la sede primero.`,
            });
        }

        item.activo = true;
        await item.save();
        // Popular para devolver respuesta completa
        await item.populate('zona aula cuentadante');
        res.json({ message: `Ítem "${item.nombre}" reactivado`, item });
    } catch (error) {
        next(error);
    }
};

// ── GET /items/:id/stock-info ──────────────────────────────────────────────────
const getItemStockInfo = async (req, res, next) => {
    try {
        const item = await Item.findById(req.params.id).lean();
        if (!item) return res.status(404).json({ message: 'Ítem no encontrado' });

        const Loan = require('../models/Loan.js');
        const prestamosActivos = await Loan.find({
            estado: { $in: ['Aprobado', 'Aplazado'] },
            'items.item': req.params.id,
        }).lean();

        let unidadesEnPrestamo = 0;
        for (const loan of prestamosActivos) {
            for (const li of loan.items) {
                if (String(li.item) === String(req.params.id) && li.estado_item === 'Aprobado') {
                    unidadesEnPrestamo += (li.cantidad_prestamo - (li.cantidad_confirmada || 0));
                }
            }
        }

        res.json({
            cantidad_total_stock: item.cantidad_total_stock,
            cantidad_disponible:  item.cantidad_disponible,
            unidades_en_prestamo: unidadesEnPrestamo,
            minimo_total_seguro:  unidadesEnPrestamo,
        });
    } catch (error) {
        next(error);
    }
};

// ── POST /items/:id/ajuste-stock ───────────────────────────────────────────────
const adjustStock = async (req, res, next) => {
    try {
        const { tipo, cantidad, motivo } = req.body;
        const cant = Number(cantidad);

        if (!['entrada', 'baja', 'ajuste'].includes(tipo))
            return res.status(400).json({ message: 'tipo debe ser "entrada", "baja" o "ajuste"' });
        if (!Number.isInteger(cant) || cant < 0)
            return res.status(400).json({ message: 'cantidad debe ser un entero mayor o igual a 0' });
        if (tipo !== 'ajuste' && cant < 1)
            return res.status(400).json({ message: 'cantidad debe ser un entero mayor a 0' });
        if (!motivo || !motivo.trim())
            return res.status(400).json({ message: 'El motivo es obligatorio' });

        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Ítem no encontrado' });

        const Loan = require('../models/Loan.js');
        const prestamosActivos = await Loan.find({
            estado: { $in: ['Aprobado', 'Aplazado'] },
            'items.item': req.params.id,
        }).lean();

        let unidadesEnPrestamo = 0;
        for (const loan of prestamosActivos) {
            for (const li of loan.items) {
                if (String(li.item) === String(req.params.id) && li.estado_item === 'Aprobado') {
                    unidadesEnPrestamo += (li.cantidad_prestamo - (li.cantidad_confirmada || 0));
                }
            }
        }

        if (tipo === 'entrada') {
            item.cantidad_total_stock += cant;
            item.cantidad_disponible  += cant;
        } else if (tipo === 'baja') {
            if (cant > item.cantidad_disponible) {
                return res.status(400).json({
                    message: `Solo se pueden dar de baja ${item.cantidad_disponible} unidad(es) disponibles. ` +
                             `Las ${unidadesEnPrestamo} en préstamos activos no se pueden eliminar.`
                });
            }
            item.cantidad_total_stock -= cant;
            item.cantidad_disponible  -= cant;
        } else {
            const maxDisponiblePosible = item.cantidad_total_stock - unidadesEnPrestamo;
            if (cant > maxDisponiblePosible) {
                return res.status(400).json({
                    message: `El disponible máximo posible es ${maxDisponiblePosible} ` +
                             `(total ${item.cantidad_total_stock} − ${unidadesEnPrestamo} en préstamo). ` +
                             `Si necesitas más, registra primero una Entrada.`
                });
            }
            item.cantidad_disponible = cant;
        }

        await item.save();
        logger.info(`Ajuste stock "${item.nombre}": tipo=${tipo} cant=${cant} motivo="${motivo}"`);
        res.json({ item, ajuste: { tipo, cantidad: cant, motivo, unidadesEnPrestamo } });
    } catch (error) {
        next(error);
    }
};

// ── POST /items/bulk ───────────────────────────────────────────────────────────
const bulkCreateItems = async (req, res, next) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0)
            return res.status(400).json({ message: 'Se requiere un array de ítems no vacío.' });
        if (items.length > 500)
            return res.status(400).json({ message: 'Máximo 500 ítems por importación.' });

        const [todasZonas, todasAulas] = await Promise.all([
            Zone.find({}).lean(),
            Classroom.find({}).lean()
        ]);

        // Si es Admin, solo puede importar a sus ambientes asignados
        const adminScope = req.adminScope || null;

        const placasExistentes = new Set(
            (await Item.find({ numero_placa: { $exists: true, $ne: null } }, 'numero_placa').lean())
                .map(i => i.numero_placa)
        );
        const placasEnLote = new Set();
        const exitosos = [];
        const fallidos = [];

        for (let idx = 0; idx < items.length; idx++) {
            const raw  = items[idx];
            const fila = idx + 2;
            const errores = [];

            const nombre = (raw.nombre || '').trim();
            if (!nombre) errores.push('nombre es obligatorio');

            const tiposValidos = ['Consumible', 'De Uso Controlado', 'Equipo O Maquinaria'];
            const tipo_categoria = (raw.tipo_categoria || '').trim();
            if (!tiposValidos.includes(tipo_categoria))
                errores.push(`tipo_categoria inválido: "${tipo_categoria}"`);

            const cantidad_total_stock = parseInt(raw.cantidad_total_stock, 10);
            if (isNaN(cantidad_total_stock) || cantidad_total_stock < 0)
                errores.push('cantidad debe ser un número mayor o igual a 0');

            const nombreZona = (raw.zona || '').trim();
            const zonaDoc = todasZonas.find(z => z.nombre.toLowerCase() === nombreZona.toLowerCase());
            if (!zonaDoc) errores.push(`Sede "${nombreZona}" no encontrada`);

            const nombreAula = (raw.aula || '').trim();
            let aulaDoc = null;
            if (zonaDoc) {
                aulaDoc = todasAulas.find(a =>
                    a.nombre.toLowerCase() === nombreAula.toLowerCase() &&
                    String(a.zona) === String(zonaDoc._id)
                );
                if (!aulaDoc) errores.push(`Ambiente "${nombreAula}" no encontrado en la sede "${nombreZona}"`);
            }

            // Validar scope del admin
            if (aulaDoc && adminScope && !adminScope.includes(String(aulaDoc._id))) {
                errores.push(`No tienes permiso para importar ítems al ambiente "${nombreAula}"`);
            }

            let numero_placa = null;
            if (tipo_categoria === 'Equipo O Maquinaria') {
                numero_placa = (raw.numero_placa || '').trim().toUpperCase();
                if (!numero_placa) errores.push('numero_placa es obligatorio para Equipos O Maquinaria');
                else if (placasExistentes.has(numero_placa)) errores.push(`La placa "${numero_placa}" ya existe`);
                else if (placasEnLote.has(numero_placa))     errores.push(`La placa "${numero_placa}" está duplicada en el archivo`);
                if (numero_placa && !placasExistentes.has(numero_placa) && !placasEnLote.has(numero_placa))
                    placasEnLote.add(numero_placa);
            }

            const cuentadanteId = raw.cuentadante;
            if (!cuentadanteId) errores.push('cuentadante es obligatorio');

            if (errores.length > 0) { fallidos.push({ fila, nombre: nombre || `Fila ${fila}`, errores }); continue; }

            exitosos.push({
                nombre,
                descripcion:          (raw.descripcion   || '').trim() || undefined,
                codigo_unspsc:        (raw.codigo_unspsc || '').trim() || undefined,
                unidad_medida:        (raw.unidad_medida || '').trim() || undefined,
                presentacion:         (raw.presentacion  || '').trim() || undefined,
                zona:                 zonaDoc._id,
                aula:                 aulaDoc._id,
                cantidad_total_stock,
                tipo_categoria,
                numero_placa:         numero_placa || undefined,
                cuentadante:          cuentadanteId,
                _fila:                fila,
            });
        }

        let insertados = 0, actualizados = 0;
        const erroresInsercion = [];

        for (const doc of exitosos) {
            const { _fila, ...campos } = doc;
            try {
                const esEquipo = campos.tipo_categoria === 'Equipo O Maquinaria';
                if (esEquipo) {
                    const nuevo = new Item({ ...campos, cantidad_disponible: campos.cantidad_total_stock,
                        estado: campos.cantidad_total_stock > 0 ? 'Disponible' : 'Agotado' });
                    await nuevo.save();
                    insertados++;
                } else {
                    const existente = await Item.findOne({
                        nombre: { $regex: `^${campos.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
                        zona: campos.zona, aula: campos.aula,
                    });
                    if (existente) {
                        existente.cantidad_total_stock += campos.cantidad_total_stock;
                        existente.cantidad_disponible  += campos.cantidad_total_stock;
                        existente.estado = existente.cantidad_disponible > 0 ? 'Disponible' : 'Agotado';
                        if (campos.descripcion)   existente.descripcion   = campos.descripcion;
                        if (campos.codigo_unspsc) existente.codigo_unspsc = campos.codigo_unspsc;
                        if (campos.unidad_medida) existente.unidad_medida = campos.unidad_medida;
                        if (campos.presentacion)  existente.presentacion  = campos.presentacion;
                        await existente.save();
                        actualizados++;
                    } else {
                        await new Item({ ...campos, cantidad_disponible: campos.cantidad_total_stock,
                            estado: campos.cantidad_total_stock > 0 ? 'Disponible' : 'Agotado' }).save();
                        insertados++;
                    }
                }
            } catch (err) {
                logger.error(`[bulkCreate] Error fila ${_fila}: ${err.message}`);
                erroresInsercion.push({ fila: _fila, nombre: campos.nombre, errores: [err.message] });
            }
        }

        res.status(207).json({
            total: items.length, insertados, actualizados,
            fallidos: fallidos.length + erroresInsercion.length,
            errores:  [...fallidos, ...erroresInsercion],
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getItems, getItem, getItemStockInfo, adjustStock,
    createItem, updateItem, deleteItem, reactivarItem, bulkCreateItems,
};