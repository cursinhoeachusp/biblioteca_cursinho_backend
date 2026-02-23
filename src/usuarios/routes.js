// routes.js

const { Router } = require('express');
const controller = require('./controller');
const express = require('express');
const app = express();

app.use(express.json());

const router = Router();

router.get('/', controller.getAll);
router.get('/search', controller.searchUsuarios); 
router.get('/atrasados', controller.getAtrasados);
router.get('/:id', controller.getById);
router.get('/resumo/:email', controller.getResumoBiblioteca);

router.post('/', controller.create);
router.post('/batch', controller.createBatch); 
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;