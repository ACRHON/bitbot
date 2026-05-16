/**
 * Feishu Bitable (Multi-dimensional Table) API Service
 */

export interface BitableConfig {
  appId: string;
  appSecret: string;
  baseId: string;
}

interface ApiResponse {
  code: number;
  msg: string;
  data?: any;
}

/**
 * Resolve app_token from a wiki URL for bitable.
 * If the URL is a direct bitable URL (/base/xxx), returns the app_token directly.
 * If the URL is a wiki URL (/wiki/xxx), calls the wiki API to get the bitable app_token.
 */
export async function resolveBitableAppToken(
  config: BitableConfig,
  urlOrToken: string
): Promise<string> {
  // If it's already a direct base URL or app_token (starts with B)
  if (urlOrToken.startsWith('B') && urlOrToken.length > 10) {
    return urlOrToken;
  }

  // If it's a /base/ URL, extract app_token
  const baseMatch = urlOrToken.match(/\/base\/([^\/\?]+)/);
  if (baseMatch) {
    return baseMatch[1];
  }

  // If it's a /wiki/ URL, need to call wiki API
  const wikiMatch = urlOrToken.match(/\/wiki\/([^\/\?]+)/);
  if (wikiMatch) {
    const nodeToken = wikiMatch[1];
    return await getBitableAppTokenFromWiki(config, nodeToken);
  }

  // If it's just a wiki node token without URL pattern
  if (wikiMatch === null && urlOrToken.length > 10 && !urlOrToken.startsWith('B')) {
    return await getBitableAppTokenFromWiki(config, urlOrToken);
  }

  throw new Error(`Invalid bitable URL or token: ${urlOrToken}`);
}

/**
 * Get bitable app_token from wiki node token
 */
async function getBitableAppTokenFromWiki(
  config: BitableConfig,
  nodeToken: string
): Promise<string> {
  const token = await getToken(config);

  // Try to get wiki node info
  // Note: This requires the wiki API scope
  const response = await fetch(
    `https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(nodeToken)}&obj_type=bitable`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data: ApiResponse = await response.json();
  if (data.code === 0 && data.data?.node?.obj_type === 'bitable') {
    return data.data.node.obj_token;
  }

  // If wiki API fails, try alternative approach
  // Sometimes the wiki node token itself is the app_token for bitable
  // This is a fallback - try using the node token directly as bitable app_token
  try {
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${nodeToken}/tables`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    const respData: ApiResponse = await response.json();
    if (respData.code === 0 && respData.data?.items) {
      return nodeToken; // It's a valid bitable app_token
    }
  } catch {
    // Ignore and continue to throw
  }

  throw new Error(`Failed to resolve bitable app_token from wiki node: ${nodeToken}`);
}

async function getToken(config: BitableConfig): Promise<string> {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret,
    }),
  });

  const data: ApiResponse = await response.json();
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Failed to get token: ${data.msg}`);
  }

  return data.tenant_access_token;
}

async function bitableRequest(
  config: BitableConfig,
  method: string,
  path: string,
  body?: object
): Promise<any> {
  const token = await getToken(config);

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.baseId}${path}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );

  const data: ApiResponse = await response.json();
  if (data.code !== 0) {
    throw new Error(`Bitable API error: ${data.msg}`);
  }

  return data.data;
}

/**
 * Get records from a table
 */
export async function getRecords(
  config: BitableConfig,
  tableId: string,
  filter?: string,
  sort?: string
): Promise<any[]> {
  const params = new URLSearchParams();
  if (filter) params.set('filter', filter);
  if (sort) params.set('sort', sort);

  const query = params.toString() ? `?${params.toString()}` : '';
  const data = await bitableRequest(config, 'GET', `/tables/${tableId}/records${query}`);
  return data?.items || [];
}

/**
 * Get a single record
 */
export async function getRecord(
  config: BitableConfig,
  tableId: string,
  recordId: string
): Promise<any> {
  const data = await bitableRequest(config, 'GET', `/tables/${tableId}/records/${recordId}`);
  return data;
}

/**
 * Create a record
 */
export async function createRecord(
  config: BitableConfig,
  tableId: string,
  fields: Record<string, any>
): Promise<string> {
  const data = await bitableRequest(config, 'POST', `/tables/${tableId}/records`, {
    fields,
  });
  return data?.record?.record_id || '';
}

/**
 * Update a record
 */
export async function updateRecord(
  config: BitableConfig,
  tableId: string,
  recordId: string,
  fields: Record<string, any>
): Promise<void> {
  await bitableRequest(config, 'PUT', `/tables/${tableId}/records/${recordId}`, {
    fields,
  });
}

/**
 * Batch create records
 */
