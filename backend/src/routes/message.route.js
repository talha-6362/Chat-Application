import express from "express";

const router = express.Router();

router.get("/send", (req, res) => {
  res.send("Send message endpoint");
});

router.get("/inbox", (req, res) => {
  res.send("Inbox endpoint");
});

router.get("/delete", (req, res) => {
  res.send("Delete message endpoint");
});

// ES Module export
export default router;
