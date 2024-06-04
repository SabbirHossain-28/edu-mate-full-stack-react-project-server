const express = require('express');
const app=express();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const port=process.env.PORT || 5000;

app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7nkbk6a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    
    app.post("/jwt",async(req,res)=>{
        const userInfo=req.body;
        const token=jwt.sign(userInfo,process.env.ACCESS_TOKEN_SECRET,{
            expiresIn:"6h",
        })
        res.send({token})
    })

    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/",(req,res)=>{
    res.send("EduMate server is running perfectly");
})
app.listen(port,()=>{
    console.log(`EduMate server is rinning or port:${port}`);
})