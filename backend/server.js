const http = require('http');
const server = http.createServer();
require('dotenv').config();


const io = require('socket.io')(server, {
  cors: {
    origin: "http://127.0.0.1:5500", // Frontend URL
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log("🔌 User connected:", socket.id);

  // Store username on registration
  socket.on("register-user", (data, callback) => {
    socket.data.username = data.name;
    console.log(`👤 Registered user: ${data.name} (${socket.id})`);
    callback({
      message: "User registered successfully",
      status: "success"
    });
    broadcastAllUsers();
  });

  // Join a room
  socket.on('join-room', ({ roomId }) => {
    socket.join(roomId);
    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    io.to(roomId).emit("userJoinedRoom", {
      userId: socket.id,
      usersInRoom
    });
    console.log(`🏠 ${socket.id} joined room: ${roomId}`);
  });
  socket.on("userLeftRoom",({roomId})=>{
    socket.to(roomId).emit("friendLeft");
    socket.leave(roomId);

  })

  // Message sending
  socket.on("input-message", (message, roomId) => {
    console.log(`💬 Message from ${socket.id} to room ${roomId}: ${message}`);
    socket.to(roomId).emit("recive-message", message);
  });

  // Typing indicator
  socket.on("typing", (roomId) => {
    socket.to(roomId).emit("typing");
  });

  // Return all users to the requesting client
  socket.on("get-all-users", async () => {
    const users = await getAllUsers();
    socket.emit("all-users", users);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    broadcastAllUsers();
  });
  //handle request
socket.on('chat-request', async ({ name, currentUser }) => {
  const users = await getAllUsers();
  const targetUser = users.find(user => user.name === name);

  io.to(targetUser.id).emit('chat-request', {
    fromId: socket.id,
    fromName:currentUser
  });
});




  // Helpers
  
  async function broadcastAllUsers() {
    const users = await getAllUsers();
    io.emit("all-users", users);
  }

  async function getAllUsers() {
    const sockets = await io.fetchSockets();
    return sockets.map(s => ({
      id: s.id,
      name: s.data.username || "Unknown"
    }));
  }
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("✅ Socket.IO server running at http://localhost:3000");
});

