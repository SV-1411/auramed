import { useEffect } from 'react';
import type { SosRequest } from '../types/sos';
import { useSocket } from '../contexts/SocketContext';

export function useSosSocket(handlers: {
  onNew?: (sos: SosRequest) => void;
  onUpdated?: (sos: SosRequest) => void;
  onAssigned?: (sos: SosRequest) => void;
  onResolved?: (sos: SosRequest) => void;
}) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    if (handlers.onNew) socket.on('sos:new', handlers.onNew);
    if (handlers.onUpdated) socket.on('sos:updated', handlers.onUpdated);
    if (handlers.onAssigned) socket.on('sos:assigned', handlers.onAssigned);
    if (handlers.onResolved) socket.on('sos:resolved', handlers.onResolved);

    return () => {
      if (handlers.onNew) socket.off('sos:new', handlers.onNew);
      if (handlers.onUpdated) socket.off('sos:updated', handlers.onUpdated);
      if (handlers.onAssigned) socket.off('sos:assigned', handlers.onAssigned);
      if (handlers.onResolved) socket.off('sos:resolved', handlers.onResolved);
    };
  }, [handlers.onAssigned, handlers.onNew, handlers.onResolved, handlers.onUpdated, socket]);
}
