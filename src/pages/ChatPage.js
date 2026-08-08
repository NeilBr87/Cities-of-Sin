import React from 'react';
import Chat from '../components/Chat';
import { Card } from '../components/ui';

export default function ChatPage() {
  return (
    <>
      <h1>Chat</h1>
      <p className="flavour" style={{ marginTop: -8 }}>
        Rooms open and close as your life changes. Join a family and the family room appears; get made
        into a crew and the crew room appears; get arrested and the block starts talking to you.
      </p>
      <Card>
        <Chat />
      </Card>
    </>
  );
}
