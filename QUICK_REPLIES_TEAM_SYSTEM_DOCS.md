# Quick Replies & Team System Implementation

## Overview

This document describes the implementation of two new features added to WhatsHybrid Pro:
1. **Quick Replies System** - Fast response templates with `/trigger` shortcuts
2. **Team System** - Broadcast messaging to multiple team members

## Quick Replies System

### Features
- Create quick response templates with trigger keywords
- Real-time autocomplete when typing `/trigger` in WhatsApp
- Tab/Enter to accept suggestions, Escape to close
- Usage statistics tracking
- Persistent storage using Chrome Storage API

### User Interface

#### Location
- Top Panel: Click "Quick Replies" button (⚡ icon)
- Side Panel: View section `whlViewQuickReplies`

#### Components
1. **Add Quick Reply Form**
   - Trigger input: Keyword to activate the reply (without `/` prefix)
   - Response textarea: The message to insert
   - Add button: Saves the quick reply

2. **Quick Replies List**
   - Shows all saved quick replies
   - Displays usage count for each reply
   - Delete button (requires confirmation via double-click)

3. **Statistics**
   - Total replies count
   - Total usage across all replies
   - Most used reply

### Usage Example

1. Create a quick reply:
   - Trigger: `preco`
   - Response: `Nossos preços começam em R$ 99,00. Consulte nossa tabela completa!`

2. In WhatsApp chat, type `/preco`
3. Autocomplete suggestion appears
4. Press Tab or Enter to insert the full response

### Technical Implementation

**File:** `modules/quick-replies.js`

#### Key Components:
- `QuickRepliesSystem` class: Main system controller
- Storage key: `whl_quick_replies`
- MutationObserver: Detects composer changes in real-time
- Fallback polling: Every 5 seconds to catch missed changes
- Suggestion box: Floating overlay positioned above composer

#### Data Structure:
```javascript
{
  id: "qr_1234567890",
  trigger: "preco",
  response: "Full message text...",
  usageCount: 5,
  createdAt: "2024-01-01T00:00:00.000Z"
}
```

#### WhatsApp Selectors:
- `footer div[contenteditable="true"][role="textbox"]`
- `[data-testid="conversation-compose-box-input"]`

## Team System

### Features
- Add/remove team members with name and phone
- Sender name customization (appears as "*Name:* message")
- Select/deselect members for broadcast
- Intelligent delays between messages (3-7s random)
- Success/failure reporting with detailed error messages
- Statistics tracking per member

### User Interface

#### Location
- Top Panel: Click "Equipe" button (👥 icon)
- Side Panel: View section `whlViewTeam`

#### Components
1. **Sender Name Input**
   - Optional field to identify the sender
   - Appears as `*Name:* message` in broadcasts

2. **Add Member Form**
   - Name input: Optional member name
   - Phone input: Required (10-15 digits)
   - Add button: Saves the member

3. **Members List**
   - Checkbox for selection
   - Member name and formatted phone
   - Messages sent count
   - Delete button (requires confirmation)

4. **Broadcast Controls**
   - Select All / Clear Selection buttons
   - Message textarea
   - Send button (requires double-click confirmation)
   - Status display with progress

5. **Statistics**
   - Total members count
   - Currently selected count
   - Total messages sent across all members

### Usage Example

1. Set sender name: `Rede Alabama`
2. Add team members:
   - Name: `João`, Phone: `5511999998888`
   - Name: `Maria`, Phone: `5511988887777`
3. Select members using checkboxes
4. Write message: `Reunião hoje às 14h!`
5. Click "Send" button
6. Click again to confirm (3s timeout)
7. Watch progress in status area

### Technical Implementation

**File:** `modules/team-system.js`

#### Key Components:
- `TeamSystem` class: Main system controller
- Storage keys: `whl_team_members`, `whl_sender_name`
- Smart delays: 3-7 seconds random between sends
- WhatsApp integration: Opens chat and sends message

#### Data Structure:
```javascript
{
  id: "tm_1234567890",
  name: "João",
  phone: "5511999998888",
  selected: false,
  messagesSent: 3,
  lastMessageAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z"
}
```

#### Phone Validation:
- MIN_PHONE_DIGITS: 10 (minimum for most countries)
- MAX_PHONE_DIGITS: 15 (ITU E.164 standard)
- Auto-formatting for Brazilian numbers (55 + DDD + number)

