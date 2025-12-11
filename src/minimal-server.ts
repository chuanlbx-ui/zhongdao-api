#!/usr/bin/env node

/**
 * 最小化服务器 - 用于快速测试
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

// 基础中间件
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:5173'],
    credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 日志中间件
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// 健康检查
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0-minimal'
    });
});

// API路由
app.get('/api/v1/test', (req, res) => {
    res.json({
        success: true,
        message: 'API服务正常运行',
        timestamp: new Date().toISOString()
    });
});

// 公共API - 商品列表
app.get('/api/v1/products', (req, res) => {
    res.json({
        success: true,
        data: {
            list: [
                { id: '1', name: '测试商品1', price: 100 },
                { id: '2', name: '测试商品2', price: 200 }
            ],
            total: 2,
            page: 1,
            limit: 10
        }
    });
});

// 公共API - 分类列表
app.get('/api/v1/products/categories', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: '1', name: '电子产品' },
            { id: '2', name: '服装' }
        ]
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在',
        path: req.originalUrl
    });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误'
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`\n🚀 最小化服务器启动成功！`);
    console.log(`📍 端口: ${PORT}`);
    console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 健康检查: http://localhost:${PORT}/health`);
    console.log(`📚 API测试: http://localhost:${PORT}/api/v1/test\n`);
});

export default app;