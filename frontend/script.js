'use strict';

// Connect to Socket.IO server
// const socket = io('http://localhost:5000');
const socket = io('https://realtimechat-cxc7.onrender.com');
let roomId;
let currentUser = '';
let selectedImageBuffer = null;
let selectedFileBuffer = null;
let selectedFileName = '';
let receivedChunks = [];
let totalChunks = 0;

// DOM elements
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const sendBtnEle = document.querySelector('.send-btn');
const messagesEle = document.querySelector('.messages');
const inputEle = document.querySelector('.input-message');
const hamburgerEle = document.querySelector('.hamburger');
const sidebarEle = document.querySelector('.sidebar');
const typingDiv = document.getElementById('typingIndicator');
const profileFormEle = document.querySelector('.profile-card');
const chatWindowEle = document.querySelector('.chat-window');
const profileName = document.getElementById('name');
const profileEmail = document.getElementById('email');
const profileLogo = document.querySelector('#profile-logo');
const chatHeaderContainer = document.querySelector('.chat-header');
const modal = document.getElementById('chatRequestModal');
const modalText = document.getElementById('chatRequestText');
const acceptBtn = document.getElementById('acceptChatBtn');
const declineBtn = document.getElementById('declineChatBtn');

let pendingRequest = '';

// Utilities
function scrollToBottom() {
  messagesEle.scrollTop = messagesEle.scrollHeight;
}

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getMessageElement(text, position) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${position}`;

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'bubble';
  bubbleDiv.textContent = text;

  const timeDiv = document.createElement('div');
  timeDiv.className = 'time';
  timeDiv.textContent = getCurrentTime();

  messageDiv.appendChild(bubbleDiv);
  messageDiv.appendChild(timeDiv);
  return messageDiv;
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64.split(',')[1]); // Strip data:image/jpeg;base64,
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function sendLargeImage(base64String, chunkSize = 64 * 1024, roomId) {
  const arrayBuffer = base64ToArrayBuffer(base64String);
  const totalChunks = Math.ceil(arrayBuffer.byteLength / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, arrayBuffer.byteLength);
    const chunk = arrayBuffer.slice(start, end);

    socket.emit('image-chunk', { chunk, index: i, total: totalChunks, roomId });
  }

  console.log(`Sent ${totalChunks} chunks.`);
}

//function send large file
function sendLargeFile(fileBuffer, chunkSize = 64 * 1024,fileName, roomId) {
  const totalChunks = Math.ceil(fileBuffer.byteLength / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, fileBuffer.byteLength);
    const chunk = fileBuffer.slice(start, end);

    socket.emit('file-chunk', { chunk, index: i, total: totalChunks, fileName, roomId });
  }

  console.log(`Sent ${totalChunks} chunks.`);
}

function showTypingIndicator() {
  typingDiv.style.display = 'block';
  scrollToBottom();
  clearTimeout(window.typingTimeout);
  window.typingTimeout = setTimeout(() => {
    typingDiv.style.display = 'none';
  }, 3000);
}

function hashColorClass(name) {
  const colors = ['purple', 'blue', 'red', 'green', 'orange'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function createAvatarInitials(name) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase();
}

async function createImageWithDownload(data, messagesEle, messagePos) {
  let blob;
  let imgURL;

  if (typeof data === 'string' && data.startsWith('data:image')) {
    // If data is a base64 string
    blob = await (await fetch(data)).blob();
    imgURL = data;
  } else if (data instanceof Blob) {
    // If data is already a Blob
    blob = data;
    imgURL = URL.createObjectURL(blob);
  } else {
    // Assume data is ArrayBuffer
    blob = new Blob([data], { type: 'image/jpeg' });
    imgURL = URL.createObjectURL(blob);
  }

  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.display = 'flex';
  container.style.margin = '10px';
  container.classList.add(messagePos);

  const img = document.createElement('img');
  img.src = imgURL;
  img.style.maxWidth = '300px';
  img.style.borderRadius = '8px';
  img.style.boxShadow = '0px 4px 8px rgba(0, 0, 0, 0.2)';
  container.appendChild(img);

  const downloadBtn = document.createElement('a');
  downloadBtn.href = imgURL;
  downloadBtn.download = 'received-image.jpg';
  downloadBtn.textContent = 'Download';
  downloadBtn.style.position = 'absolute';
  downloadBtn.style.top = '8px';
  downloadBtn.style.right = '8px';
  downloadBtn.style.backgroundColor = '#4CAF50';
  downloadBtn.style.color = 'white';
  downloadBtn.style.padding = '5px 8px';
  downloadBtn.style.borderRadius = '15px';
  downloadBtn.style.textDecoration = 'none';
  downloadBtn.style.fontSize = '16px';
  downloadBtn.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.3)';
  downloadBtn.style.cursor = 'pointer';
  container.appendChild(downloadBtn);

  messagesEle.appendChild(container);
  scrollToBottom();

  // Clean up object URL after a delay to ensure rendering
  setTimeout(() => URL.revokeObjectURL(imgURL), 1000);
}
//create file elementn with download link
function createFileWithDownload(fileBuffer, fileName, messagesEle, messagePos) {
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.display = 'flex';
  container.style.margin = '10px';
  container.classList.add(messagePos);

  const fileLink = document.createElement('a');
  fileLink.href = URL.createObjectURL(new Blob([fileBuffer]));
  fileLink.download = fileName || 'downloaded-file';
  fileLink.textContent = `click to downlod: ${fileName}` || 'Download File';
  //good styles should look like a file
  fileLink.style.backgroundColor = '#f0f0f0';
  fileLink.style.color = '#333';
  //proper padding and margin
  fileLink.style.padding = '10px';
  fileLink.style.maxWidth = '300px';
  fileLink.style.height = '40px';
  fileLink.style.borderRadius = '8px';
  fileLink.style.boxShadow = '0px 4px 8px rgba(0, 0, 0, 0.2)';
  container.appendChild(fileLink);

console.log('File link created:', container);
  messagesEle.appendChild(container);
  scrollToBottom();

  // Clean up object URL after a delay to ensure rendering
  setTimeout(() => URL.revokeObjectURL(fileLink.href), 1000);
}

// Socket Events
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('receive-message', (message) => {
  const receivedMessage = getMessageElement(message, 'left');
  console.log(message);
  messagesEle.appendChild(receivedMessage);
  scrollToBottom();
  typingDiv.style.display = 'none';
});

socket.on('image-chunk', async ({ chunk, index, total }) => {
  receivedChunks[index] = chunk;
  totalChunks = total;
  showTypingIndicator();

  console.log(`Received chunk ${index + 1} of ${total}`);

  if (receivedChunks.filter(Boolean).length === totalChunks) {
    console.log('All chunks received. Reconstructing image...');

    const blob = new Blob(receivedChunks, { type: 'image/jpeg' });
    const base64 = await blobToBase64(blob);

    createImageWithDownload(base64, messagesEle, 'left');
    scrollToBottom();

    // Reset chunks for next image
    receivedChunks = [];
    totalChunks = 0;

    console.log('Image received and reconstructed.');
  }
});
socket.on('file-chunk', ({ chunk, index, total, fileName }) => {
  receivedChunks[index] = chunk;
  totalChunks = total;
  showTypingIndicator();
  console.log(`Received file chunk ${index + 1} of ${total}`);
  if (receivedChunks.filter(Boolean).length === totalChunks) {
    console.log('All file chunks received. Reconstructing file...');

    const blob = new Blob(receivedChunks, { type: 'application/octet-stream' });
    createFileWithDownload(blob, fileName, messagesEle, 'left');
    scrollToBottom();

    // Reset chunks for next file
    receivedChunks = [];
    totalChunks = 0;

    console.log('File received and reconstructed.');
  }
});

socket.on('typing', () => {
  showTypingIndicator();
});

socket.on('all-users', (users) => {
  renderUsers(users);
});

socket.on('userJoinedRoom', ({ userId, usersInRoom }) => {
  updateRoomStatus(usersInRoom.length >= 2);
});

socket.on('friendLeft', () => {
  updateRoomStatus(false);
});

// UI updates
function updateRoomStatus(isConnected) {
  const name = chatHeaderContainer.querySelector('.name')?.textContent || 'Unknown';
  const avatar = chatHeaderContainer.querySelector('.avatar')?.textContent || 'U';
  const colorClass = chatHeaderContainer.querySelector('.avatar')?.classList[1] || 'blue';

  chatHeaderContainer.innerHTML = `
    <div class="avatar ${colorClass}">${avatar}</div>
    <div class="chat-title">
      <div class="name">${name}</div>
      <div class="status">${isConnected ? 'Connected' : 'Connecting...'}</div>
    </div>
  `;
}

// Handle Message Send
function handleSendBtnClick() {
  const text = inputEle.value.trim();
  if (!text && !selectedImageBuffer && !selectedFileBuffer) return;

  if (selectedImageBuffer) {
    createImageWithDownload(selectedImageBuffer, messagesEle, 'right');
    sendLargeImage(selectedImageBuffer, 64 * 1024, roomId);
    imagePreview.innerHTML = '';
    imagePreview.style.display = 'none';
    selectedImageBuffer = null;
    scrollToBottom();
  }
  if (selectedFileBuffer) {
    createFileWithDownload(selectedFileBuffer, selectedFileName, messagesEle, 'right');
    messagesEle.scrollTop = messagesEle.scrollHeight;
    sendLargeFile(selectedFileBuffer, 64 * 1024, selectedFileName, roomId);
    selectedFileBuffer = null;
    selectedFileName = '';
  }

  if (text) {
    socket.emit('input-message', text, roomId);
    const userMessage = getMessageElement(text, 'right');
    messagesEle.appendChild(userMessage);
    inputEle.value = '';
    inputEle.style.height = 'auto';
    scrollToBottom();
  }
}

// Input behavior
sendBtnEle.addEventListener('click', handleSendBtnClick);
inputEle.addEventListener('input', () => {
  socket.emit('typing', roomId);
  inputEle.style.height = 'auto';
  inputEle.style.height = `${inputEle.scrollHeight}px`;
});
inputEle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendBtnClick();
  }
});

// Sidebar toggle
hamburgerEle.addEventListener('click', () => {
  sidebarEle.classList.toggle('active');
  hamburgerEle.innerHTML = sidebarEle.classList.contains('active') ? '×' : '☰';
});

// Register user
profileFormEle.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = profileName.value;
  currentUser = name;

  socket.emit('register-user', {
    userId: socket.id,
    name,
    email: profileEmail.value,
  }, (response) => {
    if (response.status === 'success') {
      createProfileOnline(name);
      socket.emit('get-all-users');
    }
  });
});

function createProfileOnline(name) {
  const circle = document.querySelector('.profile-circle');
  const initials = createAvatarInitials(name);
  const color = hashColorClass(name);
  circle.className = `profile-circle ${color} green`;
  circle.textContent = initials;
  circle.style.animation = 'pulse 2s infinite';
  profileLogo.textContent = initials;
}

function renderUsers(users) {
  const chatList = document.querySelector('.chats');
  chatList.innerHTML = '';

  users.forEach((user) => {
    if (user.name === currentUser) return;
    const initials = createAvatarInitials(user.name);
    const colorClass = hashColorClass(user.name);

    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';

    chatItem.innerHTML = `
      <div class="avatar ${colorClass}">${initials}</div>
      <div class="chat-info">
        <div class="chat-name">${user.name}</div>
        <div class="chat-preview">Online now</div>
      </div>
      <span class="chat-time">●</span>
    `;
    chatList.appendChild(chatItem);
  });
}

// Room connection logic
sidebarEle.addEventListener('click', (e) => {
  const chatItem = e.target.closest('.chat-item');
  if (!chatItem) return;

  const name = chatItem.querySelector('.chat-name')?.textContent;
  const initials = chatItem.querySelector('.avatar')?.textContent;
  const avatarClass = chatItem.querySelector('.avatar')?.classList[1];

  if (name === currentUser) return;

  socket.emit('chat-request', { name, currentUser });
  if (roomId) socket.emit('userLeftRoom', { roomId });
  roomId = [currentUser, name].sort().join('-');
  socket.emit('join-room', { roomId });

  chatWindowEle.style.display = 'flex';
  profileFormEle.style.display = 'none';

  chatHeaderContainer.innerHTML = `
    <div class="avatar ${avatarClass}">${initials}</div>
    <div class="chat-title">
      <div class="name">${name}</div>
      <div class="status">Connecting...</div>
    </div>
  `;
});

// Dark Mode Toggle
const toggleBtn = document.getElementById('darkModeToggle');
toggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  toggleBtn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
});

// Chat request modal
socket.on('chat-request', ({ fromName }) => {
  pendingRequest = fromName;
  modalText.textContent = `${fromName} wants to chat with you.`;
  modal.classList.remove('hidden');
});

acceptBtn.onclick = () => {
  if (roomId) socket.emit('userLeftRoom', { roomId });
  roomId = [currentUser, pendingRequest].sort().join('-');
  socket.emit('join-room', { roomId });

  chatWindowEle.style.display = 'flex';
  profileFormEle.style.display = 'none';

  const initials = createAvatarInitials(pendingRequest);
  const avatarClass = hashColorClass(pendingRequest);

  chatHeaderContainer.innerHTML = `
    <div class="avatar ${avatarClass}">${initials}</div>
    <div class="chat-title">
      <div class="name">${pendingRequest}</div>
      <div class="status">Connecting...</div>
    </div>
  `;

  modal.classList.add('hidden');
  pendingRequest = '';
};

declineBtn.onclick = () => {
  modal.classList.add('hidden');
  pendingRequest = '';
};

// Periodic user list update
setInterval(() => {
  socket.emit('get-all-users');
}, 5000);

// Image input handling
imageInput.addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    selectedImageBuffer = e.target.result;
    imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
    imagePreview.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

// Handle file input for sending files
const fileInput = document.getElementById('fileInput');
//open local file dialog

fileInput.addEventListener('change', function () {
 console.log('File input changed');
  const file = this.files[0];
  if (!file) return;  

  const reader = new FileReader();
  reader.onload = function (e) {
    const fileBuffer = e.target.result;
    //add to preview
    selectedFileBuffer = fileBuffer;
    selectedFileName = file.name;
    const filePreview = document.getElementById('filePreview');
    const fileNameSpan = document.getElementById('fileName');
    fileNameSpan.textContent = file.name;
    filePreview.style.display = 'flex'; 
    filePreview.style.alignItems = 'center';
    filePreview.style.justifyContent = 'space-between';
    filePreview.style.margin = '10px 0';
    filePreview.style.padding = '10px';
    //remove file button
    const removeFileBtn = document.getElementById('removeFileBtn');
    removeFileBtn.onclick = () => {
      selectedFileBuffer = null;
      selectedFileName = '';
      filePreview.style.display = 'none';
    }
    socket.emit('send-file', { fileBuffer, fileName: file.name, roomId });
  };
  reader.readAsArrayBuffer(file);
});