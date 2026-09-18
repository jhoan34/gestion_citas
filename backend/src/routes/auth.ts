import express from "express";
import checkAuth from "../controllers/checkauth.js";
import protectRoutes from "../middlewares/protectroutes.js";

const router = express.Router();

router.get("/check", protectRoutes, checkAuth)

export default router;