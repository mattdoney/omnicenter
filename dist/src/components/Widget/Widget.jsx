import React, { useState, useMemo } from 'react';
import { useMessages } from '@/hooks/useMessages';
import Timeline from '../Timeline/Timeline';
import { APIClient } from '@/lib/api/client';
export const Widget = ({ identifier, height = '600px', theme = 'light', }) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [selectedType, setSelectedType] = useState('all');
    const [newMessage, setNewMessage] = useState('');
    const [sendError, setSendError] = useState(null);
    const { messages, isLoading, error } = useMessages({
        identifier,
    });
    const filteredMessages = useMemo(() => {
        if (selectedType === 'all')
            return messages;
        return messages.filter(msg => msg.type === selectedType);
    }, [messages, selectedType]);
    const handleSend = async () => {
        if (!identifier.trim() || !newMessage.trim())
            return;
        try {
            setSendError(null);
            const apiClient = APIClient.getInstance();
            await apiClient.sendMessage({
                emailAddress: identifier.includes('@') ? identifier : undefined,
                phoneNumber: identifier.includes('@') ? undefined : identifier,
                body: newMessage,
                subject: 'New Message',
            });
            setNewMessage('');
        }
        catch (err) {
            console.error('Error sending message:', err);
            setSendError('Failed to send message');
        }
    };
    if (isMinimized) {
        return (<button onClick={() => setIsMinimized(false)} className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"/>
        </svg>
      </button>);
    }
    return (<div className={`fixed bottom-4 right-4 w-96 rounded-lg shadow-xl overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} style={{ height }}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
        <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Communication History
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setIsMinimized(true)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Message Type Filters */}
      {messages.length > 0 && (<div className="flex space-x-2 p-2 border-b">
          <button onClick={() => setSelectedType('all')} className={`px-3 py-1 rounded-lg text-sm ${selectedType === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-200 hover:bg-gray-300'}`}>
            All
          </button>
          <button onClick={() => setSelectedType('sms')} className={`px-3 py-1 rounded-lg text-sm ${selectedType === 'sms'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-100 hover:bg-purple-200'}`}>
            SMS
          </button>
          <button onClick={() => setSelectedType('email')} className={`px-3 py-1 rounded-lg text-sm ${selectedType === 'email'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 hover:bg-blue-200'}`}>
            Email
          </button>
          <button onClick={() => setSelectedType('call')} className={`px-3 py-1 rounded-lg text-sm ${selectedType === 'call'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 hover:bg-green-200'}`}>
            Calls
          </button>
        </div>)}

      {/* Error Display */}
      {(error || sendError) && (<div className="p-2 text-sm text-red-500 bg-red-50">
          {error || sendError}
        </div>)}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        <Timeline messages={filteredMessages} loading={isLoading}/>
      </div>

      {/* Message Input */}
      <div className="p-2 border-t">
        <div className="flex space-x-2">
          <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 p-2 border rounded-lg text-sm" onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        }}/>
          <button onClick={handleSend} disabled={!newMessage.trim()} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-sm">
            Send
          </button>
        </div>
      </div>
    </div>);
};
//# sourceMappingURL=Widget.jsx.map