import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";

export const signup = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // 🧩 1. Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 🧩 2. Validate password length
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // 🧩 3. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // 🧩 4. Check if user already exists (CORRECT WAY ✅)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 🧩 5. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 🧩 6. Create new user
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    // 🧩 7. Generate JWT token and save user
    generateToken(newUser._id, res);
    await newUser.save();

    // 🧩 8. Success response
    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      profilePic: newUser.profilePic,
      message: "User created successfully",
    });
  } catch (error) {
    console.error(" Error during signup:", error);
    res.status(500).json({ message: "Server error" });
  }
};
