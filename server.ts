import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize SQLite Database
let db: Database.Database;
try {
  db = new Database(":memory:");
  console.log("SQLite Database initialized in memory.");
} catch (err) {
  console.error("Failed to initialize SQLite:", err);
  process.exit(1);
}

// Load Titanic Data
try {
  const csvPath = path.resolve(process.cwd(), "titanic.csv");
  const csvData = fs.readFileSync(csvPath, "utf8");
  const parsed = Papa.parse(csvData, { header: true, dynamicTyping: true });

  db.exec(`
    CREATE TABLE titanic (
      PassengerId INTEGER PRIMARY KEY,
      Survived INTEGER,
      Pclass INTEGER,
      Name TEXT,
      Sex TEXT,
      Age REAL,
      SibSp INTEGER,
      Parch INTEGER,
      Ticket TEXT,
      Fare REAL,
      Cabin TEXT,
      Embarked TEXT
    )
  `);

  const insert = db.prepare(`
    INSERT INTO titanic (PassengerId, Survived, Pclass, Name, Sex, Age, SibSp, Parch, Ticket, Fare, Cabin, Embarked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of parsed.data as any[]) {
    if (row.PassengerId) {
      insert.run(
        row.PassengerId,
        row.Survived,
        row.Pclass,
        row.Name,
        row.Sex,
        row.Age,
        row.SibSp,
        row.Parch,
        row.Ticket,
        row.Fare,
        row.Cabin,
        row.Embarked
      );
    }
  }
  console.log("Titanic data loaded into SQLite.");
} catch (err) {
  console.error("Failed to load Titanic data:", err);
}

// Gemini API Setup
app.get("/api/health", (req, res) => {
  try {
    const count = db.prepare("SELECT COUNT(*) as count FROM titanic").get() as { count: number };
    res.json({ 
      status: "ok", 
      records: count.count,
      env: process.env.NODE_ENV,
      distExists: fs.existsSync(path.resolve(process.cwd(), "dist")),
      indexExists: fs.existsSync(path.resolve(process.cwd(), "dist", "index.html"))
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: (err as Error).message });
  }
});

app.post("/api/query", async (req, res) => {
  const { sql } = req.body;
  console.log("Executing SQL:", sql);

  try {
    if (!sql) {
      return res.status(400).json({ error: "No SQL query provided" });
    }

    // Basic security: only allow SELECT queries
    if (!sql.trim().toUpperCase().startsWith("SELECT")) {
      return res.status(403).json({ error: "Only SELECT queries are allowed" });
    }

    const rows = db.prepare(sql).all();
    res.json({ data: rows });
  } catch (error) {
    console.error("SQL Execution Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

async function startServer() {
  // Use dist if it exists, otherwise use Vite middleware
  const distPath = path.resolve(process.cwd(), "dist");
  if (fs.existsSync(distPath) && fs.existsSync(path.resolve(distPath, "index.html"))) {
    console.log("Serving production build from dist/");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    console.log("Starting in development mode with Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
