const express = require('express');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.route.js');
const messageRoutes = require('./routes/message.route.js');

dotenv.config();



const app = express();

const PORT =process.env.PORT||3000;
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/message', messageRoutes);

if (process.env.NODE_ENV === "development") {
  console.log("App is running in development mode.");
}






app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}
);