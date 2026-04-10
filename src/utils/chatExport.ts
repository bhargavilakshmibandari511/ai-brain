/**
 * Chat Export Utility
 * Export chat history in multiple formats: JSON, Markdown, PDF, CSV, Text
 */

interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  agentTrace?: Array<{
    step: string;
    agent: string;
    detail: string;
    status?: string;
  }>;
  confidence?: number;
  sourceUrl?: string;
  attachedFiles?: string[];
}

/**
 * Download utility - Creates a blob and triggers download
 */
const download = (content: string, filename: string, mimeType: string = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export as JSON (full metadata preserved)
 */
export const exportAsJSON = (messages: Message[], title: string = 'Chat History') => {
  const data = {
    title,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map(m => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    })),
  };
  
  const json = JSON.stringify(data, null, 2);
  download(json, `${title}-${Date.now()}.json`, 'application/json');
};

/**
 * Export as Markdown (human readable)
 */
export const exportAsMarkdown = (messages: Message[], title: string = 'Chat History') => {
  const lines: string[] = [
    `# ${title}`,
    `*Exported: ${new Date().toLocaleString()}*`,
    `*Messages: ${messages.length}*`,
    '',
  ];

  messages.forEach((msg) => {
    lines.push(`## ${msg.type === 'user' ? '👤 You' : '🤖 AI'} ${new Date(msg.timestamp).toLocaleTimeString()}`);
    
    // Add content
    lines.push(msg.content);
    
    // Add source URL if present
    if (msg.sourceUrl) {
      lines.push(`**Source:** ${msg.sourceUrl}`);
    }
    
    // Add agent trace if present
    if (msg.agentTrace && msg.agentTrace.length > 0) {
      lines.push('**Agent Trace:**');
      msg.agentTrace.forEach(trace => {
        lines.push(`- ${trace.step}: ${trace.agent} - ${trace.detail}`);
      });
    }
    
    lines.push('');
  });

  const markdown = lines.join('\n');
  download(markdown, `${title}-${Date.now()}.md`, 'text/markdown');
};

/**
 * Export as plain text
 */
export const exportAsText = (messages: Message[], title: string = 'Chat History') => {
  const lines: string[] = [
    title.toUpperCase(),
    '='.repeat(title.length),
    `Exported: ${new Date().toLocaleString()}`,
    `Messages: ${messages.length}`,
    '',
  ];

  messages.forEach((msg) => {
    lines.push(`[${new Date(msg.timestamp).toLocaleString()}] ${msg.type === 'user' ? 'YOU' : 'AI'}`);
    lines.push(msg.content);
    lines.push('');
  });

  const text = lines.join('\n');
  download(text, `${title}-${Date.now()}.txt`, 'text/plain');
};

/**
 * Export as CSV (for analysis/spreadsheets)
 */
export const exportAsCSV = (messages: Message[], title: string = 'Chat History') => {
  // CSV headers
  const headers = ['Timestamp', 'Type', 'Content', 'Confidence', 'Source URL'];
  const rows: string[][] = [headers];

  messages.forEach((msg) => {
    const timestamp = new Date(msg.timestamp).toISOString();
    const type = msg.type;
    // Escape CSV content (quotes and newlines)
    const content = `"${msg.content.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    const confidence = msg.confidence ? msg.confidence.toString() : '';
    const sourceUrl = msg.sourceUrl || '';

    rows.push([timestamp, type, content, confidence, sourceUrl]);
  });

  const csv = rows.map(row => row.join(',')).join('\n');
  download(csv, `${title}-${Date.now()}.csv`, 'text/csv');
};

/**
 * Export as HTML (formatted page)
 */
export const exportAsHTML = (messages: Message[], title: string = 'Chat History') => {
  const styles = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
    }
    h1 { color: #222; border-bottom: 3px solid #7c3aed; padding-bottom: 10px; }
    .meta { color: #999; font-size: 14px; margin-bottom: 20px; }
    .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
    .user { background: #e0e7ff; border-left: 4px solid #7c3aed; }
    .ai { background: #f3f4f6; border-left: 4px solid #10b981; }
    .timestamp { font-size: 12px; color: #666; margin-bottom: 8px; }
    .content { line-height: 1.6; white-space: pre-wrap; }
    .source { margin-top: 10px; font-size: 12px; color: #0ea5e9; }
    @media print { body { background: white; } }
  `;

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${styles}</style>
</head>
<body>
    <h1>${title}</h1>
    <div class="meta">
        <p>Exported: ${new Date().toLocaleString()} | Messages: ${messages.length}</p>
    </div>
    <div class="messages">
        ${messages.map(msg => `
            <div class="message ${msg.type}">
                <div class="timestamp">${new Date(msg.timestamp).toLocaleString()}</div>
                <div class="content">${msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                ${msg.sourceUrl ? `<div class="source">Source: ${msg.sourceUrl}</div>` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>
  `;

  download(html, `${title}-${Date.now()}.html`, 'text/html');
};

/**
 * Get total tokens estimate (rough calculation)
 */
export const estimateTokens = (messages: Message[]): number => {
  // Very rough estimate: ~4 characters per token
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  return Math.ceil(totalChars / 4);
};

/**
 * Get conversation stats
 */
export const getConversationStats = (messages: Message[]) => {
  const userMessages = messages.filter(m => m.type === 'user');
  const aiMessages = messages.filter(m => m.type === 'ai');
  
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
  
  const duration = firstMessage && lastMessage
    ? new Date(lastMessage.timestamp).getTime() - new Date(firstMessage.timestamp).getTime()
    : 0;

  return {
    totalMessages: messages.length,
    userMessages: userMessages.length,
    aiMessages: aiMessages.length,
    totalTokens: estimateTokens(messages),
    startTime: firstMessage?.timestamp,
    endTime: lastMessage?.timestamp,
    durationMinutes: Math.round(duration / 60000),
  };
};
