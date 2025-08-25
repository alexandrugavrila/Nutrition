const { createProxyMiddleware } = require("http-proxy-middleware");

const target =
  process.env.BACKEND_URL ||
  (process.env.BACKEND_PORT
    ? `http://localhost:${process.env.BACKEND_PORT}`
    : "http://backend:8000");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
    }),
  );
};
