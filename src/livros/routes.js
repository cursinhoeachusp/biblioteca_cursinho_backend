const {Router} = require('express');
const controller = require('./controller');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const router = Router();

router.get('/', controller.getAll);
router.post('/', controller.addLivro);
router.put('/:id', controller.editLivro);
router.delete('/:id', controller.removeLivro);
router.post('/autor', controller.adicionarAutorAoLivro); 
router.get('/isbn/:isbn', controller.getByIsbnCompleto);
router.post('/import', upload.single('arquivo'), controller.importarCsv);
router.delete('/isbn/:isbn', controller.removeByIsbn);
router.get('/:isbn/exemplares-indisponiveis', controller.getExemplaresIndisponiveis);
router.get('/:isbn/exemplares-disponiveis', controller.getExemplaresDisponiveis);


module.exports = router;