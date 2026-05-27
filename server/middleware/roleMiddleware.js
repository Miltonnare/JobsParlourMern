
const restrictTo=(...roles)=>{
    return(req,res,next)=>{
        if(!req.user){
            return res.status(401).json({message:"Authentication required",requestId:req.requestId});
        }

        if(!roles.includes(req.user.role)){
            return res.status (403).json({message:"You do not have access",requestId:req.requestId});
        }

        next();
    };
};


module.exports=restrictTo;
