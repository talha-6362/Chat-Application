import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";
import { sendWelcomeEmail } from "../emails/emailHandlers.js";
import "dotenv/config"; 
import { ENV } from "../lib/env.js";

export const signup = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // 1️⃣ Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2️⃣ Validate password length
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // 3️⃣ Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // 4️⃣ Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 5️⃣ Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 6️⃣ Create and save new user
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    // 7️⃣ Generate token
    generateToken(newUser._id, res);

    // 8️⃣ Send welcome email (after user saved)
    try {
      await sendWelcomeEmail(newUser.email, newUser.fullName, ENV.CLIENT_URL);
    } catch (error) {
      console.error("Error sending welcome email:", error);
    }

    // 9️⃣ Send response
    return res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      profilePic: newUser.profilePic,
      message: "User created successfully ",
    });

  } catch (error) {
    console.error("Error in signup controller:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
