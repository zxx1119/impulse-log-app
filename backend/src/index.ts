import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import OpenAI from 'openai';
import cron from 'node-cron';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 安全中间件
app.use(helmet());
app.use(cors());
app.use(express.json());

// 限流配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// OpenAI配置
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
  dangerouslyAllowBrowser: false,
});

// 数据库连接
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 连接池错误处理
pool.on('error', (err) => {
  console.error('数据库连接池错误:', err);
});

// 密码验证中间件
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
};

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 数据库健康检查
app.get('/health/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({ 
      status: 'OK', 
      timestamp: result.rows[0].now,
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Database connection failed'
    });
  }
});

// 初始化数据库表
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS impulse_logs (
        id SERIAL PRIMARY KEY,
        datetime TIMESTAMP NOT NULL,
        feeling TEXT NOT NULL,
        acted VARCHAR(10) NOT NULL CHECK (acted IN ('yes', 'no')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建默认用户
    const defaultUser = process.env.DEFAULT_USERNAME || 'admin';
    const defaultPassword = process.env.DEFAULT_PASSWORD || 'admin123';
    
    const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [defaultUser]);
    
    if (userExists.rows.length === 0) {
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      await pool.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
        [defaultUser, passwordHash]
      );
      console.log(`默认用户已创建: ${defaultUser}`);
    }
  } catch (error) {
    console.error('数据库初始化错误:', error);
  }
}

// 认证路由
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );
    
    res.json({ token, username: user.username });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// API路由 - 需要认证
app.get('/api/logs', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM impulse_logs ORDER BY datetime DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '数据库错误' });
  }
});

app.post('/api/logs', authenticate, async (req, res) => {
  const { datetime, feeling, acted } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO impulse_logs (datetime, feeling, acted) VALUES ($1, $2, $3) RETURNING *',
      [datetime, feeling, acted]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '数据库错误' });
  }
});

app.delete('/api/logs/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM impulse_logs WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '数据库错误' });
  }
});

app.delete('/api/logs', authenticate, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE impulse_logs RESTART IDENTITY');
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 情绪分析路由
app.post('/api/analyze-emotion', authenticate, async (req, res) => {
  const { feeling } = req.body;
  
  if (!feeling || feeling.trim() === '') {
    return res.status(400).json({ error: '请提供情绪描述' });
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "你是一个情绪分析专家。分析以下文本，返回JSON格式的情绪分析：{\"primaryEmotion\": \"主要情绪\",\"intensity\": 1-10的强度值,\"triggers\": [\"触发因素1\", \"触发因素2\"],\"copingStrategies\": [\"建议1\", \"建议2\"]}"
        },
        {
          role: "user",
          content: feeling
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });
    
    const analysisText = response.choices[0].message.content;
    let analysis;
    
    try {
      analysis = JSON.parse(analysisText || '{}');
    } catch (parseError) {
      analysis = {
        primaryEmotion: "未知",
        intensity: 5,
        triggers: ["无法确定"],
        copingStrategies: ["深呼吸", "寻求支持"]
      };
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('情绪分析错误:', error);
    res.status(500).json({ error: '情绪分析服务暂时不可用' });
  }
});

// AI聊天助手路由
app.post('/api/chat', authenticate, async (req, res) => {
  const { message, history } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: '请提供消息内容' });
  }
  
  try {
    // 获取用户最近7天的冲动记录作为上下文
    const contextResult = await pool.query(`
      SELECT datetime, feeling, acted 
      FROM impulse_logs 
      WHERE datetime >= NOW() - INTERVAL '7 days'
      ORDER BY datetime DESC
      LIMIT 10
    `);
    
    const context = contextResult.rows.map(log => 
      `${log.datetime}: ${log.feeling} (行动: ${log.acted === 'yes' ? '是' : '否'})`
    ).join('\n');
    
    const messages = [
      {
        role: "system",
        content: `你是一个心理健康助手，专门帮助用户管理冲动行为。以下是用户最近7天的冲动记录作为上下文：\n${context}\n\n请基于这些信息，以专业、同理心的态度回答用户的问题。`
      }
    ];
    
    // 添加历史对话
    if (history && Array.isArray(history)) {
      messages.push(...history);
    }
    
    // 添加当前消息
    messages.push({
      role: "user",
      content: message
    });
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: messages as any,
      max_tokens: 500,
      temperature: 0.7,
    });
    
    const reply = response.choices[0].message.content || "抱歉，我暂时无法回答这个问题。";
    
    res.json({ reply });
  } catch (error) {
    console.error('AI聊天错误:', error);
    res.status(500).json({ error: 'AI聊天服务暂时不可用' });
  }
});

