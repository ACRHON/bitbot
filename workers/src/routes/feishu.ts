/**
 * Feishu Webhook Handler
 * Receives events from Feishu platform
 */

import { Env } from '../db/queries';
import {
  getInstitutionByAppId,
  getAuthorizedUser,
  getAttendanceSession,
  updateAttendanceSession,
  createAttendanceSession,
} from '../db/queries';
import { FeishuConfig } from '../services/feishu-api';
import { sendAttendanceCard, getUserInfo, sendTextMessage } from '../services/feishu-api';
import * as bitable from '../services/bitable';

/**
 * Decrypt Feishu encrypted request body using Web Crypto API
 * Feishu sends encrypted payloads when encryptKey is configured
 */
async function decryptRequest(body: string, encryptKey: string): Promise<any> {
  // Import the key using Web Crypto (SHA256 hash of encryptKey)
  const keyBuffer = new TextEncoder().encode(encryptKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBuffer);
  const cryptoKey = await crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-CBC' }, false, ['decrypt']);

  // Base64 decode using atob and convert to Uint8Array
  const encryptBuffer = Uint8Array.from(atob(body), c => c.charCodeAt(0));

  const iv = encryptBuffer.slice(0, 16);
  const encryptedData = encryptBuffer.slice(16);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: iv },
    cryptoKey,
    encryptedData
  );

  const decrypted = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decrypted);
}

export async function handleFeishuWebhook(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  console.log('=== Feishu Webhook Request ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', request.method);
  console.log('Path:', path);
  console.log('URL:', request.url);

  // Route: POST /webhook/feishu or POST /webhook/feishu/{app_id}
  if (request.method === 'POST' && path.startsWith('/webhook/feishu')) {
    console.log('Routing to handleEvent');
    return handleEvent(env, request);
  }

  // Route: GET /webhook/feishu or GET /webhook/feishu/{app_id}
  if (request.method === 'GET' && path.startsWith('/webhook/feishu')) {
    console.log('Routing to handleVerification');
    return handleVerification(env, request);
  }

  console.log('No route matched, returning 404');
  return new Response('Not Found', { status: 404 });
}

