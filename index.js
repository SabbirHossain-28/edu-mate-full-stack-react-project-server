const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const verifyToken=(req,res,next)=>{
  if(!req.headers.authorization){
    return res.status(401).send({message:"Sorry,Unauthorized Access"})
  }
  const token= req.headers.authorization.split(" ")[1];
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({message:"Again Sorry! Unauthorized Access"});
    }
    req.decoded=decoded;
    next();
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7nkbk6a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("eduMateDB").collection("users");
    const applicationCollection = client
      .db("eduMateDB")
      .collection("applications");
    const classCollection = client.db("eduMateDB").collection("classes");
    const assignmentCollection = client
      .db("eduMateDB")
      .collection("assignments");

    app.post("/jwt", async (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "6h",
      });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden Access,This api is only for the Admin" });
      }
      next();
    };

    const verifyTeacher = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isTeacher = user?.role === "Teacher";
      if (!isTeacher) {
        return res.status(403).send({ message: "Forbidden Access,This api is only for the Teacher" });
      }
      next();
    };

    app.post("/users", async (req, res) => {
      const userData = req.body;
      const query = { email: userData.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return;
      }
      const result = await userCollection.insertOne(userData);
      res.send(result);
    });

    app.get("/users",verifyToken,verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      if (result) {
        res.send(result);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });

    app.patch("/users/admin/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateUserRole = {
        $set: {
          role: "Admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateUserRole);
      res.send(result);
    });

    app.post("/applications",verifyToken, async (req, res) => {
      const applicationData = req.body;
      const result = await applicationCollection.insertOne(applicationData);
      res.send(result);
    });

    app.get("/applications",verifyToken,verifyAdmin, async (req, res) => {
      const result = await applicationCollection.find().toArray();
      res.send(result);
    });

    app.get("/applications/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await applicationCollection
        .find(query, { projection: { status: 1, _id: 0 } })
        .toArray();
      res.send(result);
    });

    app.patch("/applications/approve/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateStatus = {
        $set: {
          status: "Approved",
        },
      };
      const result = await applicationCollection.updateOne(
        filter,
        updateStatus
      );
      if (result.modifiedCount > 0) {
        const application = await applicationCollection.findOne(filter);
        const filteredUser = {
          _id: ObjectId.createFromHexString(application.userId),
        };
        const updateUserRole = {
          $set: {
            role: "Teacher",
          },
        };
        await userCollection.updateOne(filteredUser, updateUserRole);
      }
      res.send(result);
    });

    app.patch("/applications/reject/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateStatus = {
        $set: {
          status: "Rejected",
        },
      };
      const result = await applicationCollection.updateOne(
        filter,
        updateStatus
      );
      res.send(result);
    });

    app.post("/classes",verifyToken,verifyTeacher, async (req, res) => {
      const classData = req.body;
      const result = await classCollection.insertOne(classData);
      res.send(result);
    });

    app.get("/classes",verifyToken,verifyAdmin, async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.get("/classes/:email",verifyToken,verifyTeacher, async (req, res) => {
      const email = req.params.email;
      console.log(email); 
      const query = { teacherEmail: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/class/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId.createFromHexString(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    });

    app.get("/allclasses/accepted", async (req, res) => {
      try {
        const query = { status: "Accepted" };
        const result = await classCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching accepted classes:", error);
        res.status(500).send({message:"Inter server error"})
      }
    });

    app.delete("/classes/:id",verifyToken,verifyTeacher, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/classes/:id",verifyToken,verifyTeacher, async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      console.log("helllllo", updateData);
      const filter = { _id: new ObjectId(id) };
      const updatedClassData = {
        $set: {
          ...updateData,
        },
      };
      const result = await classCollection.updateOne(filter, updatedClassData);
      res.send(result);
    });

    app.patch("/classes/approve/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateStatus = {
        $set: {
          status: "Accepted",
        },
      };
      const result = await classCollection.updateOne(filter, updateStatus);
      res.send(result);
    });

    app.patch("/classes/reject/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateStatus = {
        $set: {
          status: "Rejected",
        },
      };
      const result = await classCollection.updateOne(filter, updateStatus);
      res.send(result);
    });

    app.post("/assignments",verifyToken,verifyTeacher, async (req, res) => {
      const assignmentData = req.body;
      const classId = assignmentData.classId;
      try {
        const result = await assignmentCollection.insertOne(assignmentData);
        if (result.insertedId) {
          const filter = { _id: ObjectId.createFromHexString(classId) };
          const updateAssignmentCount = { $inc: { assignment: 1 } };
          await classCollection.updateOne(filter, updateAssignmentCount);
          res.send(result);
        } else {
          res
            .status(500)
            .send({ message: "Failed to increase assignment count" });
        }
      } catch (error) {
        console.error("Error creating assignment:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/assignments", async (req, res) => {
      const result = await assignmentCollection.find().toArray();
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("EduMate server is running perfectly");
});
app.listen(port, () => {
  console.log(`EduMate server is rinning or port:${port}`);
});
