'use client';
import { useCallback, useState, useEffect, useMemo, Suspense } from 'react';
import Timeline from '@/components/Timeline/Timeline';
import { APIClient } from '@/lib/api/client';
import { useSearchParams } from 'next/navigation';
export default function Page() {
    return (<Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>);
}
function HomeContent() {
    const [identifier, setIdentifier] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedType, setSelectedType] = useState('all');
    const searchParams = useSearchParams();
    const filteredMessages = useMemo(() => {
        if (selectedType === 'all')
            return messages;
        return messages.filter(msg => msg.type === selectedType);
    }, [messages, selectedType]);
    const loadMessages = useCallback(async (searchIdentifier) => {
        if (!searchIdentifier.trim())
            return;
        setLoading(true);
        setError(null);
        try {
            // First, try to get associated identifiers from Segment
            console.log('Loading identifiers from Segment:', searchIdentifier);
            const segmentResponse = await fetch(`/api/segment/external-ids?identifier=${encodeURIComponent(searchIdentifier)}`);
            if (!segmentResponse.ok) {
                throw new Error(`Failed to load Segment identifiers: ${segmentResponse.statusText}`);
            }
            const segmentData = await segmentResponse.json();
            console.log('Segment data:', segmentData);
            // Now fetch messages for all identifiers
            const apiClient = APIClient.getInstance();
            const result = await apiClient.getMessages({
                emailAddress: searchIdentifier.includes('@') ? searchIdentifier : undefined,
                phoneNumber: searchIdentifier.includes('@') ? undefined : searchIdentifier,
                associatedIdentifiers: segmentData.identifiers || [],
            });
            console.log('Messages loaded:', result.messages.length);
            setMessages(result.messages);
            setError(null);
        }
        catch (err) {
            console.error('Error loading messages:', err);
            setError('Failed to load messages. Please try again.');
            setMessages([]);
        }
        finally {
            setLoading(false);
        }
    }, []);
    const handleSearch = async () => {
        await loadMessages(identifier);
    };
    // Check for query parameter on initial load
    useEffect(() => {
        const query = searchParams.get('q');
        if (query) {
            setIdentifier(query);
            loadMessages(query);
        }
    }, [searchParams, loadMessages]);
    return (<main className="min-h-screen">
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
//# sourceMappingURL=page.jsx.map