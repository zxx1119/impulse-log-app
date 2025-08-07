import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Card,
  CardContent,
  IconButton,
  Chip
} from '@mui/material';
import { 
  Send as SendIcon,
  SmartToy as SmartToyIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';

interface Message {
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      text: "你好！我是你的冲动管理AI助手。我可以帮助你分析情绪、提供应对策略，或者回答你关于冲动管理的问题。有什么我可以帮助你的吗？", 
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage: Message = {
      text: input,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const historyForAI = messages
        .filter(msg => msg.sender === 'user' || msg.sender === 'ai')
        .slice(-10) // 只发送最近10条消息作为上下文
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));
      
      const response = await axios.post('/api/chat', 
        { 
          message: input,
          history: historyForAI
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      const aiMessage: Message = {
        text: response.data.reply,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      showNotification('发送消息失败', 'error');
      setMessages(prev => prev.slice(0, -1)); // 移除最后一条用户消息
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      { 
        text: "你好！我是你的冲动管理AI助手。我可以帮助你分析情绪、提供应对策略，或者回答你关于冲动管理的问题。有什么我可以帮助你的吗？", 
        sender: 'ai',
        timestamp: new Date()
      }
    ]);
  };

  const showNotification = (message: string, severity: 'success' | 'error') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  return (
    <div>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <SmartToyIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            AI聊天助手
          </Typography>
        </Box>
        
        <Typography variant="body1" color="text.secondary">
          与AI助手交流，获取个性化建议和情绪支持。AI助手会基于你的冲动日志记录提供更有针对性的帮助。
        </Typography>
      </Paper>

      <Card elevation={3} sx={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {messages.map((message, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  mb: 1
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    maxWidth: '70%',
                    flexDirection: message.sender === 'user' ? 'row-reverse' : 'row'
                  }}
                >
                  <IconButton size="small" sx={{ mx: 1 }}>
                    {message.sender === 'user' ? <PersonIcon /> : <SmartToyIcon />}
                  </IconButton>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      backgroundColor: message.sender === 'user' ? 'primary.light' : 'grey.100',
                      color: message.sender === 'user' ? 'white' : 'text.primary',
                      borderRadius: message.sender === 'user' 
                        ? '20px 20px 4px 20px' 
                        : '20px 20px 20px 4px'
                    }}
                  >
                    <Typography variant="body1">{message.text}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7 }}>
                      {message.timestamp.toLocaleTimeString()}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            ))}
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1 }}>
                <SmartToyIcon color="primary" />
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">AI正在思考...</Typography>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>
        </CardContent>
        
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={clearChat}
            >
              清空对话
            </Button>
            <Chip 
              label={`对话记录: ${messages.length - 1}条`} 
              variant="outlined" 
              size="small"
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入你的问题或想法..."
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
              sx={{ alignSelf: 'flex-end' }}
            >
              <SendIcon />
            </Button>
          </Box>
        </Box>
      </Card>

      {/* 通知提示 */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
