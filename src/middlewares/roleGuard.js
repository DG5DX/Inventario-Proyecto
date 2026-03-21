/**
 * Jerarquía de roles: SuperAdmin > Admin > Comun
 * Si una ruta permite 'Admin', SuperAdmin también puede acceder.
 * Si una ruta permite 'Comun', todos los roles pueden acceder.
 */
const ROLE_HIERARCHY = { SuperAdmin: 3, Admin: 2, Comun: 1 };

const roleGuard = (roles = []) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'No autenticado' });
    }

    const userLevel     = ROLE_HIERARCHY[req.user.rol] ?? 0;
    const requiredLevel = Math.min(...roles.map(r => ROLE_HIERARCHY[r] ?? 99));

    if (userLevel < requiredLevel) {
        return res.status(403).json({ message: 'No autorizado' });
    }

    return next();
};

module.exports = roleGuard;