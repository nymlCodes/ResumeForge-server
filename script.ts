import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import Groq from "groq-sdk";

const uri = process.env.MONGO_URI as string;
const port = Number(process.env.PORT) || 5000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
if (!uri) {
  throw new Error("MONGO_URI environment variable is missing!");
}

const app = express();

app.use(cors());
app.use(express.json());

// Base Route
app.get("/", (req: Request, res: Response) => {
  res.send("ResumeForge server engine is running smoothly.");
});

// Setup MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // 1. Establish database connection first
    await client.connect();
    // await client.db("admin").command({ ping: 1 });
    // console.log("🚀 Pinged deployment. Successfully connected to MongoDB!");

    const db = client.db('ResumeForge');

    // Explicit Collection Definitions
    const resumeCollection = db.collection('resumes');
    const postCollection = db.collection('posts');

    // ============================================================
    // 2. REGISTER API ENDPOINTS (Before 404 Fallback handlers)
    // ============================================================


    await db.collection("user").updateMany(
      { emailVerified: false },
      { $set: { emailVerified: true } }
    );



    // Resumes POST Endpoint
    app.post("/api/resumes", async (req: Request, res: Response, next: NextFunction): Promise<any> => {
      try {
        const resumeData = {
          ...req.body,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        if (!resumeData.userId || !resumeData.fullName || !resumeData.email) {
          return res.status(400).json({
            message: "Validation failed. userId, fullName, and email are required fields for resumes."
          });
        }

        const result = await resumeCollection.insertOne(resumeData);

        return res.status(201).json({
          message: "Resume architecture successfully saved to cluster database.",
          insertedId: result.insertedId,
          resume: resumeData
        });
      } catch (error) {
        next(error);
      }
    });

    // Resumes GET Endpoint (all resumes)
    app.get(
      "/api/resumes",
      async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
          const {
            search = "",
            location = "",
            skill = "",
            page = "1",
            limit = "10",
          } = req.query as Record<string, string>;
          // console.log("Incoming query:", { search, location, skill, page, limit }); // <-- add this


          const pageNum = Math.max(parseInt(page, 10) || 1, 1);
          const limitNum = Math.max(parseInt(limit, 10) || 10, 1);

          const filter: Record<string, any> = {};

          // Free-text search across title, fullName, summary
          if (search.trim()) {
            const regex = new RegExp(search.trim(), "i");
            filter.$or = [
              { title: regex },
              { fullName: regex },
              { summary: regex },
              { email: regex },
            ];
          }

          // Location filter (partial match)
          if (location.trim()) {
            filter.location = new RegExp(location.trim(), "i");
          }

          // Skill filter (matches any skill in the array)
          // Skill filter (matches any skill in the array)
          if (skill.trim()) {
            filter.skills = new RegExp(skill.trim(), "i");
          }

          const total = await resumeCollection.countDocuments(filter);
          const totalPages = Math.max(Math.ceil(total / limitNum), 1);
          const safePage = Math.min(pageNum, totalPages);

          const resumes = await resumeCollection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((safePage - 1) * limitNum)
            .limit(limitNum)
            .toArray();

          return res.status(200).json({
            success: true,
            count: resumes.length,
            total,
            totalPages,
            page: safePage,
            limit: limitNum,
            resumes,
          });
        } catch (error) {
          next(error);
        }
      }
    );


    // Resumes GET Endpoint (only the current user's resumes)
    app.get(
      "/api/resumes/user/:userId",
      async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
          const { userId } = req.params;

          if (!userId) {
            return res.status(400).json({ message: "userId is required." });
          }

          const resumes = await resumeCollection
            .find({ userId })
            .sort({ createdAt: -1 })
            .toArray();

          return res.status(200).json({
            success: true,
            count: resumes.length,
            resumes,
          });
        } catch (error) {
          next(error);
        }
      }
    );


    // Resumes DELETE Endpoint
    app.delete(
      "/api/resumes/:id",
      async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
          const id = req.params.id as string;

          if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid resume id." });
          }

          const result = await resumeCollection.deleteOne({ _id: new ObjectId(id) });

          if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Resume not found." });
          }

          return res.status(200).json({
            success: true,
            message: "Resume deleted successfully.",
            deletedId: id,
          });
        } catch (error) {
          next(error);
        }
      }
    );



    // Posts GET Endpoint (single, by id)
    app.get("/api/posts/:id", async (req: Request, res: Response, next: NextFunction): Promise<any> => {
      try {
        const id = req.params.id as string;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid post id." });
        }

        const post = await resumeCollection.findOne({ _id: new ObjectId(id) });

        if (!post) {
          return res.status(404).json({ message: "Post not found." });
        }

        return res.status(200).json({ success: true, post });
      } catch (error) {
        next(error);
      }
    }
    );
    // Resumes GET Endpoint (single, by id)
    app.get(
      "/api/resumes/:id",
      async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
          const id = req.params.id as string;

          if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid resume id." });
          }

          const resume = await resumeCollection.findOne({ _id: new ObjectId(id) });

          if (!resume) {
            return res.status(404).json({ message: "Resume not found." });
          }

          return res.status(200).json({ success: true, resume });
        } catch (error) {
          next(error);
        }
      }
    );

    // AI Suggestions Endpoint (Groq) — for resumes
    app.post(
      "/api/resumes/:id/ai-suggestions",
      async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
          const id = req.params.id as string;

          if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid resume id." });
          }

          const resume = await resumeCollection.findOne({ _id: new ObjectId(id) });

          if (!resume) {
            return res.status(404).json({ message: "Resume not found." });
          }

          const prompt = `You are an expert career coach and resume reviewer. Review the following resume and provide 3-5 concrete, actionable suggestions to improve it (impact, clarity, keyword targeting, formatting of bullet points, missing sections). Respond ONLY as a numbered list, no preamble.

Full Name: ${resume.fullName}
Location: ${resume.location}
Summary: ${resume.summary}
Skills: ${Array.isArray(resume.skills) ? resume.skills.join(", ") : resume.skills}
Experience: ${JSON.stringify(resume.experience, null, 2)}
Education: ${JSON.stringify(resume.education, null, 2)}`;

          const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            max_tokens: 700,
          });

          const suggestions = completion.choices[0]?.message?.content ?? "";

          return res.status(200).json({
            success: true,
            resumeId: id,
            suggestions,
          });
        } catch (error) {
          next(error);
        }
      }
    );






    // Chat Endpoint (Groq) — conversational Q&A about a resume
    app.post(
      "/api/resumes/:id/chat",
      async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
          const id = req.params.id as string;
          const { message, history } = req.body as {
            message: string;
            history?: { role: "user" | "assistant"; content: string }[];
          };

          if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid resume id." });
          }

          if (!message || !message.trim()) {
            return res.status(400).json({ message: "message is required." });
          }

          const resume = await resumeCollection.findOne({ _id: new ObjectId(id) });

          if (!resume) {
            return res.status(404).json({ message: "Resume not found." });
          }

          const systemPrompt = `You are a helpful assistant answering questions about a specific resume/candidate. Only use the information below — if something isn't covered, say you don't have that information rather than guessing. Keep answers concise and conversational.

Full Name: ${resume.fullName}
Title: ${resume.title}
Location: ${resume.location}
Email: ${resume.email}
Phone: ${resume.phoneNumber}
Website: ${resume.website ?? "N/A"}
Summary: ${resume.summary}
Skills: ${Array.isArray(resume.skills) ? resume.skills.join(", ") : resume.skills}
Experience: ${JSON.stringify(resume.experience, null, 2)}
Education: ${JSON.stringify(resume.education, null, 2)}`;

          const messages = [
            { role: "system" as const, content: systemPrompt },
            ...(history ?? []).slice(-10), // keep last 10 turns to bound token usage
            { role: "user" as const, content: message },
          ];

          const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: 0.5,
            max_tokens: 500,
          });

          const reply = completion.choices[0]?.message?.content ?? "";

          return res.status(200).json({ success: true, reply });
        } catch (error) {
          next(error);
        }
      }
    );

    // Resumes GET Endpoint (single, by id) — useful for a detail page later
    // app.get(
    //   "/api/resumes/:id",
    //   async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    //     try {
    //       const { id } = req.params;

    //       if (!ObjectId.isValid(id)) {
    //         return res.status(400).json({ message: "Invalid resume id." });
    //       }

    //       const resume = await resumeCollection.findOne({ _id: new ObjectId(id) });

    //       if (!resume) {
    //         return res.status(404).json({ message: "Resume not found." });
    //       }

    //       return res.status(200).json({ success: true, resume });
    //     } catch (error) {
    //       next(error);
    //     }
    //   }
    // );

    // Posts POST Endpoint
    app.post("/api/posts", async (req: Request, res: Response, next: NextFunction): Promise<any> => {
      try {
        const postData = {
          ...req.body,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        if (!postData.userId || !postData.title || !postData.content) {
          return res.status(400).json({
            message: "Validation failed. userId, title, and content are required fields for posts."
          });
        }

        const result = await postCollection.insertOne(postData);

        return res.status(201).json({
          message: "Post asset successfully mapped and saved.",
          insertedId: result.insertedId,
          post: postData
        });
      } catch (error) {
        next(error);
      }
    });

    // Posts GET Endpoint
    app.get(
      "/api/posts",
      async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
          const posts = await postCollection
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

          return res.status(200).json({
            success: true,
            count: posts.length,
            posts,
          });
        } catch (error) {
          next(error);
        }
      }
    );

    // ============================================================
    // 3. REGISTER GLOBAL MIDDLEWARE PIPELINE ROUTING
    // ============================================================

    // Catch-all 404 Router (Must execute after custom endpoint matchers)
    app.use((req: Request, res: Response) => {
      res.status(404).json({ message: "Requested operational route fallback not found." });
    });

    // Global Error Boundary Middleware Handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error("💥 Server Core Exception Captured:", err.stack);
      res.status(500).json({
        message: "Internal runtime process error experienced.",
        error: err.message
      });
    });

    // ============================================================
    // 4. BIND LISTEN ENGINE INTERFACE
    // ============================================================
    app.listen(port, () => {
      // console.log(`Server executing live on node pipeline: http://localhost:${port}`);
    });

  } catch (initError) {
    // console.error("Fatal Cluster Initializer Abort:", initError);
    // process.exit(1);
  }
}

// Global process monitoring loop for graceful cleanup shutdowns
process.on("SIGINT", async () => {
  // console.log("\nIntercepted termination vector. Disconnecting driver gracefully...");
  // await client.close();
  // process.exit(0);
});

// Fire connection lifecycle entrypoint
run().catch(console.dir);