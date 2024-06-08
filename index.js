const express = require('express');
const app=express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const userCollection=client.db("eduMateDB").collection("users");
    const applicationCollection=client.db("eduMateDB").collection("applications")
    
    app.post("/jwt",async(req,res)=>{
        const userInfo=req.body;
        const token=jwt.sign(userInfo,process.env.ACCESS_TOKEN_SECRET,{
            expiresIn:"6h",
        })
        res.send({token})
    })

    app.post("/users",async(req,res)=>{
        const userData=req.body;
        const query={email:userData.email};
        const existingUser=await userCollection.findOne(query);
        if(existingUser){
            return
        }
        const result=await userCollection.insertOne(userData);
        res.send(result);
    })

    app.get("/users",async(req,res)=>{
        const result=await userCollection.find().toArray();
        res.send(result);
    })

    app.get("/users/:email",async(req,res)=>{
      const email=req.params.email;
      const query={email:email};
      const result=await userCollection.findOne(query);
      if(result){
        res.send(result);
      }
      else{
        res.status(404).send({ message: "User not found" });
      }
    })

    app.patch("/users/admin/:id",async(req,res)=>{
      const id=req.params.id;
      const filter={_id:new ObjectId(id)};
      const updateUserRole={
        $set:{
          role:"Admin",
        }
      }
      const result=await userCollection.updateOne(filter,updateUserRole);
      res.send(result);
    })

    app.post("/applications",async(req,res)=>{
      const applicationData=req.body;
      const result=await applicationCollection.insertOne(applicationData);
      res.send(result);
    })

    app.get("/applications",async(req,res)=>{
      const result=await applicationCollection.find().toArray();
      res.send(result);
    })

    app.patch("/applications/approve/:id",async(req,res)=>{
      const id=req.params.id;
      const filter={_id: new ObjectId(id)};
      const updateStatus={
        $set:{
          status:"Approved",
        }
      }
      const result=await applicationCollection.updateOne(filter,updateStatus);
      if(result.modifiedCount>0){
        const application=await applicationCollection.findOne(filter);
        const filteredUser={_id:ObjectId.createFromHexString(application.userId)};
        const updateUserRole={
          $set:{
            role:"Teacher"
          }
        };
        await userCollection.updateOne(filteredUser,updateUserRole)
      }
      res.send(result)
    })

    app.patch("/applications/reject/:id",async(req,res)=>{
      const id=req.params.id;
      const filter={_id:new ObjectId(id)};
      const updateStatus={
        $set:{
          status:"Rejected",
        }
      };
      const result=await applicationCollection.updateOne(filter,updateStatus);
      res.send(result);
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