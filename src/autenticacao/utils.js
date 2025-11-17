const jwt = require("jsonwebtoken");

function generateAccessToken(user, accessTokenSecret) {
  return jwt.sign({ username: user.username }, accessTokenSecret, {
    expiresIn: "1m",
  }); // expira em 1 min
}

function generateRefreshToken(user, refreshTokenSecret) {
  const refreshToken = jwt.sign(
    { username: user.username },
    refreshTokenSecret,
    { expiresIn: "10m" }
  );
  return refreshToken;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};
