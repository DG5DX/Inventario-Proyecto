const jwt = require ('jsonwebtoken');
const User = require('../models/User.js');

const authJWT = async (req, res, next) => {
    try {
        const header = req.headers.authorization || '';
        const [type, token] = header.split(' ');
        if (type !== 'Bearer' || !token) {
            return res.status(401).json({ message: 'Token requerido' });
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.sub).lean();
        if (!user){
            return res.status(401).json({ message: 'Usuario no encontrado' });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido' });
    }
};

module.exports = authJWT;