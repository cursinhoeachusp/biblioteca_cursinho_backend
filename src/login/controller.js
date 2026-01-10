const pool = require('../config/db');
const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs'); // Descomente quando for usar criptografia real

const login = async (req, res) => {
    const { email, senha } = req.body;

    try {
        const result = await pool.query('SELECT * FROM usuario WHERE gmail = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Usuário não encontrado" });
        }

        const usuario = result.rows[0];

        if (senha !== usuario.senha) {
             return res.status(401).json({ message: "Senha incorreta" });
        }

        // MODO SEGURO (Para o futuro, com bcrypt):
        // const senhaBate = await bcrypt.compare(senha, usuario.senha);
        // if (!senhaBate) return res.status(401).json({ message: "Senha incorreta" });

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, admin: usuario.admin },
            process.env.JWT_SECRET || 'segredo_super_secreto_do_inovatec',
            { expiresIn: '8h' } // Token expira em 8 horas
        );

        res.json({
            token,
            user: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.gmail,
                admin: usuario.admin
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: "Erro interno no servidor" });
    }
};

module.exports = { login };