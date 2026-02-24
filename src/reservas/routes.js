const { Router } = require('express');
const controller = require('./controller');

const router = Router();

router.post('/', controller.createReserva);
router.get('/', controller.getAllReservas);
router.post('/carteirinha', controller.createReservaPelaCarteirinha);

module.exports = router;
