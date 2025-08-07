import React, { useEffect, useState } from 'react';
import {
  Paper,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

interface LogEntry {
  id: number;
  datetime: string;
  feeling: string;
  acted: string;
  created_at: string;
}

interface EmotionAnalysis {
  primaryEmotion: string;
  intensity: number;
  triggers: string[];
  copingStrategies: string[];
}

export default function Dashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    datetime: new Date().toISOString().slice(0, 16),
    feeling: '',
    acted: 'no'
  });
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const [aiAnalysis, setAiAnalysis] = useState<EmotionAnalysis | null>(null);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/logs', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setLogs(response.data);
    } catch (error) {
      showNotification('获取数据失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/logs', formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setFormData({
        datetime: new Date().toISOString().slice(0, 16),
        feeling: '',
        acted: 'no'
      });
      fetchLogs();
      showNotification('记录保存成功', 'success');
    } catch (error) {
      showNotification('保存失败', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/logs/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      fetchLogs();
      showNotification('记录已删除', 'success');
    } catch (error) {
      showNotification('删除失败', 'error');
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('确定要清空所有记录吗？此操作不可恢复！')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete('/api/logs', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        fetchLogs();
        showNotification('所有记录已清空', 'success');
      } catch (error) {
        showNotification('清空失败', 'error');
      }
    }
  };

  const analyzeEmotion = async () => {
    if (!formData.feeling.trim()) {
      showNotification('请先填写情绪描述', 'error');
      return;
    }

    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/analyze-emotion', 
        { feeling: formData.feeling },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      setAiAnalysis(response.data);
      setAnalysisDialogOpen(true);
    } catch (error) {
      showNotification('情绪分析失败', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const showNotification = (message: string, severity: 'success' | 'error') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  // 统计数据
  const totalLogs = logs.length;
  const actedLogs = logs.filter(log => log.acted === 'yes').length;
  const resistedLogs = totalLogs - actedLogs;
  const resistRate = totalLogs > 0 ? Math.round((resistedLogs / totalLogs) * 100) : 0;

  // 趋势数据准备
  const trendData = logs.reduce((acc: any[], log) => {
    const date = log.datetime.split('T')[0];
    const existing = acc.find(item => item.date === date);
    
    if (existing) {
      existing.total++;
      if (log.acted === 'no') existing.resisted++;
    } else {
      acc.push({ date, total: 1, resisted: log.acted === 'no' ? 1 : 0 });
    }
    
    return acc;
  }, []).map(item => ({
    date: item.date,
    抵抗率: Math.round((item.resisted / item.total) * 100)
  })).slice(-7);

  return (
    <div>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <TrendingUpIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            冲动日志
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  总记录数
                </Typography>
                <Typography variant="h5">
                  {totalLogs}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  行动次数
                </Typography>
                <Typography variant="h5" color="error">
                  {actedLogs}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  抵抗次数
                </Typography>
                <Typography variant="h5" color="success.main">
                  {resistedLogs}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  抵抗成功率
                </Typography>
                <Typography variant="h5" color="primary">
                  {resistRate}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          记录新冲动
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="日期和时间"
                type="datetime-local"
                value={formData.datetime}
                onChange={(e) => setFormData({...formData, datetime: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl component="fieldset">
                <FormLabel component="legend">是否最终行动了？</FormLabel>
                <RadioGroup
                  row
                  value={formData.acted}
                  onChange={(e) => setFormData({...formData, acted: e.target.value})}
                >
                  <FormControlLabel value="yes" control={<Radio />} label="是，我行动了" />
                  <FormControlLabel value="no" control={<Radio />} label="否，我抵抗住了" />
                </RadioGroup>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="当时的感觉"
                multiline
                rows={3}
                value={formData.feeling}
                onChange={(e) => setFormData({...formData, feeling: e.target.value})}
                placeholder="描述你当时的情绪和想法..."
              />
            </Grid>
            
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ mr: 2 }}
              >
                保存记录
              </Button>
              <Button
                variant="outlined"
                startIcon={<PsychologyIcon />}
                onClick={analyzeEmotion}
                disabled={analyzing}
                sx={{ mr: 2 }}
              >
                {analyzing ? <CircularProgress size={20} /> : 'AI情绪分析'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchLogs}
              >
                刷新数据
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {trendData.length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            抵抗成功率趋势 (最近7天)
          </Typography>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, '抵抗率']} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="抵抗率" 
                  stroke="#8884d8" 
                  activeDot={{ r: 8 }} 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      )}

      <Paper elevation={3} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            冲动记录历史
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleClearAll}
          >
            清空记录
          </Button>
        </Box>
        
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : logs.length === 0 ? (
          <Box textAlign="center" p={4}>
            <Typography color="textSecondary">
              暂无记录，开始记录你的第一个冲动时刻吧！
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>日期时间</TableCell>
                  <TableCell>当时的感觉</TableCell>
                  <TableCell>是否行动</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.datetime).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>{log.feeling}</TableCell>
                    <TableCell>
                      <Chip
                        icon={log.acted === 'yes' ? <CancelIcon /> : <CheckCircleIcon />}
                        label={log.acted === 'yes' ? '行动了' : '抵抗住了'}
                        color={log.acted === 'yes' ? 'error' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        color="error"
                        onClick={() => handleDelete(log.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* AI情绪分析对话框 */}
      <Dialog
        open={analysisDialogOpen}
        onClose={() => setAnalysisDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>AI情绪分析结果</DialogTitle>
        <DialogContent>
          {aiAnalysis && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6">主要情绪</Typography>
                    <Typography variant="body1">{aiAnalysis.primaryEmotion}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6">强度</Typography>
                    <Typography variant="body1">{aiAnalysis.intensity}/10</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6">触发因素</Typography>
                    <ul>
                      {aiAnalysis.triggers.map((trigger, index) => (
                        <li key={index}>{trigger}</li>
                      ))}
                    </ul>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6">应对策略</Typography>
                    <ul>
                      {aiAnalysis.copingStrategies.map((strategy, index) => (
                        <li key={index}>{strategy}</li>
                      ))}
                    </ul>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAnalysisDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

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
