'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import DashboardHero from '@/components/layout/DashboardHero';
import { MessageSquare, Send, User, RefreshCw } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface Contact {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  role: string;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  specialization?: string;
  bloodGroup?: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  sender?: {
    name: string;
    profileImage?: string;
    role: string;
  };
}

export default function ChatPage() {
  const { data: session } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch contacts based on user role
  const fetchContacts = useCallback(async () => {
    if (!session?.user) return;
    
    try {
      const res = await fetch('/api/chat/contacts');
      const data = await res.json();
      
      if (data.data) {
        setContacts(data.data);
        
        // Auto-select first contact if none selected
        if (data.data.length > 0 && !selectedContact) {
          setSelectedContact(data.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user, selectedContact]);

  // Fetch messages for selected contact
  const fetchMessages = useCallback(async (contactId: string) => {
    if (!contactId) return;
    
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat?userId=${contactId}`);
      const data = await res.json();
      setMessages(data.data || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (session?.user) {
      fetchContacts();
    }
  }, [session?.user, fetchContacts]);

  // Fetch messages when contact is selected
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
    }
  }, [selectedContact, fetchMessages]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!selectedContact) return;
    
    const interval = setInterval(() => {
      fetchMessages(selectedContact.id);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [selectedContact, fetchMessages]);

  // Refresh contacts every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchContacts();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [fetchContacts]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact || sendingMessage) return;

    setSendingMessage(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: selectedContact.id,
          message: newMessage.trim(),
        }),
      });

      if (res.ok) {
        setNewMessage('');
        // Immediately fetch new messages
        await fetchMessages(selectedContact.id);
      } else {
        const error = await res.json();
        console.error('Failed to send message:', error);
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setMessages([]);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'MOTHER': return 'Mother';
      case 'MIDWIFE': return 'Midwife';
      case 'ADMIN': return 'Admin';
      default: return role;
    }
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'success' | 'info' | 'warning' | 'danger' => {
    switch (role) {
      case 'MIDWIFE': return 'success';
      case 'MOTHER': return 'info';
      case 'ADMIN': return 'warning';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Messages"
        subtitle={
          session?.user?.role === 'MOTHER'
            ? 'Chat with your assigned midwife'
            : session?.user?.role === 'MIDWIFE'
            ? 'Chat with your assigned mothers'
            : 'Communicate directly with registered members'
        }
        pillLabel="Live Chat"
        actions={(
          <Button
            variant="outline"
            className="!bg-white hover:!bg-gray-100 !text-gray-900 font-bold rounded-xl !border !border-gray-200 shadow-sm transition-all cursor-pointer"
            onClick={() => fetchContacts()}
          >
            <RefreshCw className="h-4 w-4 mr-2 text-gray-700" />
            Refresh
          </Button>
        )}
      />

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-270px)] min-h-[520px]">
        {/* Contacts List */}
        <Card className="w-80 flex-shrink-0 overflow-hidden flex flex-col">
          <CardHeader className="border-b">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Contacts</span>
              <span className="text-xs text-gray-500 font-normal">{contacts.length} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {contacts.length > 0 ? (
              <div className="divide-y">
                {contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleContactSelect(contact)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left ${
                      selectedContact?.id === contact.id ? 'bg-teal-50 border-l-4 border-l-teal-500' : ''
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      {contact.profileImage ? (
                        <img 
                          src={contact.profileImage} 
                          alt={contact.name} 
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-teal-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 truncate">{contact.name}</p>
                        {contact.unreadCount && contact.unreadCount > 0 && (
                          <span className="bg-teal-500 text-white text-xs rounded-full px-2 py-0.5">
                            {contact.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={getRoleBadgeVariant(contact.role)} className="text-xs">
                          {getRoleLabel(contact.role)}
                        </Badge>
                        {contact.specialization && (
                          <span className="text-xs text-gray-400">{contact.specialization}</span>
                        )}
                      </div>
                      {contact.lastMessage && (
                        <p className="text-xs text-gray-500 truncate mt-1">
                          {contact.lastMessage}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No contacts available</p>
                <p className="text-sm mt-1">
                  {session?.user?.role === 'MOTHER' 
                    ? 'You need to be assigned a midwife to chat'
                    : session?.user?.role === 'MIDWIFE'
                    ? 'No mothers have been assigned to you yet'
                    : 'No conversations yet'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {selectedContact ? (
            <>
              <CardHeader className="border-b flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center">
                    {selectedContact.profileImage ? (
                      <img 
                        src={selectedContact.profileImage} 
                        alt={selectedContact.name} 
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-teal-600" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">{selectedContact.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={getRoleBadgeVariant(selectedContact.role)} className="text-xs">
                        {getRoleLabel(selectedContact.role)}
                      </Badge>
                      <span className="text-xs text-gray-500">{selectedContact.email}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                  </div>
                ) : messages.length > 0 ? (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.senderId === session?.user?.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            message.senderId === session?.user?.id
                              ? 'bg-teal-600 text-white rounded-br-none'
                              : 'bg-gray-100 text-gray-900 rounded-bl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.message}</p>
                          <p
                            className={`text-xs mt-1 ${
                              message.senderId === session?.user?.id
                                ? 'text-teal-100'
                                : 'text-gray-400'
                            }`}
                          >
                            {formatDateTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <MessageSquare className="h-12 w-12 text-gray-300 mb-3" />
                    <p className="font-medium">No messages yet</p>
                    <p className="text-sm">Start the conversation by sending a message!</p>
                  </div>
                )}
              </CardContent>
              
              <div className="border-t p-4 flex-shrink-0">
                <form onSubmit={sendMessage} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={sendingMessage}
                  />
                  <Button 
                    type="submit" 
                    disabled={!newMessage.trim() || sendingMessage}
                  >
                    {sendingMessage ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a contact to start chatting</p>
                <p className="text-sm mt-1">Choose from your contacts on the left</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
