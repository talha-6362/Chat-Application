import express from "express";

const router = express.Router();

router.get("/signup", (req, res) => {
  res.send("Signup endpoint");
});

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
