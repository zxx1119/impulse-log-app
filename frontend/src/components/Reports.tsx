import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import { 
  Description as DescriptionIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  CheckCircleOutline as CheckCircleOutlineIcon
} from '@mui/icons-material';
import axios from 'axios';

interface Report {
  id: number;
  week_start: string;
  week_end: string;
  content: string;
  created_at: string;
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/reports', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setReports(response.data);
    } catch (error) {
      showNotification('获取报告失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/reports/generate', {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      fetchReports();
      showNotification('报告生成成功', 'success');
    } catch (error) {
      showNotification('生成报告失败', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = (report: Report) => {
    const element = document.createElement('a');
    const file = new Blob([report.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `冲动日志报告_${report.week_start}_${report.week_end}.txt`;
    document.body.appendChild(element);
    element.click();
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
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <DescriptionIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
            <Typography variant="h4" component="h1">
              自动化报告
            </Typography>
          </Box>
          <Box>
            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={20} /> : <RefreshIcon />}
              onClick={generateReport}
              disabled={generating}
              sx={{ mr: 2 }}
            >
              生成新报告
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchReports}
              disabled={loading}
            >
              刷新
            </Button>
          </Box>
        </Box>
        
        <Typography variant="body1" color="text.secondary">
          系统会每周自动生成你的冲动管理报告，分析你的行为模式和进步情况。
          你也可以手动生成新的报告。
        </Typography>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : reports.length === 0 ? (
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary">
            暂无报告
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            点击"生成新报告"创建你的第一份冲动管理报告
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {reports.map((report) => (
            <Card key={report.id} elevation={3}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    {new Date(report.week_start).toLocaleDateString()} - {new Date(report.week_end).toLocaleDateString()}
                  </Typography>
                  <Box>
                    <Chip 
                      label={new Date(report.created_at).toLocaleDateString()} 
                      variant="outlined" 
                      size="small"
                    />
                    <Button
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => downloadReport(report)}
                      sx={{ ml: 1 }}
                    >
                      下载
                    </Button>
                  </Box>
                </Box>
                
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                  {report.content.split('\n').map((paragraph, index) => (
                    <Typography key={index} paragraph>
                      {paragraph}
                    </Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

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
