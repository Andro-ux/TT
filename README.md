# Titanic Insights AI 🚢

A powerful data analysis agent for the Titanic dataset. Ask questions in natural language and get instant insights with interactive visualizations.

## Features
- **Natural Language Querying**: Ask questions like "What was the survival rate of first-class passengers?"
- **Interactive Charts**: Automatically generates Bar, Pie, and Line charts based on data.
- **Full-Stack Architecture**: Powered by an Express backend with a SQLite in-memory database.
- **AI-Driven Analysis**: Uses Gemini to translate English into SQL queries and data summaries.

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your `GEMINI_API_KEY` in a `.env` file.

### Running the App
Start the development server:
```bash
npm run dev
```

## Dataset
The application uses a curated subset of the Titanic passenger list, including information on survival, class, age, sex, and more.
