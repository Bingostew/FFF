import { writable } from 'svelte/store';
import { io } from 'socket.io-client';

export const socket = writable(null);
export const gameId = writable('');
export const activePlayerId = writable(null);

let socketInstance = null;

export function initSocket() {
    if (!socketInstance) {
        socketInstance = io("http://localhost:3000");
        socket.set(socketInstance);
    }

    return socketInstance;
}
