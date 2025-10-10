import jwt from 'jsonwebtoken';

import { ENV } from './env.js';
export const generateToken = (userId,res) => {
    const {JWT_SECRET}=ENV;
    if(!JWT_SECRET){
        throw new Error("JWT_SECRET is not Configured");
    }

    const token = jwt.sign({ userId }, JWT_SECRET, {
        expiresIn: '7d',
    });
    res.cookie('jwt', token, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, 
        secure: ENV.NODE_ENV === 'development' ? false : true,
    });
    return token;
}