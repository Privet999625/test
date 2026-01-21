require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const messageRoutes = require('./routes/messages');
const callRoutes = require('./routes/calls');
const fileRoutes = require('./routes/files');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/files', fileRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // User authentication
  socket.on('authenticate', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    console.log(`User ${userId} authenticated`);
    
    // Notify friends that user is online
    socket.broadcast.emit('user-online', userId);
  });

  // Private messaging
  socket.on('private-message', ({ to, message, type, attachment }) => {
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('new-message', {
        from: socket.userId,
        message,
        type,
        attachment,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Call signaling
  socket.on('call-offer', ({ to, offer, callType }) => {
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('incoming-call', {
        from: socket.userId,
        offer,
        callType
      });
    }
  });

  socket.on('call-answer', ({ to, answer }) => {
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call-answered', {
        from: socket.userId,
        answer
      });
    }
  });

  socket.on('call-ice-candidate', ({ to, candidate }) => {
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('ice-candidate', {
        from: socket.userId,
        candidate
      });
    }
  });

  socket.on('call-end', ({ to }) => {
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call-ended', {
        from: socket.userId
      });
    }
  });

  // Typing indicators
  socket.on('typing', ({ to, isTyping }) => {
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user-typing', {
        from: socket.userId,
        isTyping
      });
    }
  });

  // Read receipts
  socket.on('message-read', ({ messageId, contactId }) => {
    const recipientSocketId = onlineUsers.get(contactId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message-read-receipt', {
        messageId,
        readerId: socket.userId
      });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      socket.broadcast.emit('user-offline', socket.userId);
    }
  });
});

// Database connection and server start
const PORT = process.env.PORT || 5000;

sequelize.authenticate()
  .then(() => {
    console.log('Database connected successfully');
    
    // Sync database (use { force: true } only in development)
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket server ready`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to database:', err);
    process.exit(1);
  });