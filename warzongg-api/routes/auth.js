const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  handleValidation,
  authRegister,
  authLogin,
  authActivateCheck,
  authActivatePlayer,
} = require('../middleware/validate');
const { register, login, logout, me, activatePlayer, checkPlayerActivation } = require('../controllers/authController');

// POST /api/auth/register
router.post('/register', authRegister, handleValidation, register);

// POST /api/auth/login
router.post('/login', authLogin, handleValidation, login);

// POST /api/auth/activate-player/check — email lookup before username/password step
router.post('/activate-player/check', authActivateCheck, handleValidation, checkPlayerActivation);

// POST /api/auth/activate-player
router.post('/activate-player', authActivatePlayer, handleValidation, activatePlayer);

// POST /api/auth/logout
router.post('/logout', requireAuth, logout);

// GET /api/auth/me
router.get('/me', requireAuth, me);

module.exports = router;
