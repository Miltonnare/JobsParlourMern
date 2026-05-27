const jwt=require('jsonwebtoken');
const User=require('../models/userModel');

const protect=async (req,res,next)=>{
    const authHeader=req.headers.authorization;

    if(!authHeader||!authHeader.startsWith("Bearer")){
        return res.status(401).json({message:"Unauthorized token",requestId:req.requestId});
    }
    const token=authHeader.split(' ')[1];

    try {
        const decoded=jwt.verify(token,process.env.JWT_SECRET);
        req.user=await User.findById(decoded.id).select('-password');
        if(!req.user){
            return res.status(401).json({message:"User not found for token",requestId:req.requestId});
        }

        next();
    } catch (error) {
        res.status(401).json({message:"Token is invalid or expired",requestId:req.requestId});
    }
};

module.exports={protect};
