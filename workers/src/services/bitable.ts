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
  const filter = encodeURIComponent(
    `AND(("${studentName}" = "${studentName}"), ("record_id" = "${recordId}"))`
  );

  const records = await getRecords(config, tableId, filter);
  return records.length > 0;
}