#### Broadcast Process:
1. Open chat using `Store.Cmd.openChatAt()` or URL navigation
2. Wait 2s for chat to load
3. Type message using HumanTyping if available
4. Click send button or use Enter keypress
5. Wait random delay (3-7s) before next member
6. Track success/failure for each member
7. Update statistics and save state

## Integration

### Manifest Changes
Added to `content_scripts` in `manifest.json`:
```json
"modules/quick-replies.js",
"modules/team-system.js"
```

### Router Integration
Added to `VIEW_MAP` in `sidepanel-router.js`:
```javascript
quickreplies: 'whlViewQuickReplies',
team: 'whlViewTeam'
```

### Top Panel Navigation
Added buttons in `content/top-panel-injector.js`:
```html
<button class="top-panel-tab" data-view="quickreplies">
  <span class="tab-icon">⚡</span>
  <span class="tab-label">Quick Replies</span>
</button>
<button class="top-panel-tab" data-view="team">
  <span class="tab-icon">👥</span>
  <span class="tab-label">Equipe</span>
</button>
```

## UX Improvements

### Non-Blocking Feedback
Replaced all `alert()` calls with:
- Button text changes (temporary status messages)
- Status element updates
- Double-click confirmation pattern (3s timeout)

### Performance Optimizations
- Quick Replies: Reduced polling from 2s to 5s
- MutationObserver as primary detection method
- Named constants for validation values

## Security Considerations

### Data Storage
- All data stored locally using Chrome Storage API
- No external API calls for core functionality
- Phone numbers stored as plain text (consider encryption for production)

### Anti-Spam Protection
- Random delays between broadcasts (3-7s)
- User confirmation before sending
- Failed send tracking
- Member-specific statistics

## Future Enhancements

### Quick Replies
- [ ] Import/export quick replies as JSON
- [ ] Categories/tags for organization
- [ ] Search/filter functionality
- [ ] Variables support (e.g., {name}, {date})
- [ ] Rich media support (images, links)

### Team System
- [ ] Group management (multiple teams)
- [ ] Scheduled broadcasts
- [ ] Message templates with variables
- [ ] Analytics dashboard
- [ ] Export send history
- [ ] Rate limiting per hour/day
- [ ] Blacklist/whitelist support

## Troubleshooting

### Quick Replies Not Working
1. Check if composer is detected: Look for `[QuickReplies] Composer anexado` in console
2. Verify storage: Check Chrome DevTools > Application > Storage
3. Clear suggestion box: Press Escape and try again

### Team System Failures
1. Check WhatsApp is logged in
2. Verify phone numbers are correct format
3. Check console for error messages
4. Ensure adequate delays between sends
5. Verify WhatsApp Store API is available

## API Reference

### QuickRepliesSystem

```javascript
// Add a reply
await window.quickReplies.addReply('preco', 'R$ 99,00');

// Get all replies
const replies = window.quickReplies.getAll();

// Get statistics
const stats = window.quickReplies.getStats();

// Remove a reply
await window.quickReplies.removeReply(replyId);
```

### TeamSystem

```javascript
// Add a member
await window.teamSystem.addMember('João', '5511999998888');

// Send to team
const results = await window.teamSystem.sendToTeam('Mensagem');

// Get statistics
const stats = window.teamSystem.getStats();

// Set sender name
await window.teamSystem.setSenderName('Rede Alabama');
```

## Testing

### Manual Testing Checklist

#### Quick Replies
- [ ] Create a quick reply
- [ ] Type `/trigger` in WhatsApp composer
- [ ] Verify autocomplete appears
- [ ] Accept with Tab/Enter
- [ ] Verify message is inserted
- [ ] Check usage count increases
- [ ] Delete a quick reply

#### Team System
- [ ] Add team member with valid phone
- [ ] Try adding duplicate (should fail)
- [ ] Try invalid phone (should fail)
- [ ] Select/deselect members
- [ ] Set sender name
- [ ] Send test broadcast to yourself
- [ ] Verify delays work
- [ ] Check statistics update
- [ ] Delete a member

## Change Log

### Version 1.0.0 (2024-01-04)
- Initial implementation of Quick Replies System
- Initial implementation of Team System
- Added navigation buttons in top panel
- Added UI in side panel
- Integrated with WhatsApp Web
- Added comprehensive documentation

## Contributors

- GitHub Copilot (Implementation)
- sevadarkness (Review & Testing)
