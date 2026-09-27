export const ROLE_LABELS = {
  APPLICANT: '申请方',
  AUDITOR: '文化审核员',
  WAREHOUSE: '仓库管理员',
  ONSITE: '现场负责人',
  SECURITY: '安保',
  FINANCE: '财务',
  STREET: '街道文体岗',
};

export const STATUS_LABELS = {
  DRAFT: ['草稿', 'gray'],
  SUBMITTED: ['待审核', 'orange'],
  AUDITING: ['审核中', 'blue'],
  APPROVED: ['审核通过', 'blue'],
  REJECTED: ['已驳回', 'red'],
  EQUIPPED: ['已备货', 'purple'],
  ISSUED: ['已出库', 'purple'],
  SETUP: ['搭建中', 'blue'],
  SCREENING: ['放映中', 'green'],
  FINISHED: ['放映结束', 'blue'],
  RETURNED: ['已归还', 'blue'],
  SETTLED: ['已核销', 'green'],
  CANCELED: ['已取消', 'gray'],
};

export const INCIDENT_LABELS = {
  FILE_DAMAGED: '影片文件损坏',
  MISSING_PART: '设备缺件',
  NOISE_COMPLAINT: '居民投诉噪声',
  RAIN: '临时降雨',
  OVERCROWD: '观众超员',
  POWER_TRIP: '供电跳闸',
  EXTENSION_REQ: '商户要求延长活动',
};

export const INCIDENT_TYPES = Object.entries(INCIDENT_LABELS);

export const EQUIP_LABELS = {
  PROJECTOR: '投影机',
  SCREEN: '幕布',
  SPEAKER: '音箱',
  CABLE: '电缆',
  BULB: '备用灯泡',
  RAIN_COVER: '防雨罩',
};

export const EQUIP_TYPES = Object.entries(EQUIP_LABELS);

export const CHECK_LABELS = {
  SETUP_PHOTO: '搭建照片',
  TEST_PLAY: '试播截图',
  NOISE: '噪声分贝',
  AUDIENCE_ISOLATION: '观众区域隔离',
  FIRE_LANE: '消防通道',
};

export const CHECK_TYPES = Object.entries(CHECK_LABELS);

export const PHASE_LABELS = {
  SUBMIT: '申请',
  AUDIT: '审批',
  ASSIGN: '指派',
  EQUIP: '备货',
  ISSUE: '出库',
  SETUP: '搭建',
  SCREEN: '放映',
  INCIDENT: '异常',
  RETURN: '归还',
  SETTLE: '核销',
  CANCEL: '取消',
  VENUE: '场地',
  VOLUNTEER: '志愿者',
};

export const ORG_TYPE_LABELS = {
  community: '社区',
  property: '物业',
  business: '商圈',
};

export function fmtTime(t) {
  if (!t) return '—';
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDate(t) {
  if (!t) return '—';
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
