import { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/authContext';

const Messages = () => {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selectedConversationKey, setSelectedConversationKey] = useState('');
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState('');

  const messagesBaseUrl = import.meta.env.VITE_REACT_APP_LOGIN_URL.replace('/login', '') + '/messages';
  const headers = useMemo(() => ({ Authorization: `Bearer ${user?.token}` }), [user]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(messagesBaseUrl, { headers });
      const nextConversations = Array.isArray(res.data) ? res.data : [];
      setConversations(nextConversations);
      setError('');

      const targetJobId = searchParams.get('jobId');
      const targetParticipantId = searchParams.get('participantId');
      const matchedConversation = nextConversations.find((conversation) => (
        (!targetJobId || String(conversation.job?._id) === String(targetJobId))
        && (!targetParticipantId || String(conversation.participant?._id) === String(targetParticipantId))
      ));
      const existingConversation = nextConversations.find((conversation) => conversation.conversationKey === selectedConversationKey);

      const fallbackConversation = nextConversations[0];
      const selected = matchedConversation || existingConversation || fallbackConversation;
      if (selected) {
        setSelectedConversationKey(selected.conversationKey);
      }
    } catch (err) {
      setConversations([]);
      setError(err.response?.data?.message || 'Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  };

  const selectedConversation = conversations.find((conversation) => conversation.conversationKey === selectedConversationKey) || null;

  const fetchThread = async (conversation) => {
    if (!conversation?.job?._id || !conversation?.participant?._id) return;
    setThreadLoading(true);
    try {
      const res = await axios.get(`${messagesBaseUrl}/${conversation.job._id}/${conversation.participant._id}`, { headers });
      setThread(Array.isArray(res.data) ? res.data : []);
      await axios.patch(`${messagesBaseUrl}/${conversation.job._id}/${conversation.participant._id}/read`, {}, { headers });
      setConversations((current) => current.map((item) => (
        item.conversationKey === conversation.conversationKey
          ? { ...item, unreadCount: 0 }
          : item
      )));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load conversation thread.');
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchConversations();
    }, 20000);

    return () => window.clearInterval(timer);
  }, [user, selectedConversationKey, searchParams]);

  useEffect(() => {
    if (selectedConversation) {
      fetchThread(selectedConversation);
    }
  }, [selectedConversationKey]);

  const handleSend = async () => {
    if (!draft.trim() || !selectedConversation) return;

    try {
      await axios.post(messagesBaseUrl, {
        receiverId: selectedConversation.participant?._id,
        jobId: selectedConversation.job?._id,
        content: draft.trim()
      }, { headers });

      setDraft('');
      await fetchThread(selectedConversation);
      await fetchConversations();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message.');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 py-12 text-center text-gray-500">Loading inbox...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
            <span className="text-sm text-gray-500">{conversations.length} thread{conversations.length === 1 ? '' : 's'}</span>
          </div>
          <div className="space-y-3">
            {conversations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">No conversations yet.</div>
            ) : conversations.map((conversation) => (
              <button
                key={conversation.conversationKey}
                type="button"
                onClick={() => setSelectedConversationKey(conversation.conversationKey)}
                className={`w-full text-left rounded-xl border p-4 transition ${
                  selectedConversationKey === conversation.conversationKey
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-900">{conversation.participant?.name || 'Participant'}</div>
                    <div className="text-xs text-gray-500 mt-1">{conversation.job?.title || 'Job conversation'}</div>
                  </div>
                  {conversation.unreadCount > 0 && (
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-3 line-clamp-2">{conversation.lastMessage?.content}</div>
                <div className="text-xs text-gray-400 mt-2">
                  {conversation.lastMessage?.createdAt ? new Date(conversation.lastMessage.createdAt).toLocaleString() : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col min-h-[640px]">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">Select a conversation to read messages.</div>
          ) : (
            <>
              <div className="border-b border-gray-200 pb-4 mb-4">
                <div className="text-xl font-bold text-gray-900">{selectedConversation.participant?.name}</div>
                <div className="text-sm text-gray-500 mt-1">{selectedConversation.job?.title}</div>
                {selectedConversation.unreadCount > 0 && (
                  <div className="text-xs text-amber-600 mt-2">
                    {selectedConversation.unreadCount} unread message{selectedConversation.unreadCount === 1 ? '' : 's'} when opened
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {threadLoading ? (
                  <div className="text-sm text-gray-500">Loading messages...</div>
                ) : thread.length === 0 ? (
                  <div className="text-sm text-gray-500">No messages in this thread yet.</div>
                ) : thread.map((message) => {
                  const mine = String(message.sender?._id) === String(user?.user?.id);
                  return (
                    <div key={message._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${mine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                        <div className="text-sm">{message.content}</div>
                        <div className={`text-xs mt-2 ${mine ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(message.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4">
                {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
                <div className="flex gap-3">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows="3"
                    placeholder="Write a message..."
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    className="self-end px-5 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
