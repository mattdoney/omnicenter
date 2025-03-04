import { useCallback, useEffect, useState } from 'react';
import { UnifiedMessage } from '@/types/messages';
import { APIClient } from '@/lib/api/client';
import { WebSocketServer } from '@/lib/websocket/server';

interface UseMessagesOptions {
  identifier: string;
}

export function useMessages({ identifier }: UseMessagesOptions) {
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!identifier) return;

    try {
      setIsLoading(true);
      setError(null);

      const client = APIClient.getInstance();
      const result = await client.getMessages({
        phoneNumber: identifier.includes('@') ? undefined : identifier,
        emailAddress: identifier.includes('@') ? identifier : undefined,
      });

      setMessages(result.messages);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, [identifier]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleNewMessage = useCallback((message: UnifiedMessage) => {
    setMessages(prev => [message, ...prev]);
  }, []);

  const handleMessageUpdate = useCallback((updatedMessage: UnifiedMessage) => {
    setMessages(prev => 
      prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
    );
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
