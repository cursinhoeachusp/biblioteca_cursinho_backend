const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { generateAccessToken, generateRefreshToken } = require("./utils");

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const user = {
  username: "admin",
  password: process.env.ADMIN_PASSWORD_HASH,
};

let refreshTokens = [];

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token não fornecido." });

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({ message: "Token inválido ou expirado." });
    req.user = user;
    next();
  });
}

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username !== user.username)
      return res.status(401).json({ message: "Usuário inválido." });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ message: "Senha incorreta." });

    const accessToken = generateAccessToken(user, ACCESS_TOKEN_SECRET);
    const refreshToken = generateRefreshToken(user, REFRESH_TOKEN_SECRET);
    refreshTokens.push(refreshToken);

    res.json({ accessToken, refreshToken });
  } catch {
    res.status(500).send("Erro ao fazer login");
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    refreshTokens = refreshTokens.filter((token) => token !== refreshToken);
    res.json({ message: "Logout realizado com sucesso." });
  } catch {
    res.status(500).send("Erro ao fazer logout");
  }
};

const renewToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken)
      return res.status(401).json({ message: "Refresh token ausente." });
    if (!refreshTokens.includes(refreshToken))
      return res.status(403).json({ message: "Refresh token inválido." });

    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err, user) => {
      if (err)
        return res.status(403).json({ message: "Refresh token expirado." });
      const newAccessToken = generateAccessToken(
        { username: user.username },
        ACCESS_TOKEN_SECRET
      );
      res.json({ accessToken: newAccessToken });
    });
  } catch {
    res.status(500).send("Erro ao renovar token");
  }
};

module.exports = {
  authenticateToken,
  login,
  logout,
  renewToken,
};
