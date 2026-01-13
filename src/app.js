const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true
}));


app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api', routes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  if (path.extname(req.path)) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) {
      next(err);
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

app.use(errorHandler);

module.exports = app;