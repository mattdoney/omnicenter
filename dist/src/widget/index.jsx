'use client';
import { useCallback, useState, useMemo } from 'react';
import Timeline from '@/components/Timeline/Timeline';
import { APIClient } from '@/lib/api/client';
export default function Home() {
    const [identifier, setIdentifier] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedType, setSelectedType] = useState('all');
    const filteredMessages = useMemo(() => {
        if (selectedType === 'all')
            return messages;
        return messages.filter(msg => msg.type === selectedType);
    }, [messages, selectedType]);
    const loadMessages = useCallback(async () => {
        if (!identifier.trim())
            return;
        setLoading(true);
        setError(null);
        try {
            // First, try to get associated identifiers from Segment
            console.log('Loading identifiers from Segment:', identifier);
            const segmentResponse = await fetch(`/api/segment/external-ids?identifier=${encodeURIComponent(identifier)}`);
            if (!segmentResponse.ok) {
                throw new Error(`Failed to load Segment identifiers: ${segmentResponse.statusText}`);
            }
            const segmentData = await segmentResponse.json();
            console.log('Segment identifiers loaded:', segmentData);
            // Extract email and phone from Segment response
            let emailAddress = identifier.includes('@') ? identifier : undefined;
            let phoneNumber = identifier.includes('@') ? undefined : identifier;
            for (const externalId of segmentData.data) {
                if (externalId.type === 'email' && !emailAddress) {
                    emailAddress = externalId.id;
                }
                else if (externalId.type === 'phone' && !phoneNumber) {
                    phoneNumber = externalId.id;
                }
            }
            // Use APIClient to fetch all messages
            const apiClient = APIClient.getInstance();
            const result = await apiClient.getMessages({
                emailAddress,
                phoneNumber,
            });
            console.log('[Page] Received messages:', result.messages.map(m => ({ id: m.id, type: m.type, timestamp: m.timestamp })));
            // Check for duplicates
            const messageIds = new Set();
            const duplicates = result.messages.filter(msg => {
                if (messageIds.has(msg.id)) {
                    console.log('[Page] Found duplicate message:', msg);
                    return true;
                }
                messageIds.add(msg.id);
                return false;
            });
            if (duplicates.length > 0) {
                console.log('[Page] Found duplicate messages:', duplicates.length);
            }
            setMessages(result.messages);
        }
        catch (err) {
            console.error('Error loading messages:', err);
            setError('Failed to load messages. Please try again.');
        }
        finally {
            setLoading(false);
        }
    }, [identifier]);
    const handleSearch = async () => {
        if (!identifier.trim()) {
            setError('Please enter a phone number or email address');
            return;
        }
        await loadMessages();
    };
    return (<main className="min-h-screen bg-black text-white">
      <div className="flex flex-col w-full max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
          <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Enter phone number or email address" className="flex-1 p-2 border rounded-lg text-black" onKeyDown={(e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        }}/>
          <button onClick={handleSearch} disabled={loading || !identifier.trim()} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && (<div className="text-red-500">
            {error}
          </div>)}

        {messages.length > 0 && (<div className="flex space-x-2 mb-4">
            <button onClick={() => setSelectedType('all')} className={`px-3 py-1 rounded-lg ${selectedType === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-black'}`}>
              All
            </button>
            <button onClick={() => setSelectedType('sms')} className={`px-3 py-1 rounded-lg ${selectedType === 'sms'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-100 hover:bg-purple-200 text-black'}`}>
              SMS
            </button>
            <button onClick={() => setSelectedType('email')} className={`px-3 py-1 rounded-lg ${selectedType === 'email'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 hover:bg-blue-200 text-black'}`}>
              Email
            </button>
            <button onClick={() => setSelectedType('call')} className={`px-3 py-1 rounded-lg ${selectedType === 'call'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 hover:bg-green-200 text-black'}`}>
              Calls
            </button>
          </div>)}

        <Timeline messages={filteredMessages}/>
      </div>
    </main>);
}
//# sourceMappingURL=index.jsx.map