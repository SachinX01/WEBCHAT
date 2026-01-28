# --- app.py ---
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import uuid
import os
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

# Store active rooms and participants
rooms = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/create')
def create():
    # Generate a unique room ID
    room_id = str(uuid.uuid4())[:8]
    return jsonify({"room_id": room_id})

@app.route('/join/<room_id>')
def join(room_id):
    # Check if room exists
    if room_id not in rooms:
        rooms[room_id] = {"users": [], "created_at": datetime.now().isoformat()}
    return render_template('room.html', room_id=room_id)

@socketio.on('join')
def on_join(data):
    username = data['username']
    room_id = data['room_id']
    join_room(room_id)
    
    # Add user to room
    if room_id not in rooms:
        rooms[room_id] = {"users": [], "created_at": datetime.now().isoformat()}
    
    user_id = str(uuid.uuid4())[:6]
    
    # Get existing users before adding new one
    existing_users = rooms[room_id]["users"].copy()
    
    # Add new user with socket session ID
    rooms[room_id]["users"].append({"id": user_id, "username": username, "sid": request.sid})
    
    # Notify others that user joined (don't include the new user)
    emit('user_joined', {
        'user_id': user_id,
        'username': username,
        'sid': request.sid,
        'timestamp': datetime.now().isoformat()
    }, to=room_id, skip_sid=request.sid)
    
    # Send existing users to the new user
    total_users = len(rooms[room_id]["users"])
    return {'user_id': user_id, 'existing_users': existing_users, 'total_users': total_users}

@socketio.on('leave')
def on_leave(data):
    username = data['username']
    room_id = data['room_id']
    user_id = data['user_id']
    
    # Remove user from room first
    if room_id in rooms:
        rooms[room_id]["users"] = [user for user in rooms[room_id]["users"] if user["id"] != user_id]
        remaining_count = len(rooms[room_id]["users"])
        
        # Notify others BEFORE leaving room
        emit('user_left', {
            'username': username, 
            'user_id': user_id,
            'remaining_count': remaining_count
        }, to=room_id, skip_sid=request.sid)
        
        if not rooms[room_id]["users"]:
            # Remove room if empty
            rooms.pop(room_id, None)
    
    leave_room(room_id)

@socketio.on('sdp_offer')
def handle_sdp_offer(data):
    # Route to specific socket session
    emit('sdp_offer', data, room=data['target_sid'])

@socketio.on('sdp_answer')
def handle_sdp_answer(data):
    # Route to specific socket session
    emit('sdp_answer', data, room=data['target_sid'])

@socketio.on('ice_candidate')
def handle_ice_candidate(data):
    # Route to specific socket session
    emit('ice_candidate', data, room=data['target_sid'])

@socketio.on('message')
def handle_message(data):
    room_id = data['room_id']
    data['timestamp'] = datetime.now().isoformat()
    emit('message', data, to=room_id)

@socketio.on('disconnect')
def on_disconnect():
    # Find and remove user from all rooms when they disconnect
    sid = request.sid
    for room_id, room_data in list(rooms.items()):
        for user in room_data["users"]:
            if user.get("sid") == sid:
                # Found the disconnected user
                user_id = user["id"]
                username = user["username"]
                
                # Remove user from room
                rooms[room_id]["users"] = [u for u in rooms[room_id]["users"] if u["id"] != user_id]
                remaining_count = len(rooms[room_id]["users"])
                
                # Notify others
                emit('user_left', {
                    'username': username,
                    'user_id': user_id,
                    'remaining_count': remaining_count
                }, to=room_id)
                
                # Remove room if empty
                if not rooms[room_id]["users"]:
                    rooms.pop(room_id, None)
                
                break

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    socketio.run(app, debug=False, host='0.0.0.0', port=port)