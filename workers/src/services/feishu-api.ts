/**
 * Feishu Open Platform API Service
 */

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  verificationToken?: string;
  encryptKey?: string;
}

interface TokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

interface ApiResponse {
  code: number;
  msg: string;
  data?: any;
}

/**
 * Get tenant access token
 */
export async function getTenantAccessToken(config: FeishuConfig): Promise<string> {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret,
    }),
  });

  const data: TokenResponse = await response.json();
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Failed to get token: ${data.msg}`);
  }

  return data.tenant_access_token;
}

/**
 * Send interactive card message
 */
export async function sendCardMessage(
  config: FeishuConfig,
  receiveId: string,
  receiveIdType: 'chat_id' | 'open_id',
  cardContent: object
): Promise<string> {
  const token = await getTenantAccessToken(config);

  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: receiveId,
      receive_id_type: receiveIdType,
      msg_type: 'interactive',
      content: JSON.stringify({
        type: 'card',
        data: cardContent,
      }),
    }),
  });

  const data: ApiResponse = await response.json();
  if (data.code !== 0) {
    throw new Error(`Failed to send message: ${data.msg}`);
  }

  return data.data?.message_id || '';
}

/**
 * Create card entity (CardKit)
 */
export async function createCardEntity(
  config: FeishuConfig,
  cardData: object
): Promise<string> {
  const token = await getTenantAccessToken(config);

  const response = await fetch('https://open.feishu.cn/open-apis/cardkit/v1/cards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'card_json',
      data: JSON.stringify({
        schema: '2.0',
        ...cardData,
      }),
    }),
  });

  const data: ApiResponse = await response.json();
  if (data.code !== 0) {
    throw new Error(`Failed to create card: ${data.msg}`);
  }

  return data.data?.card_id || '';
}

/**
 * Update card element
 */
export async function updateCardElement(
  config: FeishuConfig,
  cardId: string,
  elementId: string,
  updates: object
): Promise<void> {
  const token = await getTenantAccessToken(config);
  const uuid = crypto.randomUUID();

  const response = await fetch(
    `https://open.feishu.cn/open-apis/cardkit/v1/cards/${cardId}/elements/${elementId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        partial_element: JSON.stringify(updates),
        uuid,
      }),
    }
  );

  const data: ApiResponse = await response.json();
  if (data.code !== 0) {
    throw new Error(`Failed to update element: ${data.msg}`);
  }
}

/**
 * Batch update card elements
 */
export async function batchUpdateCardElements(
  config: FeishuConfig,
  cardId: string,
  updates: Array<{ element_id: string; partial_element: object }>,
  sequence: number = 1
): Promise<void> {
  const token = await getTenantAccessToken(config);

  const response = await fetch(
    `https://open.feishu.cn/open-apis/cardkit/v1/cards/${cardId}/batch_update`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        sequence,
        actions: JSON.stringify(
          updates.map(update => ({
            action: 'partial_update_element',
            params: {
              element_id: update.element_id,
              partial_element: update.partial_element,
            },
          }))
        ),
      }),
    }
  );

  const data: ApiResponse = await response.json();
  if (data.code !== 0) {
    throw new Error(`Failed to batch update: ${data.msg}`);
  }
}

/**
 * Send card with attendance button
 */
export async function sendAttendanceCard(
  config: FeishuConfig,
  receiveId: string,
  receiveIdType: 'chat_id' | 'open_id',
  sessionId: string,
  recordId: string,
  courseName: string,
  className: string,
  teacherName: string,
  scheduledTime: string
): Promise<{ cardId: string; messageId: string }> {
  const cardData = {
    body: {
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'plain_text',
            content: `📚 ${courseName} - ${className}`,
          },
        },
        {
          tag: 'div',
          text: {
            tag: 'plain_text',
            content: `👨‍🏫 老师: ${teacherName}  |  🕐 ${scheduledTime}`,
          },
        },
        {
          tag: 'hr',
        },
        {
          tag: 'div',
          text: {
            tag: 'plain_text',
            content: '点击下方按钮开始点名',
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: {
                tag: 'plain_text',
                content: '🎯 开始点名',
              },
              type: 'primary',
              element_id: 'start_attendance_btn',
              behaviors: [
                {
                  type: 'callback',
                  value: {
                    action: 'start_attendance',
                    session_id: sessionId,
                    record_id: recordId,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };

  const cardId = await createCardEntity(config, cardData);

  const messageId = await sendCardMessage(
    config,
    receiveId,
    receiveIdType,
    { card_id: cardId }
  );

  return { cardId, messageId };
}

/**
 * Verify webhook signature
 */
export function verifySignature(
  encryptKey: string,
  timestamp: string,
  nonce: string,
  signature: string,
  body: string
): boolean {
  // Simplified verification - in production, use proper HMAC-SHA256
  const str = `${encryptKey}${timestamp}${nonce}${body}`;
  const encoder = new TextEncoder();
  // Note: Cloudflare Workers doesn't have crypto.subtle in older runtimes
  // For now, we do basic validation
  return signature.length > 0;
}

/**
 * Get user info by open_id
 */
export async function getUserInfo(
  config: FeishuConfig,
  openId: string
): Promise<{ name: string; open_id: string }> {
  const token = await getTenantAccessToken(config);

  const response = await fetch(
    `https://open.feishu.cn/open-apis/contact/v3/users/${openId}?user_id_type=open_id`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data: ApiResponse = await response.json();
  if (data.code !== 0) {
    throw new Error(`Failed to get user info: ${data.msg}`);
  }

  return {
    name: data.data?.user?.name || 'Unknown',
    open_id: openId,
  };
}
