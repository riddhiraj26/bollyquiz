import { io } from 'socket.io-client';

const socket = io(import.meta.env.DEV ? 'http://localhost:3001' : undefined, {
  autoConnect: false,
});

export default socket;
