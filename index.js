const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY_SERVER);

app.use(express.json());
app.use(cors());

const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Sorry,Unauthorized Access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ message: "Again Sorry! Unauthorized Access" });
    }
    console.log(decoded);
    req.decoded = decoded;
    next();
  });
};

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
    const enrolledClassCollection = client
      .db("eduMateDB")
      .collection("enrolledClass");
    const submittedAssignmentCollection = client
      .db("eduMateDB")
      .collection("submittedAssignments");
    const feedbackCollection = client.db("eduMateDB").collection("feedbacks");

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
        return res
          .status(403)
          .send({ message: "Forbidden Access,This api is only for the Admin" });
      }
      next();
    };

    const verifyTeacher = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isTeacher = user?.role === "Teacher";
      if (!isTeacher) {
        return res.status(403).send({
          message: "Forbidden Access,This api is only for the Teacher",
        });
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

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const search = req.query.search;
      let query = {
        $or: [
          { name: { $regex: new RegExp(search, "i") } },
          { email: { $regex: new RegExp(search, "i") } },
        ],
      };
      const result = await userCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/countedUsers",verifyToken,verifyAdmin, async (req, res) => {
      const search = req.query.search;
      let query = {
        $or: [
          { name: { $regex: new RegExp(search, "i") } },
          { email: { $regex: new RegExp(search, "i") } },
        ],
      };
      // console.log(query);
      const result = await userCollection.countDocuments(query);
      res.send({ result });
    });

    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      if (result) {
        res.send(result);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateUserRole = {
          $set: {
            role: "Admin",
          },
        };
        const result = await userCollection.updateOne(filter, updateUserRole);
        res.send(result);
      }
    );

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let Admin = false;
      if (user) {
        Admin = user?.role === "Admin";
      }
      console.log(Admin);
      res.send({ Admin });
    });

    // app.get("/user/teacher/:email",verifyToken,async(req,res)=>{
    //   const email=req.params.email;
    //   console.log(email);
    //   if(email !== req.decoded.email){
    //     return res.status(403).send({message:"Forbidden Access"});
    //   }
    //   const query={email:email};
    //   const user=await userCollection.findOne(query);
    //   console.log(user);
    //   let Teacher=false;
    //   if(user){
    //     Teacher=user?.role==="Teacher";
    //   }
    //   console.log(Teacher);
    //   res.send({Teacher})
    // })

    app.post("/applications", verifyToken, async (req, res) => {
      const applicationData = req.body;
      const result = await applicationCollection.insertOne(applicationData);
      res.send(result);
    });

    app.get("/applications", verifyToken, verifyAdmin, async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const result = await applicationCollection.find().skip(page * size).limit(size).toArray();
      res.send(result);
    });

    app.get("/applications/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await applicationCollection
        .find(query, { projection: { status: 1, _id: 0 } })
        .toArray();
      res.send(result);
    });

    app.patch(
      "/applications/approve/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    app.patch(
      "/applications/reject/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    app.get("/countedApplications",verifyToken,verifyAdmin,async(req,res)=>{
      const result=await applicationCollection.countDocuments();
      res.send({result})
    })

    app.post("/classes", verifyToken, verifyTeacher, async (req, res) => {
      const classData = req.body;
      const result = await classCollection.insertOne(classData);
      res.send(result);
    });

    app.get("/classes", verifyToken, verifyAdmin, async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const result = await classCollection.find().skip(page * size).limit(size  ).toArray();
      res.send(result);
    });

    app.get("/countedClass",verifyToken,verifyAdmin,async(req,res)=>{
      const result=await classCollection.countDocuments();
      res.send({result});
    })

    app.get("/classes/:email", verifyToken, async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const email = req.params.email;
      console.log(email);
      const query = { teacherEmail: email };
      const result = await classCollection.find(query).skip(page * size).limit(size).toArray();
      res.send(result);
    });

    app.get("/teacherCountedClass/:email",verifyToken,verifyTeacher,async(req,res)=>{
      const email=req.params.email;
      const query={teacherEmail:email};
      const result=await classCollection.countDocuments(query);
      res.send({result});
    })

    app.get("/class/:id", verifyToken, async (req, res) => {
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
        res.status(500).send({ message: "Inter server error" });
      }
    });

    app.delete("/classes/:id", verifyToken, verifyTeacher, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/classes/:id", verifyToken, verifyTeacher, async (req, res) => {
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

    app.patch(
      "/classes/approve/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateStatus = {
          $set: {
            status: "Accepted",
          },
        };
        const result = await classCollection.updateOne(filter, updateStatus);
        res.send(result);
      }
    );

    app.patch(
      "/classes/reject/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateStatus = {
          $set: {
            status: "Rejected",
          },
        };
        const result = await classCollection.updateOne(filter, updateStatus);
        res.send(result);
      }
    );

    app.get("/all-classes/max-enrollment", async (req, res) => {
      try {
        const result = await classCollection
          .find()
          .sort({ totalEnrollment: -1 })
          .limit(6)
          .toArray();
        if (result.length > 0) {
          res.send(result);
        } else {
          res.status(404).send({ message: "No classes found" });
        }
      } catch (error) {
        console.error("Error fetching class with maximum enrollment:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/enrolledClass", verifyToken, async (req, res) => {
      const enrolledClassData = req.body;
      const classId = enrolledClassData.classId;
      try {
        const result = await enrolledClassCollection.insertOne(
          enrolledClassData
        );
        if (result.insertedId) {
          const filter = { _id: ObjectId.createFromHexString(classId) };
          const updateEnrollCount = { $inc: { totalEnrollment: 1 } };
          await classCollection.updateOne(filter, updateEnrollCount);
          res.send(result);
        } else {
          res.status(500).send({ message: "Faild to increase enrollment" });
        }
      } catch (error) {
        console.error("Error creating assignment:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/enrolledClass",verifyToken, async (req, res) => {
      const result = await enrolledClassCollection.find().toArray();
      res.send(result);
    });

    app.get("/enrolledClass/:email", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const email = req.params.email;
      const query = { studentEmail: email };
      const result = await enrolledClassCollection.find(query).skip(page * size).limit(size).toArray();
      res.send(result);
    });

    app.get("/countedEnrolledClass/:email",async(req,res)=>{
      const email=req.params.email;
      const query={studentEmail:email}
      const result=await enrolledClassCollection.countDocuments(query);
      console.log(result);
      res.send({result});
    })

    app.get("/enrolledClassAssignment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await enrolledClassCollection.findOne(query, {
        projection: { classId: 1, classTitle: 1, _id: 0 },
      });
      res.send(result);
    });

    app.post("/assignments", verifyToken, verifyTeacher, async (req, res) => {
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

    app.get("/assignments/:id", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const id = req.params.id;
      console.log(id);
      const query = { classId: id };
      const result = await assignmentCollection.find(query).skip(page * size).limit(size).toArray();
      res.send(result);
    });

    app.get("/countedAssignments/:id",async(req,res)=>{
      const id=req.params.id;
      const query={classId:id};
      const result=await assignmentCollection.countDocuments(query);
      res.send({result});
    })

    app.post("/submittedAssignment", async (req, res) => {
      const submittedAssignmentData = req.body;
      const classId = submittedAssignmentData.classId;
      try {
        const result = await submittedAssignmentCollection.insertOne(
          submittedAssignmentData
        );
        if (result.insertedId) {
          const filter = { _id: ObjectId.createFromHexString(classId) };
          const updateAssignmentSubmissionCount = {
            $inc: { totalAssignmentSubmission: 1 },
          };
          await classCollection.updateOne(
            filter,
            updateAssignmentSubmissionCount
          );
          res.send(result);
        } else {
          res.status(500).send({
            message: "Failed to increase total assignment submission count",
          });
        }
      } catch (error) {
        console.error("Error submitting assignment:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/submittedAssignment/:email", async (req, res) => {
      const email = req.params.email;
      const query = { studentEmail: email };
      const result = await submittedAssignmentCollection
        .find(query, { projection: { assignmentId: 1, _id: 0 } })
        .toArray();
      res.send(result);
    });

    app.post("/feedbacks", async (req, res) => {
      const feedbacksData = req.body;
      const result = await feedbackCollection.insertOne(feedbacksData);
      res.send(result);
    });

    app.get("/allFeedbacks", async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    });
    app.get("/feedbacks/:id", async (req, res) => {
      const classId = req.params.id;
      const query = { classId: classId };
      const result = await feedbackCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/stats", async (req, res) => {
      try {
        const totalUsersPipeline = [
          { $group: { _id: null, count: { $sum: 1 } } },
        ];
        const totalClassesPipeline = [
          { $match: { status: "Accepted" } },
          { $group: { _id: null, count: { $sum: 1 } } },
        ];
        const totalEnrollmentsPipeline = [
          { $group: { _id: null, count: { $sum: 1 } } },
        ];
        const [totalUsers, totalClasses, totalEnrollments] = await Promise.all([
          userCollection.aggregate(totalUsersPipeline).toArray(),
          classCollection.aggregate(totalClassesPipeline).toArray(),
          enrolledClassCollection.aggregate(totalEnrollmentsPipeline).toArray(),
        ]);
        res.send({
          totalUsers: totalUsers[0]?.count || 0,
          totalClasses: totalClasses[0]?.count || 0,
          totalEnrollments: totalEnrollments[0]?.count || 0,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch" });
      }
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
