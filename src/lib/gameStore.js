import { writable } from 'svelte/store';
import { io } from 'socket.io-client';
import { PUBLIC_SERVER_URL } from '$env/static/public'; // Import the variable

export const socket = writable(null);
export const gameId = writable('');
export const activePlayerId = writable(null);

let socketInstance = null;

export function initSocket() {
    if (!socketInstance) {
        socketInstance = io(PUBLIC_SERVER_URL);
        socket.set(socketInstance);
    }

    return socketInstance;
}