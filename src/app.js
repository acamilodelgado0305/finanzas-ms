import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import accountRoutes from "./routes/accountRoutes.js";
import categorieRouter from "./routes/categorieRoutes.js";
import transaccionRouter from "./routes/transaccionRoutes.js";
import transferRouter from "./routes/transfersRoutes.js";
import pagospendingRouter from "./routes/pagospendingRoutes.js"
import incomesRoutes from './routes/incomes.js';
import expensesRoutes from './routes/expenses.js';
import providerRoutes from './routes/Providers.js';
import balanceRoutes from './routes/balanceRoutes.js'


const app = express();
import dotenv from "dotenv";

// Incluye los módulos necesarios para la autenticación

app.use(cookieParser());
app.use(
  cors({
    credentials: true,
    origin: ["https://ispsuite.app.la-net.co", "http://localhost:5173"],
  })
);
app.use(express.json());

// Middleware para manejar errores
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  // Puedes enviar una respuesta de error al cliente o realizar otras acciones aquí
  res.status(500).send("Error interno del servidor");
});

const PORT = process.env.PORT || 3005;

// Rutas protegidas (requieren autenticación)
app.use("/api", accountRoutes);
app.use("/api", categorieRouter);
app.use("/api", transaccionRouter);
app.use("/api", transferRouter);
app.use("/api", pagospendingRouter);
app.use("/api", incomesRoutes);
app.use("/api", expensesRoutes);
app.use("/api", providerRoutes);
app.use("/api", balanceRoutes);



// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});

export default app;
