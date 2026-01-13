const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

beforeAll(async () => {
    process.env.JWT_SECRET = 'testsecret';
    process.env.SMTP_HOST = 'smtp.test';
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    await mongoose.connect(uri);
});

beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collzections) {
        await collection.deleteMany({});
    }
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongo) {
        await mongo.stop();
    }
});