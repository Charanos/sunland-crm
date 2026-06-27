// ─── Sunland ERP — Shared Messaging Data ─────────────────────────────────────
// Single source of truth for messaging mock data.
// Import from here in both global-chat-widget.tsx and admin/messages/page.tsx.

export interface DmContact {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  online: boolean;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  unread: number;
  lastActivity: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string;
  content: string;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
  isMe: boolean;
  type: "text" | "system";
}

export const MOCK_DMS: DmContact[] = [
  {
    id: "dm1",
    name: "Paul Amos",
    role: "Chief Executive Officer",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    lastMessage: "I've reviewed the Q3 projections.",
    lastMessageTime: "10:28 AM",
    unread: 2,
    online: true,
  },
  {
    id: "dm2",
    name: "Grace Mutua",
    role: "General Manager",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
    lastMessage: "Can we review the Muthaiga lease terms?",
    lastMessageTime: "09:15 AM",
    unread: 0,
    online: true,
  },
  {
    id: "dm3",
    name: "Dennis Munge",
    role: "Head of Finance",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    lastMessage: "Payment for KES 150k received and logged.",
    lastMessageTime: "Yesterday",
    unread: 0,
    online: false,
  },
  {
    id: "dm4",
    name: "Cody Fisher",
    role: "Head of Human Resources",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    lastMessage: "The new hire contracts are ready.",
    lastMessageTime: "Yesterday",
    unread: 1,
    online: false,
  },
  {
    id: "dm5",
    name: "Jared Omondi",
    role: "Line Manager / Business Dev",
    avatarUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&h=100&fit=crop&crop=face",
    lastMessage: "Met with the client, waiting on the proposal.",
    lastMessageTime: "Yesterday",
    unread: 0,
    online: false,
  },
  {
    id: "dm6",
    name: "Sharon Koech",
    role: "Front Office Lead",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    lastMessage: "Visitor for Unit 4B arrived.",
    lastMessageTime: "Tuesday",
    unread: 0,
    online: false,
  },
];

export const MOCK_CHANNELS: Channel[] = [
  {
    id: "c1",
    name: "operations-team",
    description: "Day-to-day ops coordination",
    memberCount: 12,
    unread: 5,
    lastActivity: "10 min ago",
  },
  {
    id: "c2",
    name: "sales-pipeline",
    description: "BD team deals & leads",
    memberCount: 8,
    unread: 0,
    lastActivity: "1 hour ago",
  },
  {
    id: "c3",
    name: "executive-board",
    description: "Strategic decisions & reports",
    memberCount: 4,
    unread: 1,
    lastActivity: "2 hours ago",
  },
  {
    id: "c4",
    name: "finance-alerts",
    description: "Financial flags & approvals",
    memberCount: 6,
    unread: 3,
    lastActivity: "30 min ago",
  },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  dm1: [
    {
      id: "m1",
      conversationId: "dm1",
      senderId: "dm1",
      senderName: "Amina Hassan",
      senderAvatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
      content: "Hey! Did you check the new maintenance log for Westlands Tower?",
      sentAt: "2026-06-26T07:24:00Z",
      isMe: false,
      type: "text",
    },
    {
      id: "m2",
      conversationId: "dm1",
      senderId: "me",
      senderName: "You",
      senderAvatarUrl: "",
      content: "Just looking at it now. The plumbing issue on 4B right?",
      sentAt: "2026-06-26T07:26:00Z",
      deliveredAt: "2026-06-26T07:26:01Z",
      isMe: true,
      type: "text",
    },
    {
      id: "m3",
      conversationId: "dm1",
      senderId: "dm1",
      senderName: "Amina Hassan",
      senderAvatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
      content: "Yes exactly. I've assigned the contractor for ticket #421. Should be fixed by tomorrow.",
      sentAt: "2026-06-26T07:28:00Z",
      isMe: false,
      type: "text",
    },
  ],
  dm2: [
    {
      id: "m4",
      conversationId: "dm2",
      senderId: "dm2",
      senderName: "James Mutua",
      senderAvatarUrl: "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=100&h=100&fit=crop&crop=faces",
      content: "Can we review the Muthaiga lease? Client wants an extension.",
      sentAt: "2026-06-26T09:15:00Z",
      isMe: false,
      type: "text",
    },
  ],
  dm3: [
    {
      id: "m5",
      conversationId: "dm3",
      senderId: "dm3",
      senderName: "Grace Omondi",
      senderAvatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces",
      content: "Payment for KES 150k received. Logged as JE-1045.",
      sentAt: "2026-06-25T14:30:00Z",
      isMe: false,
      type: "text",
    },
    {
      id: "m6",
      conversationId: "dm3",
      senderId: "me",
      senderName: "You",
      senderAvatarUrl: "",
      content: "Perfect, thanks Grace. Please also send the remittance slip to the landlord.",
      sentAt: "2026-06-25T14:45:00Z",
      deliveredAt: "2026-06-25T14:45:01Z",
      isMe: true,
      type: "text",
    },
  ],
  dm4: [
    {
      id: "m7",
      conversationId: "dm4",
      senderId: "dm4",
      senderName: "Peter Kariuki",
      senderAvatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces",
      content: "Maintenance team dispatched to Westlands Tower. ETA 2 hours.",
      sentAt: "2026-06-25T11:00:00Z",
      isMe: false,
      type: "text",
    },
  ],
};

export const MOCK_ALERTS = [
  { id: "al1", title: "Payroll approval pending", body: "June payroll PR-2026-06 awaiting GM sign-off.", time: "5 min ago", read: false },
  { id: "al2", title: "Cheque CHQ-0098 flagged", body: "High-value cheque requires dual authorization.", time: "1 hour ago", read: false },
  { id: "al3", title: "Mandate MDT-005 submitted", body: "Kilimani Heights mandate pending activation.", time: "3 hours ago", read: true },
];
