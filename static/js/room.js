// Static/js/room.js - Enhanced with complete WebRTC functionality (continued)

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const joinScreen = document.getElementById('join-screen');
    const roomScreen = document.getElementById('room-screen');
    const localPreview = document.getElementById('local-preview');
    const videoGrid = document.getElementById('video-grid');
    const usernameInput = document.getElementById('username-input');
    const enterRoomBtn = document.getElementById('enter-room');
    const toggleVideoBtn = document.getElementById('toggle-video');
    const toggleAudioBtn = document.getElementById('toggle-audio');
    const roomToggleVideoBtn = document.getElementById('room-toggle-video');
    const roomToggleAudioBtn = document.getElementById('room-toggle-audio');
    const leaveMeetingBtn = document.getElementById('leave-meeting');
    const participantCount = document.getElementById('participant-count');
    const toggleChatBtn = document.getElementById('toggle-chat');
    const chatPanel = document.getElementById('chat-panel');
    const chatMessages = document.getElementById('chat-messages');
    const chatMessageInput = document.getElementById('chat-message');
    const sendMessageBtn = document.getElementById('send-message');
    const closeChatBtn = document.getElementById('close-chat');
    const shareScreenBtn = document.getElementById('share-screen');

    // State variables
    let localStream = null;
    let screenStream = null;
    let isScreenSharing = false;
    let username = '';
    let userId = null;
    let videoEnabled = true;
    let audioEnabled = true;
    const peers = {}; // peers[userId] = {connection, username, sid}
    let localVideoContainer = null;

    // Ice servers configuration for WebRTC
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
            // You may want to add TURN servers for more reliable connections
            // Especially for users behind firewalls or complex NATs
        ]
    };

    // Connect to Socket.io server
    const socket = io();

    // Set up local video stream
    async function setupLocalStream() {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            localPreview.srcObject = localStream;
            return true;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Could not access camera or microphone. Please check permissions.');
            return false;
        }
    }

    // Initialize room
    async function init() {
        const streamReady = await setupLocalStream();
        if (streamReady) {
            // Add event listeners
            enterRoomBtn.addEventListener('click', enterRoom);
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') enterRoom();
            });
            
            toggleVideoBtn.addEventListener('click', toggleVideo);
            toggleAudioBtn.addEventListener('click', toggleAudio);
            roomToggleVideoBtn.addEventListener('click', toggleVideo);
            roomToggleAudioBtn.addEventListener('click', toggleAudio);
            leaveMeetingBtn.addEventListener('click', leaveRoom);
            toggleChatBtn.addEventListener('click', toggleChat);
            closeChatBtn.addEventListener('click', toggleChat);
            shareScreenBtn.addEventListener('click', toggleScreenShare);
            
            // Setup socket handlers
            setupSocketHandlers();
        }
    }

    // Setup socket event handlers
    function setupSocketHandlers() {
        // When a new user joins the room
        socket.on('user_joined', (data) => {
            console.log('User joined:', data);
            
            // Another user joined - create peer connection
            console.log('Creating connection to new user:', data.user_id, data.username, 'SID:', data.sid);
            createPeerConnection(data.user_id, data.username, data.sid, false);
            
            // Update participant count
            const currentCount = parseInt(participantCount.textContent);
            participantCount.textContent = currentCount + 1;
        });

        // When a user leaves the room
        socket.on('user_left', (data) => {
            console.log('User left:', data);
            
            // Remove peer connection
            if (peers[data.user_id]) {
                const videoEl = document.getElementById(`video-${data.user_id}`);
                if (videoEl) {
                    videoEl.remove();
                    resizeVideoGrid(); // Resize grid after removing video
                }
                
                // Close and delete the peer connection
                peers[data.user_id].connection.close();
                delete peers[data.user_id];
            }
            
            // Update participant count from server
            if (data.remaining_count !== undefined) {
                participantCount.textContent = data.remaining_count;
            }
        });

        // SDP offer received
        socket.on('sdp_offer', async (data) => {
            console.log('Received SDP offer from:', data.sender_id, data.sender_name);
            
            // Create peer if it doesn't exist (we are the answerer, so don't create offer)
            if (!peers[data.sender_id]) {
                // We need the sender's SID - get it from socket.id of the sender
                // For now, we'll store it when we receive the offer
                const peerConnection = new RTCPeerConnection(iceServers);
                peers[data.sender_id] = {
                    connection: peerConnection,
                    username: data.sender_name,
                    sid: data.sender_sid || request.sid
                };
                
                // Add local tracks
                localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, localStream);
                });
                
                // Handle ICE candidates
                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('ice_candidate', {
                            target_sid: peers[data.sender_id].sid,
                            sender_id: userId,
                            candidate: event.candidate
                        });
                    }
                };
                
                // Handle incoming streams
                peerConnection.ontrack = (event) => {
                    console.log('Got track from peer:', data.sender_id);
                    if (event.streams && event.streams[0]) {
                        addVideoStream(data.sender_id, event.streams[0], data.sender_name, false);
                    }
                };
            }
            
            const peer = peers[data.sender_id];
                
            
            try {
                // Set remote description from the offer
                await peer.connection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                
                // Create answer
                const answer = await peer.connection.createAnswer();
                await peer.connection.setLocalDescription(answer);
                
                // Send answer back
                socket.emit('sdp_answer', {
                    target_sid: data.sender_sid,
                    sender_id: userId,
                    sender_name: username,
                    sdp: answer
                });
            } catch (error) {
                console.error('Error handling offer:', error);
            }
        });

        // SDP answer received
        socket.on('sdp_answer', async (data) => {
            console.log('Received SDP answer from:', data.sender_id);
            
            if (peers[data.sender_id]) {
                try {
                    await peers[data.sender_id].connection.setRemoteDescription(
                        new RTCSessionDescription(data.sdp)
                    );
                } catch (error) {
                    console.error('Error handling answer:', error);
                }
            }
        });

        // ICE candidate received
        socket.on('ice_candidate', async (data) => {
            console.log('Received ICE candidate from:', data.sender_id);
            
            if (peers[data.sender_id]) {
                try {
                    await peers[data.sender_id].connection.addIceCandidate(
                        new RTCIceCandidate(data.candidate)
                    );
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            }
        });

        // Chat message received
        socket.on('message', (data) => {
            const isFromMe = data.user_id === userId;
            addChatMessage(data.username, data.message, isFromMe);
            
            // If chat panel is hidden, show notification
            if (chatPanel.classList.contains('hidden')) {
                // Add notification code here if needed
                toggleChatBtn.classList.add('new-message');
            }
        });
        
        // Handle socket disconnection
        socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
        
        // Handle socket reconnection
        socket.on('connect', () => {
            console.log('Connected to server');
            // If we were in a room and reconnected, we need to rejoin
            if (userId && username) {
                console.log('Reconnecting to room...');
            }
        });
    }

    // Create a peer connection
    function createPeerConnection(peerId, peerUsername, peerSid, shouldCreateOffer) {
        console.log('Creating peer connection with:', peerId, 'Username:', peerUsername, 'SID:', peerSid, 'shouldCreateOffer:', shouldCreateOffer);
        
        // Don't create duplicate connections
        if (peers[peerId]) {
            console.log('Peer connection already exists for:', peerId);
            return peers[peerId].connection;
        }
        
        // Create new RTCPeerConnection
        const peerConnection = new RTCPeerConnection(iceServers);
        
        // Add peer to peers list
        peers[peerId] = {
            connection: peerConnection,
            username: peerUsername,
            sid: peerSid
        };
        
        // Add local tracks to connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    target_sid: peerSid,
                    sender_id: userId,
                    candidate: event.candidate
                });
            }
        };
        
        // Handle incoming streams
        peerConnection.ontrack = (event) => {
            console.log('Got track from peer:', peerId);
            if (event.streams && event.streams[0]) {
                addVideoStream(peerId, event.streams[0], peerUsername, false);
            }
        };
        
        // If we should initiate the connection, create and send offer
        if (shouldCreateOffer) {
            console.log('Will create offer for:', peerId);
            peerConnection.createOffer()
                .then(offer => peerConnection.setLocalDescription(offer))
                .then(() => {
                    console.log('Sending offer to:', peerId, 'SID:', peerSid);
                    socket.emit('sdp_offer', {
                        target_sid: peerSid,
                        sender_id: userId,
                        sender_name: username,                        sender_sid: socket.id,                        sdp: peerConnection.localDescription
                    });
                })
                .catch(error => console.error('Error creating offer:', error));
        } else {
            console.log('Waiting for offer from:', peerId);
        }
        
        return peerConnection;
    }

    // Enter Room Function
    async function enterRoom() {
        username = usernameInput.value.trim() || `User${Math.floor(Math.random() * 1000)}`;
        if (!username) return alert('Please enter your name');

        // Emit join event
        socket.emit('join', { username, room_id: ROOM_ID }, (response) => {
            userId = response.user_id;
            console.log('Joined room with user ID:', userId);
            console.log('Existing users:', response.existing_users);
            
            // Create peer connections to all existing users
            response.existing_users.forEach(user => {
                console.log('Creating connection to existing user:', user.id, user.username, 'SID:', user.sid);
                createPeerConnection(user.id, user.username, user.sid, true);
            });
            
            // Update participant count from server
            participantCount.textContent = response.total_users;
        });

        // Transition to room screen
        joinScreen.classList.add('hidden');
        roomScreen.classList.remove('hidden');

        // Add local video
        addVideoStream('local', localStream, username, true);
    }

    // Add video stream to the grid
    function addVideoStream(id, stream, username, isLocal) {
        // Remove existing container for this ID if it exists
        const existingContainer = document.getElementById(`video-${id}`);
        if (existingContainer) {
            existingContainer.remove();
        }
        
        const videoContainer = document.createElement('div');
        videoContainer.className = `video-container${isLocal ? ' local-video' : ''}`;
        videoContainer.id = `video-${id}`;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        if (isLocal) {
            video.muted = true;
            localVideoContainer = videoContainer;
        }

        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.textContent = isLocal ? `${username} (You)` : username;

        const statusIcons = document.createElement('div');
        statusIcons.className = 'status-icons';
        
        if (isLocal) {
            const micIcon = document.createElement('i');
            micIcon.className = audioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
            micIcon.id = 'mic-icon';
            
            const videoIcon = document.createElement('i');
            videoIcon.className = videoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
            videoIcon.id = 'video-icon';
            
            statusIcons.appendChild(micIcon);
            statusIcons.appendChild(videoIcon);
            
            videoContainer.appendChild(video);
            videoContainer.appendChild(userInfo);
            videoContainer.appendChild(statusIcons);
        } else {
            videoContainer.appendChild(video);
            videoContainer.appendChild(userInfo);
        }
        
        videoGrid.appendChild(videoContainer);
        
        // Resize grid based on count
        resizeVideoGrid();
    }

    // Resize video grid based on participant count
    function resizeVideoGrid() {
        const count = videoGrid.childElementCount;
        let columns, rows;
        
        // Check if small screen
        const isSmallScreen = window.innerWidth < 768;
        const isMediumScreen = window.innerWidth >= 768 && window.innerWidth < 1200;
        
        if (isSmallScreen) {
            // Mobile: single column
            columns = 1;
            rows = count;
        } else if (count === 1) {
            columns = 1;
            rows = 1;
        } else if (count === 2) {
            columns = isMediumScreen ? 1 : 2;
            rows = isMediumScreen ? 2 : 1;
        } else if (count === 3 || count === 4) {
            columns = 2;
            rows = 2;
        } else if (count <= 6) {
            columns = isMediumScreen ? 2 : 3;
            rows = Math.ceil(count / columns);
        } else if (count <= 9) {
            columns = 3;
            rows = 3;
        } else {
            columns = isMediumScreen ? 3 : 4;
            rows = Math.ceil(count / columns);
        }
        
        videoGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        videoGrid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
        
        // For single participant, make it larger
        if (count === 1) {
            videoGrid.style.justifyContent = 'center';
            videoGrid.style.alignItems = 'center';
        } else {
            videoGrid.style.justifyContent = 'start';
            videoGrid.style.alignItems = 'start';
        }
    }

    // Toggle video on/off
    function toggleVideo() {
        videoEnabled = !videoEnabled;
        
        // Update stream tracks
        localStream.getVideoTracks().forEach(track => {
            track.enabled = videoEnabled;
        });
        
        // Update UI
        const videoIconClass = videoEnabled ? 'fa-video' : 'fa-video-slash';
        toggleVideoBtn.innerHTML = `<i class="fas ${videoIconClass}"></i>`;
        roomToggleVideoBtn.innerHTML = `<i class="fas ${videoIconClass}"></i>`;
        
        if (localVideoContainer) {
            const videoIcon = localVideoContainer.querySelector('#video-icon');
            if (videoIcon) {
                videoIcon.className = `fas ${videoIconClass}`;
            }
        }
    }

    // Toggle audio on/off
    function toggleAudio() {
        audioEnabled = !audioEnabled;
        
        // Update stream tracks
        localStream.getAudioTracks().forEach(track => {
            track.enabled = audioEnabled;
        });
        
        // Update UI
        const audioIconClass = audioEnabled ? 'fa-microphone' : 'fa-microphone-slash';
        toggleAudioBtn.innerHTML = `<i class="fas ${audioIconClass}"></i>`;
        roomToggleAudioBtn.innerHTML = `<i class="fas ${audioIconClass}"></i>`;
        
        if (localVideoContainer) {
            const micIcon = localVideoContainer.querySelector('#mic-icon');
            if (micIcon) {
                micIcon.className = `fas ${audioIconClass}`;
            }
        }
    }

    // Toggle chat panel
    function toggleChat() {
        chatPanel.classList.toggle('hidden');
        toggleChatBtn.classList.remove('new-message');
    }

    // Add chat message to panel
    function addChatMessage(sender, message, isFromMe) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isFromMe ? 'outgoing' : 'incoming'}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'sender-name';
        nameSpan.textContent = isFromMe ? 'You' : sender;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message;
        
        messageDiv.appendChild(nameSpan);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Send chat message
    function sendChatMessage() {
        const message = chatMessageInput.value.trim();
        if (message) {
            socket.emit('message', {
                room_id: ROOM_ID,
                user_id: userId,
                username: username,
                message: message
            });
            chatMessageInput.value = '';
        }
    }

    // Toggle screen sharing
    async function toggleScreenShare() {
        if (!isScreenSharing) {
            try {
                // Get screen stream
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
                
                // Replace video track in all peer connections
                const videoTrack = screenStream.getVideoTracks()[0];
                
                Object.keys(peers).forEach(peerId => {
                    const sender = peers[peerId].connection
                        .getSenders()
                        .find(s => s.track && s.track.kind === 'video');
                        
                    if (sender) {
                        sender.replaceTrack(videoTrack);
                    }
                });
                
                // Replace local video
                const localVideo = document.querySelector('#video-local video');
                if (localVideo) {
                    localVideo.srcObject = screenStream;
                }
                
                // Update UI
                // Update UI
                shareScreenBtn.innerHTML = '<i class="fas fa-desktop"></i> Stop';
                shareScreenBtn.classList.add('active');
                
                // Add ended event listener
                videoTrack.addEventListener('ended', () => {
                    stopScreenSharing();
                });
                
                isScreenSharing = true;
                
            } catch (error) {
                console.error('Error sharing screen:', error);
                alert('Could not share screen. Please check permissions.');
            }
        } else {
            stopScreenSharing();
        }
    }
    
    // Stop screen sharing
    function stopScreenSharing() {
        if (!isScreenSharing || !screenStream) return;
        
        // Stop all screen tracks
        screenStream.getTracks().forEach(track => track.stop());
        
        // Replace video track back in all peer connections
        const videoTrack = localStream.getVideoTracks()[0];
        
        if (videoTrack) {
            Object.keys(peers).forEach(peerId => {
                const sender = peers[peerId].connection
                    .getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                    
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });
            
            // Replace local video
            const localVideo = document.querySelector('#video-local video');
            if (localVideo) {
                localVideo.srcObject = localStream;
            }
        }
        
        // Update UI
        shareScreenBtn.innerHTML = '<i class="fas fa-desktop"></i>';
        shareScreenBtn.classList.remove('active');
        
        screenStream = null;
        isScreenSharing = false;
    }

    // Leave room
    function leaveRoom() {
        // Notify server
        socket.emit('leave', {
            room_id: ROOM_ID,
            username: username,
            user_id: userId
        });
        
        // Close all peer connections
        Object.keys(peers).forEach(peerId => {
            peers[peerId].connection.close();
        });
        
        // Stop local tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
        }
        
        // Redirect to home page
        window.location.href = '/';
    }

    // Handle incoming messages
    sendMessageBtn.addEventListener('click', sendChatMessage);
    chatMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Handle window unload - let the disconnect event handle cleanup
    window.addEventListener('beforeunload', () => {
        // Just close peer connections, server disconnect handler will notify others
        Object.keys(peers).forEach(peerId => {
            if (peers[peerId].connection) {
                peers[peerId].connection.close();
            }
        });
    });
    
    // Handle window resize to adjust grid layout
    window.addEventListener('resize', () => {
        resizeVideoGrid();
    });

    // Handle device change
    navigator.mediaDevices.addEventListener('devicechange', async () => {
        console.log('Media devices changed');
        // Optionally update device selection
    });

    // Mobile device specific adaptations
    function setupMobileAdaptation() {
        // Check if mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // Add mobile-specific classes
            document.body.classList.add('mobile-device');
            
            // Handle orientation changes
            window.addEventListener('orientationchange', () => {
                setTimeout(resizeVideoGrid, 200);
            });
        }
    }

    // Initialize the room
    init();
    setupMobileAdaptation();
});