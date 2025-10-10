import jwt from 'jsonwebtoken';


export const generateToken = (userId,res) => {
    const {JWT_SECRET}=process.env;
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
        secure: process.env.NODE_ENV === 'development' ? false : true,
    });
    return token;
}