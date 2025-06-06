import { google } from 'googleapis';
import { getOAuth2Client } from './oauth2';
import { getFreshTokensForEmail, storeTokensForEmail } from './token-storage';

export async function getGmailClient(tokens: any) {
  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials(tokens);
  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

export async function setupGmailWatch(tokens: any) {
  const gmail = await getGmailClient(tokens);
  
  const request = {
    userId: 'me',
    requestBody: {
      topicName: process.env.GMAIL_WATCH_TOPIC,
      labelIds: ['INBOX'], // Only watch INBOX
    },
  };

  try {
    const response = await gmail.users.watch(request);
    console.log('Gmail watch setup successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to setup Gmail watch:', error);
    throw error;
  }
}

export async function fetchNewMessages(gmail: any, historyId: string) {
  try {
    const response = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded'],
    });
    
    return response.data.history || [];
  } catch (error) {
    console.error('Failed to fetch new messages:', error);
    return [];
  }
}

export async function getMessage(gmail: any, messageId: string) {
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    
    return response.data;
  } catch (error) {
    console.error('Failed to get message:', error);
    return null;
  }
}

export async function downloadAttachment(gmail: any, messageId: string, attachmentId: string) {
  try {
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId
    });
    
    return response.data;
  } catch (error) {
    console.error('Failed to download attachment:', error);
    return null;
  }
}

export function extractAttachmentsFromMessage(message: any) {
  const attachments: Array<{
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
  }> = [];

  function processPayload(payload: any) {
    if (payload.parts) {
      payload.parts.forEach((part: any) => {
        if (part.body && part.body.attachmentId) {
          attachments.push({
            attachmentId: part.body.attachmentId,
            filename: part.filename || 'unknown',
            mimeType: part.mimeType || 'unknown',
            size: part.body.size || 0
          });
        }
        if (part.parts) {
          processPayload(part);
        }
      });
    } else if (payload.body && payload.body.attachmentId) {
      attachments.push({
        attachmentId: payload.body.attachmentId,
        filename: payload.filename || 'unknown',
        mimeType: payload.mimeType || 'unknown',
        size: payload.body.size || 0
      });
    }
  }

  processPayload(message.payload);
  return attachments;
}

export function isInvoiceFile(filename: string, mimeType: string): boolean {
  // Allow any PDF file as an invoice
  if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    return true;
  }
  // Otherwise, use previous logic for images and keywords
  const invoiceKeywords = ['invoice', 'bill', 'receipt', 'statement'];
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
  const hasInvoiceKeyword = invoiceKeywords.some(keyword => 
    filename.toLowerCase().includes(keyword)
  );
  const isValidMimeType = validMimeTypes.includes(mimeType);
  if (hasInvoiceKeyword && isValidMimeType) {
    return true;
  }
  // Log if skipped
  console.log(`[isInvoiceFile] Skipping file: ${filename} (${mimeType}) - Not recognized as invoice`);
  return false;
}

// Enhanced Gmail client function that automatically handles token refresh
export async function getGmailClientForEmail(email: string) {
  const tokens = await getFreshTokensForEmail(email);
  if (!tokens) {
    throw new Error(`No valid tokens found for ${email}. Please re-authenticate.`);
  }
  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials(tokens);
  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

export async function sendEmail(email: string, rawMessage: string) {
  const gmail = await getGmailClientForEmail(email);
  return gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawMessage }
  });
}

// Enhanced function with automatic token refresh and persistence
export async function getFreshGmailClient(tokens: any, email: string) {
  const oAuth2Client = getOAuth2Client();
  
  if (!tokens.refresh_token) {
    throw new Error(`No refresh token available for ${email}. Re-authentication required.`);
  }

  // Set refresh token to enable automatic refreshing
  oAuth2Client.setCredentials({ refresh_token: tokens.refresh_token });

  try {
    // Refresh the access token
    const { credentials } = await oAuth2Client.refreshAccessToken();
    console.log(`🔄 Successfully refreshed access token for ${email}`);

    // Save new access token and expiry to Supabase
    await storeTokensForEmail(email, {
      ...tokens,
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
      refresh_token: tokens.refresh_token, // Preserve refresh token
    });

    // Set the fresh credentials
    oAuth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: credentials.expiry_date,
    });

    return google.gmail({ version: 'v1', auth: oAuth2Client });
    
  } catch (error) {
    console.error(`❌ Failed to refresh token for ${email}:`, error);
    throw new Error(`Token refresh failed for ${email}. Re-authentication may be required.`);
  }
} 