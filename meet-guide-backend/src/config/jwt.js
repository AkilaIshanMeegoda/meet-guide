/**
 * JWT Configuration
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'meetguide_super_secret_key_change_in_production_2026';
const JWT_EXPIRES_IN = process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES 
    ? `${process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES}m` 
    : '24h';

/**
 * Generate JWT token
 */
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

module.exports = {
    JWT_SECRET,
    JWT_EXPIRES_IN,
    generateToken,
    verifyToken
};
