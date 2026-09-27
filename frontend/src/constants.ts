export const ROLE_LABELS: Record<string, string> = {
  APPLICANT: '申请方',
  CULTURE_REVIEWER: '文化审核员',
  WAREHOUSE: '仓库管理员',
  FIELD_LEADER: '现场负责人',
  SECURITY: '安保',
  FINANCE: '财务',
  STREET_ADMIN: '街道文体岗',
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: '待审核',
  REJECTED: '已驳回',
  APPROVED: '审核通过',
  KIT_READY: '设备成套待领取',
  IN_PROGRESS: '放映当天进行中',
  PENDING_RETURN: '待归还设备',
  COMPLETED: '已归还待核销',
  SETTLED: '已核销',
  CANCELLED: '已取消',
};

export const STATUS_TYPE: Record<string, string> = {
  PENDING_REVIEW: 'warning',
  REJECTED: 'danger',
  APPROVED: 'primary',
  KIT_READY: 'primary',
  IN_PROGRESS: 'success',
  PENDING_RETURN: 'warning',
  COMPLETED: 'warning',
  SETTLED: 'info',
  CANCELLED: 'info',
};

export const INCIDENT_LABELS: Record<string, string> = {
  FILE_CORRUPT: '影片文件损坏',
  EQUIPMENT_MISSING: '设备缺件',
  NOISE_COMPLAINT: '居民投诉噪声',
  RAIN: '临时降雨',
  OVERCROWD: '观众超员',
  POWER_TRIP: '供电跳闸',
  EXTENSION_REQUEST: '商户要求延长活动',
};

export const INCIDENT_STATUS: Record<string, { label: string; type: string }> = {
  OPEN: { label: '待处理', type: 'danger' },
  PROCESSING: { label: '协同处理中', type: 'warning' },
  CLOSED: { label: '已关闭', type: 'info' },
};

export const EQUIP_CATEGORY: Record<string, string> = {
  PROJECTOR: '投影机',
  SCREEN: '幕布',
  SPEAKER: '音箱',
  CABLE: '电缆',
  SPARE_BULB: '备用灯泡',
  RAIN_COVER: '防雨罩',
};

export const EQUIP_STATUS: Record<string, { label: string; type: string }> = {
  IDLE: { label: '空闲', type: 'success' },
  RESERVED: { label: '已预留', type: 'warning' },
  IN_USE: { label: '出库使用中', type: 'primary' },
  DAMAGED: { label: '损坏', type: 'danger' },
  LOST: { label: '遗失', type: 'danger' },
  MAINTENANCE: { label: '维修中', type: 'info' },
};

export const KIT_STATE: Record<string, { label: string; type: string }> = {
  PREPARED: { label: '已备料待领取', type: 'warning' },
  PICKED_UP: { label: '已扫码领取', type: 'primary' },
  RETURNED: { label: '已完好归还', type: 'success' },
  DAMAGED: { label: '归还时损坏', type: 'danger' },
  LOST: { label: '遗失', type: 'danger' },
};

export const ORG_TYPE: Record<string, string> = {
  COMMUNITY: '社区',
  PROPERTY: '物业',
  BUSINESS_DISTRICT: '商圈运营方',
};

export const FINANCE_TYPE: Record<string, string> = {
  DEPOSIT: '押金收取',
  DEPOSIT_REFUND: '押金退还',
  COMPENSATION: '损坏赔付',
  SUBSIDY: '补贴发放',
};

export const STAFF_ROLES = ['CULTURE_REVIEWER', 'WAREHOUSE', 'FIELD_LEADER', 'SECURITY', 'FINANCE', 'STREET_ADMIN'];
