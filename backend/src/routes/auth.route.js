import express from "express";
import { signup } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/signup", signup);
router.get("/update", (req, res) => {
  res.send("Update endpoint");
});

router.get("/delete", (req, res) => {
  res.send("Delete endpoint");
});

router.get("/login", (req, res) => {
  res.send("Login endpoint");
});

// ES Module export
export default router;
