// Vercel entry point. An Express app is already a (req, res) handler, so the
// same app that server/index.js listens with is what runs as the function.
module.exports = require('../server/app');
