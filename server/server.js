const express=require('express');
const path=require('path');

const dotenv=require('dotenv');
const cors=require('cors');
const connectDb=require('./config/db');

const authRoutes=require('./routes/authRouter');
const jobRoutes=require('./routes/jobRoute');
const paymentRoutes=require('./routes/paymentRoute');
const pricingRoutes=require('./routes/pricingRoute');
const jobAlertRoutes=require('./routes/jobAlertRoute');
const { initScheduler }=require('./utils/jobAlertScheduler');

dotenv.config();

const app=express();

app.use(cors());
app.use(express.json({
    verify:(req,res,buf)=>{
        req.rawBody=buf.toString();
    }
}));
connectDb();
initScheduler();

app.get('/',(req,res)=>{
    res.send("Job's Parlour API is running" );
});

app.use('/api/auth',authRoutes);

app.use('/api/jobs',jobRoutes);

app.use('/api/payments',paymentRoutes);

app.use('/api/pricing',pricingRoutes);

app.use('/api/job-alerts',jobAlertRoutes);

const clientDistPath=path.join(__dirname,'public');
app.use(express.static(clientDistPath));

app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientDistPath,'index.html'));
});

const PORT=process.env.PORT||5000;

app.listen(PORT,()=>{
    console.log(`Server running on PORT:${PORT} `)
})
