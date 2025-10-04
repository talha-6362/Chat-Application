const express = require('express');

const app = express();
const dotenv = require('dotenv');

const router = express.Router();
dotenv.config();

router.get('/send', (req, res) => {
    res.send('Send message endpoint');
}
);
router.get('/inbox', (req, res) => {
    res.send('Inbox endpoint');
}
);
router.get('/delete', (req, res) => {
    res.send('Delete message endpoint');
}
);
module.exports = router;