async function handleVerification(
  env: Env,
  request: Request
): Promise<Response> {
  console.log('=== handleVerification START ===');
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // pathParts: ['webhook', 'feishu'] or ['webhook', 'feishu', '{app_id}']
  const pathAppId = pathParts.length > 2 ? pathParts[2] : null;

  const params = url.searchParams;

  const challenge = params.get('challenge');
  const verificationToken = params.get('verification_token');
  const appId = params.get('app_id') || request.headers.get('x-feishu-app-id') || pathAppId;

  console.log('Verification params:');
  console.log('  - challenge:', challenge);
  console.log('  - verification_token:', verificationToken ? '***(provided)***' : '(not provided)');
  console.log('  - app_id from query:', params.get('app_id') || '(not provided)');
  console.log('  - app_id from header:', request.headers.get('x-feishu-app-id') || '(not provided)');
  console.log('  - app_id from path:', pathAppId || '(not provided)');
  console.log('  - final app_id:', appId || '(not provided)');

  // If app_id is provided, verify it exists and check verification_token
  if (appId) {
    console.log('Looking up institution for appId:', appId);
    const institution = await getInstitutionByAppId(env, appId);
    console.log('Institution found:', institution ? 'YES' : 'NO');
    if (institution) {
      console.log('Institution name:', institution.name);
      console.log('Stored verification_token:', institution.feishu_verification_token ? 'exists' : 'not set');
    }

    if (!institution) {
      console.log('Returning 404: Institution not found');
      return new Response(JSON.stringify({ error: 'Institution not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify token if provided
    if (verificationToken && institution.feishu_verification_token) {
      console.log('Comparing verification_token...');
      console.log('  - Provided:', verificationToken);
      console.log('  - Stored:', institution.feishu_verification_token);
      console.log('  - Match:', verificationToken === institution.feishu_verification_token ? 'YES' : 'NO');
      if (verificationToken !== institution.feishu_verification_token) {
        console.log('Returning 403: Invalid verification token');
        return new Response(JSON.stringify({ error: 'Invalid verification token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  // Return challenge if provided
  if (challenge) {
    console.log('=== Returning challenge response ===');
    console.log('Response body:', JSON.stringify({ challenge }));
    const response = new Response(JSON.stringify({ challenge }), {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('handleVerification END - returning 200');
    return response;
  }

  console.log('=== Returning empty response (code: 0) ===');
  return new Response(JSON.stringify({ code: 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleEvent(env: Env, request: Request): Promise<Response> {
  console.log('=== handleEvent START ===');

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // pathParts: ['webhook', 'feishu'] or ['webhook', 'feishu', '{app_id}']
    const pathAppId = pathParts.length > 2 ? pathParts[2] : null;
    console.log('Path app_id:', pathAppId || '(not provided)');

    const body = await request.text();
    console.log('Request body received, length:', body?.length || 0);
    console.log('Request body:', body);

    // Check if body is empty
    if (!body || body.trim() === '') {
      console.log('Body is empty, returning 400');
      return new Response(JSON.stringify({ error: 'Empty request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let data: any;
    try {
      data = JSON.parse(body);
      console.log('JSON parsed successfully');
      console.log('Parsed data keys:', Object.keys(data));
      console.log('Has encrypt field:', 'encrypt' in data);
      console.log('Has type field:', 'type' in data);
      console.log('Has challenge field:', 'challenge' in data);
      console.log('Has app_id field:', 'app_id' in data);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Body:', body);
      return new Response(JSON.stringify({ error: 'Invalid JSON', received: body.substring(0, 100) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get app_id from header, body, or URL path (for multi-tenant)
    const appId = request.headers.get('x-feishu-app-id') || data?.app_id || pathAppId;
    console.log('Final app_id:', appId || '(not provided)');
    console.log('app_id:', appId || '(not found)');
    console.log('x-feishu-app-id header:', request.headers.get('x-feishu-app-id') || '(not found)');

    // If encrypt field is present, we need to decrypt first
    // The decrypt key is determined by the app_id from header or body
    if (data?.encrypt) {
      console.log('=== Processing encrypted request ===');
      console.log('Encrypt field present, length:', data.encrypt.length);

      // We need app_id to find the institution and get encrypt_key
      if (!appId) {
        console.log('ERROR: Missing app_id for decryption');
        return new Response(JSON.stringify({ error: 'Missing app_id for decryption' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log('Looking up institution for appId:', appId);
      const institution = await getInstitutionByAppId(env, appId);
      console.log('Institution found:', institution ? 'YES - ' + institution.name : 'NO');

      if (!institution) {
        console.log('ERROR: Institution not found');
        return new Response(JSON.stringify({ error: 'Institution not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log('feishu_encrypt_key exists:', !!institution?.feishu_encrypt_key);

      if (institution?.feishu_encrypt_key) {
        console.log('Attempting to decrypt with encrypt_key length:', institution.feishu_encrypt_key.length);
        try {
          data = await decryptRequest(data.encrypt, institution.feishu_encrypt_key);
          console.log('Decryption successful');
          console.log('Decrypted data:', JSON.stringify(data));
        } catch (decryptError) {
          console.error('Decrypt error:', decryptError);
          console.error('Error name:', (decryptError as Error)?.name);
          console.error('Error message:', (decryptError as Error)?.message);
          return new Response(JSON.stringify({ error: 'Decryption failed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Check if this is a URL verification request (type = url_verification)
    // Feishu sends POST with type="url_verification" for URL verification
    console.log('=== Checking url_verification ===');
    console.log('data?.type:', data?.type);
    console.log('data?.challenge:', data?.challenge);
    console.log('Is url_verification:', data?.type === 'url_verification' && data?.challenge);

    if (data?.type === 'url_verification' && data?.challenge) {
      console.log('=== Returning challenge response ===');
      console.log('Response body:', JSON.stringify({ challenge: data.challenge }));
      const response = new Response(JSON.stringify({ challenge: data.challenge }), {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('handleEvent END - returning 200');
      return response;
    }

    // For non-encrypted requests, app_id is still required
    if (!data?.encrypt && !appId) {
      return new Response(JSON.stringify({ error: 'Missing app_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get institution if not already fetched
    const institution = appId ? await getInstitutionByAppId(env, appId) : null;
    if (appId && !institution) {
      return new Response(JSON.stringify({ error: 'Institution not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if institution is active
    if (institution && institution.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Institution suspended or expired' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const eventType = data?.event_type || data?.header?.event_type;

    // Handle card.action.trigger event
    if (eventType === 'card.action.trigger_v1' || eventType === 'card.action.trigger') {
      return await handleCardActionTrigger(env, institution, data);
    }

    // Handle im.message.receive_v1
    if (eventType === 'im.message.receive_v1') {
      return await handleMessageReceive(env, institution, data);
    }

    return new Response(JSON.stringify({ code: 0, message: 'Event processed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Feishu webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal error', message: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleCardActionTrigger(
  env: Env,
  institution: any,
  data: any
): Promise<Response> {
  const action = data?.action?.value?.action || data?.action?.value?.action;
  const sessionId = data?.action?.value?.session_id;
  const recordId = data?.action?.value?.record_id;
  const openId = data?.header?.operator_id || data?.context?.operator_id;
  const openMessageId = data?.context?.open_message_id;

  // Validate required fields
  if (!action || !openId) {
    return new Response(
      JSON.stringify({ toast: { type: 'error', content: 'Invalid action data' } }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check authorization
  const user = await getAuthorizedUser(env, openId);
  if (!user) {
    return new Response(
      JSON.stringify({
        toast: { type: 'error', content: '未授权，请联系平台管理员' },
        update_card: false,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Handle different actions
  if (action === 'start_attendance') {
    if (!sessionId || !recordId) {
      return new Response(
        JSON.stringify({ toast: { type: 'error', content: 'Missing session info' } }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get or create attendance session
    let session = await getAttendanceSession(env, sessionId);

    if (!session) {
      // Create new session
      const newSessionId = crypto.randomUUID();
      await createAttendanceSession(env, {
        id: newSessionId,
        institution_id: institution.id,
        record_id: recordId,
        card_id: null,
        message_id: null,
        open_message_id: openMessageId,
        course_name: data?.action?.value?.course_name || '',
        class_name: data?.action?.value?.class_name || '',
        teacher_name: data?.action?.value?.teacher_name || '',
        scheduled_time: data?.action?.value?.scheduled_time || null,
        status: 'active',
      });
      session = await getAttendanceSession(env, newSessionId);
    }

    // Return redirect to H5
    const h5Url = `https://bitbot.pages.dev/attendance?sess=${session.id}&record=${recordId}&card=${openMessageId}`;

    return new Response(
      JSON.stringify({
        toast: { type: 'success', content: '正在打开点名页面...' },
        open_url: h5Url,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ toast: { type: 'info', content: 'Unknown action' } }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleMessageReceive(
  env: Env,
  institution: any,
  data: any
): Promise<Response> {
  const content = data?.event?.message?.content;
  if (!content) {
    return new Response('OK');
  }

  let messageText = '';
  try {
    const parsed = JSON.parse(content);
    messageText = parsed.text || '';
  } catch {
    messageText = content;
  }

  // Process commands
  const text = messageText.trim().toLowerCase();

  // Handle 今日课表 command
  if (text.includes('@机器人') || text.includes('今日课表')) {
    await handleTodaySchedule(env, institution, data);
  }

  return new Response('OK');
}

async function handleTodaySchedule(
  env: Env,
  institution: any,
  data: any
): Promise<void> {
  const chatId = data?.event?.message?.chat_id;
  const senderOpenId = data?.event?.sender?.sender_id?.open_id;

  if (!institution?.bitable_base_id || !institution?.bitable_schedule_table_id) {
    // Send error message if bitable not configured
    if (chatId) {
      const feishuConfig = {
        appId: institution.feishu_app_id,
        appSecret: institution.feishu_app_secret,
      };
      await sendTextMessage(feishuConfig, chatId, 'chat_id', '抱歉，多维表格配置不完整，请联系管理员');
    }
    return;
  }

  const bitableConfig = {
    appId: institution.feishu_app_id,
    appSecret: institution.feishu_app_secret,
    baseId: institution.bitable_base_id,
  };

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = today.getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  try {
    // Query today's schedule from bitable
    const scheduleRecords = await bitable.getScheduleByTime(
      bitableConfig,
      institution.bitable_schedule_table_id,
      '上课时间',
      startOfDay,
      endOfDay
    );

    let scheduleText = '';
    if (scheduleRecords.length === 0) {
      scheduleText = '今日没有课程安排';
    } else {
      // Format schedule
      const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      scheduleText = `📅 ${dateStr} 课表\n\n`;

      for (const record of scheduleRecords) {
        const fields = record.fields;
        const courseName = fields['课程'] || '';
        const className = fields['班级'] || '';
        const teacherName = fields['上课老师'] || '';
        const scheduledTime = fields['上课时间'];

        if (scheduledTime) {
          const date = new Date(scheduledTime);
          const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          scheduleText += `🕐 ${timeStr} | ${courseName} - ${className}\n`;
          scheduleText += `   老师: ${teacherName}\n\n`;
        }
      }
    }

    // Send schedule to chat
    if (chatId) {
      const feishuConfig = {
        appId: institution.feishu_app_id,
        appSecret: institution.feishu_app_secret,
      };
      await sendTextMessage(feishuConfig, chatId, 'chat_id', scheduleText);
    }
  } catch (error) {
    console.error('Failed to get today schedule:', error);
    if (chatId) {
      const feishuConfig = {
        appId: institution.feishu_app_id,
        appSecret: institution.feishu_app_secret,
      };
      await sendTextMessage(feishuConfig, chatId, 'chat_id', '获取课表失败，请稍后重试');
    }
  }
}

/**
 * Send attendance card to a chat or user
 */
export async function sendScheduledAttendanceCard(
  env: Env,
  institutionId: string,
  sessionId: string,
  recordId: string,
  receiveId: string,
  receiveIdType: 'chat_id' | 'open_id',
  courseName: string,
  className: string,
  teacherName: string,
  scheduledTime: string
): Promise<{ cardId: string; messageId: string }> {
  const institution = await getInstitutionByAppId(env, receiveId);
  if (!institution) {
    throw new Error('Institution not found');
  }

  const config: FeishuConfig = {
    appId: institution.feishu_app_id,
    appSecret: institution.feishu_app_secret,
  };

  const result = await sendAttendanceCard(
    config,
    receiveId,
    receiveIdType,
    sessionId,
    recordId,
    courseName,
    className,
    teacherName,
    scheduledTime
  );

  // Update session with card_id and message_id
  await updateAttendanceSession(env, sessionId, {
    card_id: result.cardId,
    message_id: result.messageId,
  });

  return result;
}
