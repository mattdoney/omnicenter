import React from 'react';
import { UnifiedMessage } from '@/types/messages';
import EmailIcon from '@mui/icons-material/Email';
import SmsIcon from '@mui/icons-material/Sms';
import PhoneIcon from '@mui/icons-material/Phone';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

interface TimelineProps {
  messages: UnifiedMessage[];
  loading?: boolean;
}

interface MessageGroup {
  date: string;
  messages: UnifiedMessage[];
}

export default function Timeline({ messages = [], loading = false }: TimelineProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="flex justify-center items-center h-full text-gray-500">
        No messages found
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups: MessageGroup[], message) => {
    const date = new Date(message.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const existingGroup = groups.find(g => g.date === dateStr);
    if (existingGroup) {
      existingGroup.messages.push(message);
    } else {
      groups.push({ date: dateStr, messages: [message] });
    }
    return groups;
  }, []);

  const getMessageStyle = (message: UnifiedMessage) => {
    const baseStyle = {
      display: 'flex',
      flexDirection: 'column' as const,
      padding: '8px 12px',
      borderRadius: '12px',
      marginBottom: '8px',
      maxWidth: '80%',
      wordWrap: 'break-word' as const,
    };

    const getColor = (type: string, direction: string) => {
      switch (type) {
        case 'sms':
          return direction === 'outbound' ? '#9c27b0' : '#f5f5f5';
        case 'email':
          return direction === 'outbound' ? '#1976d2' : '#e3f2fd';
        case 'call':
          return direction === 'outbound' ? '#2e7d32' : '#e8f5e9';
        case 'whatsapp':
          return direction === 'outbound' ? '#2e7d32' : '#e8f5e9';
        default:
          return direction === 'outbound' ? '#9c27b0' : '#f5f5f5';
      }
    };

    const color = getColor(message.type, message.direction);
    
    return {
      ...baseStyle,
      alignSelf: message.direction === 'outbound' ? 'flex-end' : 'flex-start',
      backgroundColor: color,
      color: message.direction === 'outbound' ? '#ffffff' : '#000000',
    };
  };

  const getMessageIcon = (type: string) => {
    const iconProps = {
      className: "mr-2",
      fontSize: "small" as const,
      style: { verticalAlign: 'middle' }
    };

    switch (type) {
      case 'sms':
        return <SmsIcon {...iconProps} />;
      case 'email':
        return <EmailIcon {...iconProps} />;
      case 'call':
        return <PhoneIcon {...iconProps} />;
      case 'whatsapp':
        return <WhatsAppIcon {...iconProps} />;
      default:
        return <SmsIcon {...iconProps} />;
    }
  };

  return (
    <div className="flex flex-col space-y-6 p-4">
      {groupedMessages.map((group, groupIndex) => (
        <div key={group.date} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-grow h-px bg-gray-200"></div>
            <div className="text-sm font-medium text-gray-500">
              {group.date}
            </div>
            <div className="flex-grow h-px bg-gray-200"></div>
          </div>

          {group.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                style={getMessageStyle(message)}
              >
                <div className="text-sm flex items-center">
                  {getMessageIcon(message.type)}
                  <span>{message.body}</span>
                </div>
                {message.type === 'call' && (
                  <div className="flex flex-col gap-1">
                    {message.userDisplayName && (
                      <div className={`text-xs ${message.direction === 'outbound' ? 'text-gray-200' : 'text-gray-500'}`}>
                        Agent: {message.userDisplayName}
                      </div>
                    )}
                    {message.duration !== undefined && (
                      <div className={`text-xs ${message.direction === 'outbound' ? 'text-gray-200' : 'text-gray-500'}`}>
                        Duration: {Math.floor(message.duration / 60)}:{(message.duration % 60).toString().padStart(2, '0')}
                      </div>
                    )}
                  </div>
                )}
                {message.status && (
                  <div className={`text-xs mt-1 ${message.direction === 'outbound' ? 'text-gray-200' : 'text-gray-500'}`}>
                    Status: {message.status}
                  </div>
                )}
                <div
                  className={`text-xs mt-1 ${message.direction === 'outbound' ? 'text-gray-200' : 'text-gray-500'}`}
                >
                  {message.timestamp instanceof Date
                    ? message.timestamp.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })
                    : new Date(message.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
