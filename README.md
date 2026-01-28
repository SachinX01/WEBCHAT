# MultiVox - Video Chat Application

A real-time video conferencing web application built with Flask, WebRTC, and Socket.IO.

## Features

✅ Real-time video and audio streaming  
✅ Text chat alongside video  
✅ Screen sharing  
✅ Responsive design (mobile & desktop)  
✅ Multiple participants support  
✅ Automatic disconnect handling  
✅ Dynamic video grid layout  

## Prerequisites

- Python 3.8 or higher
- Modern web browser with WebRTC support (Chrome, Firefox, Edge, Safari)

## Installation

1. **Clone or download this repository**

2. **Create a virtual environment (recommended)**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**
   
   Windows (PowerShell):
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
   
   Windows (Command Prompt):
   ```cmd
   venv\Scripts\activate.bat
   ```
   
   macOS/Linux:
   ```bash
   source venv/bin/activate
   ```

4. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. **Start the server**
   ```bash
   python app.py
   ```

2. **Open your browser**
   
   Navigate to: `http://localhost:8080`

3. **Create or join a room**
   - Click "Create Room" to start a new meeting
   - Or enter a Room ID to join an existing meeting

## Usage Tips

- **Testing locally**: Open two browser windows (or use incognito mode) to test with multiple users
- **Avoid echo**: When testing on the same device, use headphones to prevent audio feedback
- **Camera/Mic permissions**: Allow browser access to camera and microphone when prompted
- **Screen sharing**: Click the desktop icon to share your screen (Chrome/Edge work best)

## Project Structure

```
WEBCHAT/
├── app.py                 # Flask backend with Socket.IO
├── requirements.txt       # Python dependencies
├── static/
│   ├── css/
│   │   └── style.css     # Styling and responsive design
│   └── js/
│       ├── index.js      # Home page logic
│       └── room.js       # WebRTC & room functionality
└── templates/
    ├── index.html        # Home page
    └── room.html         # Video room page
```

## How It Works

1. **Room Creation**: Server generates unique room IDs
2. **WebRTC Signaling**: Socket.IO handles SDP offers/answers and ICE candidates
3. **Peer-to-Peer**: Video/audio streams directly between browsers (not through server)
4. **Automatic Cleanup**: Disconnected users are automatically removed from rooms

## Technologies Used

- **Backend**: Flask, Flask-SocketIO
- **Frontend**: Vanilla JavaScript, WebRTC API
- **Styling**: CSS3 with responsive design
- **Real-time**: Socket.IO for signaling

## Troubleshooting

**Videos not showing:**
- Check browser console for errors (F12)
- Ensure camera/microphone permissions are granted
- Try refreshing the page

**Echo/feedback:**
- Use headphones when testing on a single device
- Make sure local video is muted (it should be by default)

**Connection issues across networks:**
- App uses STUN servers (works for most cases)
- For production, consider adding TURN servers for better NAT traversal

**Port already in use:**
- Change port in `app.py`: `socketio.run(app, ..., port=XXXX)`

## Browser Support

- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Edge
- ✅ Safari (may have limited screen sharing)
- ❌ Internet Explorer (not supported)

## Notes

- This is a development server - for production, use a proper WSGI server (gunicorn, etc.)
- Rooms are stored in memory - they reset when server restarts
- For production use, consider adding:
  - User authentication
  - Persistent room storage (database)
  - TURN servers
  - SSL/TLS (HTTPS required for production WebRTC)

## License

Free to use and modify.

## Credits

Built with ❤️ as a learning project for WebRTC and real-time communications.
