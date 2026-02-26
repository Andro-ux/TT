import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, BarChart2, PieChart as PieChartIcon, Loader2, Info, Ship } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI, Type } from "@google/genai";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface ChartData {
  name: string;
  value: number;
}

interface ChatResponse {
  answer: string;
  sql?: string;
  chart?: {
    type: 'bar' | 'pie' | 'line' | 'none';
    data: ChartData[];
    title: string;
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chart?: ChatResponse['chart'];
  sql?: string;
  timestamp: Date;
}

const SYSTEM_INSTRUCTION = `You are a data analysis assistant for the Titanic dataset.
The dataset is stored in a SQLite table named 'titanic' with the following columns:
- PassengerId (int)
- Survived (int: 0=No, 1=Yes)
- Pclass (int: 1, 2, 3)
- Name (text)
- Sex (text: male, female)
- Age (real)
- SibSp (int: # of siblings/spouses aboard)
- Parch (int: # of parents/children aboard)
- Ticket (text)
- Fare (real)
- Cabin (text)
- Embarked (text: C, Q, S)

Your goal is to answer the user's question by generating a SQL query.
You MUST return a JSON object with the following structure:
{
  "answer": "A friendly textual answer to the user's question.",
  "sql": "The SQL query used to get the data.",
  "chart": {
    "type": "bar" | "pie" | "line" | "none",
    "title": "Chart Title"
  }
}
If the user asks for a visualization, specify the chart type and title.
For histograms of age, group them into bins (e.g., 0-10, 10-20, etc.) in your SQL query.
Always be helpful and accurate.`;

export default function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your Titanic Data Assistant. I've been updated to run more reliably. Ask me anything about the Titanic dataset!",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      
      // We'll try to use the key even if it looks like a placeholder, 
      // as the platform might be injecting it in a way that build-time 'define' doesn't catch perfectly.
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: currentInput,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING },
              sql: { type: Type.STRING },
              chart: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  title: { type: Type.STRING }
                }
              }
            },
            required: ["answer", "sql"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      let chartData: ChartData[] = [];

      if (result.sql) {
        const queryResponse = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: result.sql }),
        });

        if (queryResponse.ok) {
          const { data } = await queryResponse.json();
          if (data && data.length > 0) {
            const keys = Object.keys(data[0]);
            if (keys.length >= 2) {
              chartData = data.map((row: any) => ({
                name: String(row[keys[0]]),
                value: Number(row[keys[1]])
              }));
            }
          }
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.answer,
        chart: result.chart?.type !== 'none' ? { ...result.chart, data: chartData } : undefined,
        sql: result.sql,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat Error Details:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I'm sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderChart = (chart: ChatResponse['chart']) => {
    if (!chart || chart.type === 'none' || !chart.data || chart.data.length === 0) return null;

    return (
      <div className="mt-4 p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-black/5 shadow-sm overflow-hidden">
        <h3 className="text-sm font-semibold mb-4 text-slate-800 flex items-center gap-2">
          {chart.type === 'bar' && <BarChart2 size={16} />}
          {chart.type === 'pie' && <PieChartIcon size={16} />}
          {chart.title}
        </h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chart.type === 'bar' ? (
              <BarChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chart.type === 'pie' ? (
              <PieChart>
                <Pie
                  data={chart.data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chart.data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            ) : (
              <LineChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Ship size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Titanic Insights AI</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Data Analysis Agent</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Info size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <div className="space-y-8">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4",
                  message.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                  message.role === 'user' ? "bg-slate-200 text-slate-600" : "bg-indigo-100 text-indigo-600"
                )}>
                  {message.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className={cn(
                  "max-w-[85%] space-y-2",
                  message.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "p-4 rounded-2xl shadow-sm",
                    message.role === 'user' 
                      ? "bg-indigo-600 text-white rounded-tr-none" 
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                  )}>
                    <div className="prose prose-slate prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                    {message.sql && (
                      <details className="mt-2 text-[10px] opacity-60 cursor-pointer hover:opacity-100 transition-opacity">
                        <summary className="font-mono">View SQL Query</summary>
                        <code className="block mt-1 p-2 bg-black/10 rounded font-mono break-all">
                          {message.sql}
                        </code>
                      </details>
                    )}
                  </div>
                  {message.chart && renderChart(message.chart)}
                  <span className="text-[10px] text-slate-400 px-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-indigo-600" />
                <span className="text-sm text-slate-500 font-medium">Analyzing dataset...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc] to-transparent pt-12 pb-6">
        <div className="max-w-4xl mx-auto px-4">
          <form 
            onSubmit={handleSubmit}
            className="relative bg-white rounded-2xl shadow-xl shadow-indigo-100 border border-slate-200 p-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the Titanic dataset..."
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-slate-800 placeholder:text-slate-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md shadow-indigo-200"
            >
              <Send size={20} />
            </button>
          </form>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {['Survival rate by class', 'Average age of survivors', 'Embarkation ports'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
