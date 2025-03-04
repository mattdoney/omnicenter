import { useCallback, useEffect, useState } from 'react';
import { APIClient } from '@/lib/api/client';
import { WebSocketServer } from '@/lib/websocket/server';
export function useMessages({ identifier }) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const fetchMessages = useCallback(async () => {
        if (!identifier)
            return;
        try {
            setIsLoading(true);
            setError(null);
            const client = APIClient.getInstance();
            const result = await client.getMessages({
                phoneNumber: identifier.includes('@') ? undefined : identifier,
                emailAddress: identifier.includes('@') ? identifier : undefined,
            });
            setMessages(result.messages);
        }
        catch (err) {
            console.error('Error fetching messages:', err);
            setError('Failed to fetch messages');
        }
        finally {
            setIsLoading(false);
        }
    }, [identifier]);
    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);
    const handleNewMessage = useCallback((message) => {
        setMessages(prev => [message, ...prev]);
    }, []);
    const handleMessageUpdate = useCallback((updatedMessage) => {
        setMessages(prev => prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg));
    }, []);
    useEffect(() => {
        const ws = WebSocketServer.getInstance();
        ws.on('newMessage', handleNewMessage);
        ws.on('messageUpdate', handleMessageUpdate);
        return () => {
            ws.off('newMessage', handleNewMessage);
            ws.off('messageUpdate', handleMessageUpdate);
        };
    }, [handleNewMessage, handleMessageUpdate]);
    return {
        messages,
        isLoading,
        error,
        refresh: fetchMessages
    };
}
//# sourceMappingURL=useMessages.js.map