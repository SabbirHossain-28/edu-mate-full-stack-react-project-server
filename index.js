const express = require('express');
const app=express();
const cors = require('cors');
require("dotenv").config();
const port=process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/",(req,res)=>{
    res.send("EduMate server is running perfectly");
})
app.listen(port,()=>{
    console.log(`EduMate server is rinning or port:${port}`);
})