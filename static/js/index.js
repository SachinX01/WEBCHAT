// static/js/index.js
document.addEventListener('DOMContentLoaded', () => {
    const createRoomBtn = document.getElementById('create-room');
    const joinRoomBtn = document.getElementById('join-room');
    const roomIdInput = document.getElementById('room-id');

    // Create a new room
    createRoomBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/create');
            const data = await response.json();
            window.location.href = `/join/${data.room_id}`;
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Could not create room. Please try again.');
        }
    });

    // Join an existing room
    joinRoomBtn.addEventListener('click', () => {
        const roomId = roomIdInput.value.trim();
        if (roomId) {
            window.location.href = `/join/${roomId}`;
        } else {
            alert('Please enter a valid Room ID');
        }
    });

    // Allow joining by pressing Enter
    roomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinRoomBtn.click();
        }
    });
});
