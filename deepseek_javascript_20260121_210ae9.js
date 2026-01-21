const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// ICE Server configuration (STUN/TURN)
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Для продакшена добавьте TURN серверы:
  // {
  //   urls: 'turn:your-turn-server.com:3478',
  //   username: 'username',
  //   credential: 'password'
  // }
];

// Track active calls and rooms
const activeCalls = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('New WebRTC connection:', socket.id);

  socket.on('register', (userId) => {
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    console.log(`User ${userId} registered for WebRTC`);
  });

  // Create or join a call room
  socket.on('join-call', ({ roomId, userId }) => {
    socket.join(roomId);
    console.log(`User ${userId} joined room ${roomId}`);

    // Notify others in the room
    socket.to(roomId).emit('user-joined', { userId, socketId: socket.id });

    // Send ICE servers to client
    socket.emit('ice-servers', iceServers);
  });

  // WebRTC signaling: Offer
  socket.on('offer', ({ roomId, offer, callerId }) => {
    console.log(`Offer from ${callerId} in room ${roomId}`);
    socket.to(roomId).emit('offer', { offer, callerId });
  });

  // WebRTC signaling: Answer
  socket.on('answer', ({ roomId, answer, calleeId }) => {
    console.log(`Answer from ${calleeId} in room ${roomId}`);
    socket.to(roomId).emit('answer', { answer, calleeId });
  });

  // WebRTC signaling: ICE Candidate
  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', candidate);
  });

  // Toggle audio/video
  socket.on('toggle-media', ({ roomId, userId, mediaType, enabled }) => {
    socket.to(roomId).emit('media-toggled', { userId, mediaType, enabled });
  });

  // Screen sharing
  socket.on('screen-share', ({ roomId, userId, streamId }) => {
    socket.to(roomId).emit('screen-sharing', { userId, streamId });
  });

  // End screen share
  socket.on('stop-screen-share', ({ roomId, userId }) => {
    socket.to(roomId).emit('screen-share-stopped', { userId });
  });

  // End call
  socket.on('end-call', ({ roomId, userId }) => {
    console.log(`Call ended by ${userId} in room ${roomId}`);
    
    // Notify all users in the room
    io.to(roomId).emit('call-ended', { endedBy: userId });
    
    // Clean up room
    activeCalls.delete(roomId);
    
    // Leave room
    socket.leave(roomId);
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('WebRTC client disconnected:', socket.id);
    
    if (socket.userId) {
      userSockets.delete(socket.userId);
      
      // Notify all rooms this user was in
      const rooms = Array.from(socket.rooms);
      rooms.forEach(roomId => {
        if (roomId !== socket.id) {
          socket.to(roomId).emit('user-disconnected', { userId: socket.userId });
        }
      });
    }
  });
});

// Generate unique room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

const PORT = process.env.WEBRTC_PORT || 5001;
server.listen(PORT, () => {
  console.log(`WebRTC signaling server running on port ${PORT}`);
});