// 报告相关路由
app.get('/api/reports', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '数据库错误' });
  }
});

app.get('/api/reports/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '报告未找到' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '数据库错误' });
  }
});

app.post('/api/reports/generate', authenticate, async (req, res) => {
  try {
    // 获取最近7天的数据
    const weekEnd = new Date();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    
    const result = await pool.query(`
      SELECT datetime, feeling, acted 
      FROM impulse_logs 
      WHERE datetime BETWEEN $1 AND $2
      ORDER BY datetime
    `, [weekStart, weekEnd]);
    
    const logs = result.rows;
    
    if (logs.length === 0) {
      return res.status(400).json({ error: '没有足够的数据生成报告' });
    }
    
    // 统计数据
    const totalImpulses = logs.length;
    const actedImpulses = logs.filter(log => log.acted === 'yes').length;
    const resistedImpulses = totalImpulses - actedImpulses;
    const resistanceRate = Math.round((resistedImpulses / totalImpulses) * 100);
    
    // 按小时统计
    const hourlyStats = new Array(24).fill(0);
    logs.forEach(log => {
      const hour = new Date(log.datetime).getHours();
      hourlyStats[hour]++;
    });
    
    const peakHour = hourlyStats.indexOf(Math.max(...hourlyStats));
    
    // 情绪关键词统计
    const emotionWords: Record<string, number> = {};
    logs.forEach(log => {
      const words = log.feeling.toLowerCase().split(/\s+/);
      words.forEach(word => {
        emotionWords[word] = (emotionWords[word] || 0) + 1;
      });
    });
    
    const topEmotions = Object.entries(emotionWords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);
    
    // 生成AI洞察
    const context = `
      冲动日志数据（${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}）:
      - 总冲动次数: ${totalImpulses}
      - 行动次数: ${actedImpulses}
      - 抵抗次数: ${resistedImpulses}
      - 抵抗成功率: ${resistanceRate}%
      - 高发时段: ${peakHour}:00
      - 主要情绪: ${topEmotions.join(', ')}
    `;
    
    const aiResponse = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `你是一个心理健康分析师。基于以下冲动日志数据生成周报，包含：
          1. 本周冲动模式分析
          2. 进步和挑战
          3. 具体改进建议
          4. 下周目标设定
          
          请以专业、同理心的语气撰写，鼓励用户继续努力。`
        },
        {
          role: "user",
          content: context
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });
    
    const insights = aiResponse.choices[0].message.content || "无法生成洞察";
    
    // 保存报告到数据库
    const reportResult = await pool.query(`
      INSERT INTO reports (week_start, week_end, content) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `, [weekStart, weekEnd, insights]);
    
    res.status(201).json(reportResult.rows[0]);
  } catch (error) {
    console.error('生成报告错误:', error);
    res.status(500).json({ error: '生成报告失败' });
  }
});

// 全局错误处理中间件
app.use((err: any, req: any, res: any, next: any) => {
  console.error('全局错误:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
  
  res.status(500).json({ error: '服务器内部错误' });
});

// 未捕获的Promise异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

// 未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
  initializeDatabase();
});

// 优雅关闭
process.on('SIGINT', async () => {
  await pool.end();
  process.exit();
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit();
});
