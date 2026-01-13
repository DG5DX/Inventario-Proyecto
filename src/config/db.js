const mongoose = require('mongoose');
const logger = require('./logger.js')

mongoose.set('strictQuery', false);

const connectDB = async () => {
    const uri = process.env.MONGO_URI;
    if(!uri) {
        throw new Error('MONGO_URI no está definido');
    }
    try{
        await mongoose.connect(uri, {
            maxPoolSize: 10
        });
        logger.info('Coneción a MongoDB establecida');
    } catch (error) {
        logger.error('Error conectando a MongoDB');
        throw error;
    }
};

module.exports = { connectDB };