export async function batchCreateRecords(
  config: BitableConfig,
  tableId: string,
  records: Array<{ fields: Record<string, any> }>
): Promise<string[]> {
  const data = await bitableRequest(config, 'POST', `/tables/${tableId}/records/batch_create`, {
    records,
  });
  return data?.record_ids || [];
}

/**
 * Get all tables in a bitable app
 */
export async function getTables(
  config: BitableConfig
): Promise<Array<{ table_id: string; name: string }>> {
  const data = await bitableRequest(config, 'GET', '/tables');
  return data?.items || [];
}

/**
 * Get all students from student table
 */
export async function getStudents(
  config: BitableConfig,
  tableId: string
): Promise<Array<{ record_id: string; name: string; [key: string]: any }>> {
  const records = await getRecords(config, tableId);
  return records.map(record => ({
    record_id: record.record_id,
    name: record.fields?.['姓名'] || '',
    ...record.fields,
  }));
}

/**
 * Get schedule records for a specific date/time
 */
export async function getScheduleByTime(
  config: BitableConfig,
  tableId: string,
  timeFieldName: string,
  startTime: number,
  endTime: number
): Promise<any[]> {
  // Filter: time field between startTime and endTime
  const filter = encodeURIComponent(
    `AND(("${timeFieldName}" > ${startTime}), ("${timeFieldName}" < ${endTime}))`
  );

  const records = await getRecords(config, tableId, filter);
  return records;
}

/**
 * Update attendance status in sign record table
 */
export async function updateAttendance(
  config: BitableConfig,
  tableId: string,
  recordId: string,
  status: string,
  signMethod: string = 'H5点名'
): Promise<void> {
  await updateRecord(config, tableId, recordId, {
    '签到情况': status,
    '签到方式': signMethod,
  });
}

/**
 * Add attendance record
 */
export async function addAttendanceRecord(
  config: BitableConfig,
  tableId: string,
  studentName: string,
  campusName: string,
  courseName: string,
  className: string,
  scheduledTime: number,
  status: string,
  signMethod: string = 'H5点名'
): Promise<string> {
  return await createRecord(config, tableId, {
    '姓名': studentName,
    '校区名称': campusName,
    '课程': courseName,
    '班级': className,
    '上课时间': scheduledTime,
    '签到情况': status,
    '签到方式': signMethod,
  });
}

/**
 * Check if attendance record already exists
 */
export async function checkAttendanceExists(
  config: BitableConfig,
  tableId: string,
  studentName: string,
  recordId: string
): Promise<boolean> {
  // Check if a record exists with matching student name and record_id
  const filter = encodeURIComponent(
    `AND(("[姓名]" = "${studentName}"), ("record_id" = "${recordId}"))`
  );

  const records = await getRecords(config, tableId, filter);
  return records.length > 0;
}

/**
 * Get makeup records from sign record table
 * Scans for records where 签到方式 contains "补课"
 */
export async function getMakeupRecords(
  config: BitableConfig,
  tableId: string,
  courseName: string,
  className: string,
  scheduledTime: number
): Promise<Array<{ record_id: string; name: string; [key: string]: any }>> {
  // Filter: 签到方式 contains "补课" and 课程/class matches
  const filter = encodeURIComponent(
    `AND(AND(CurrentValue.[签到方式] = "补课", CurrentValue.[课程] = "${courseName}"), CurrentValue.[班级] = "${className}")`
  );

  const records = await getRecords(config, tableId, filter);
  return records
    .filter(record => {
      const time = record.fields?.['上课时间'];
      // Match if scheduled time is within the same day (±24h)
      if (time && scheduledTime) {
        const recordTime = typeof time === 'number' ? time : new Date(time).getTime();
        return Math.abs(recordTime - scheduledTime) < 24 * 60 * 60 * 1000;
      }
      return true;
    })
    .map(record => ({
      record_id: record.record_id,
      name: record.fields?.['姓名'] || '',
      ...record.fields,
    }));
}

/**
 * Advance schedule time by N days
 */
export async function advanceScheduleTime(
  config: BitableConfig,
  tableId: string,
  recordId: string,
  days: number = 7
): Promise<void> {
  const record = await getRecord(config, tableId, recordId);
  if (!record) return;

  const fields = record.fields || {};
  const updateData: Record<string, number> = {};

  const startTime = fields['上课时间'];
  const endTime = fields['下课时间'];

  if (startTime) {
    const originalStart = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
    updateData['上课时间'] = originalStart + days * 24 * 60 * 60 * 1000;
  }

  if (endTime) {
    const originalEnd = typeof endTime === 'number' ? endTime : new Date(endTime).getTime();
    updateData['下课时间'] = originalEnd + days * 24 * 60 * 60 * 1000;
  }

  if (Object.keys(updateData).length > 0) {
    await updateRecord(config, tableId, recordId, updateData);
  }
}
