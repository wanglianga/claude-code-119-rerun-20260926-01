<template>
  <el-card header="新建露天电影放映申请">
    <el-alert type="info" :closable="false" style="margin-bottom: 16px"
      title="提交后进入文化审核：审核员将核对影片授权与公共活动活动备案；黑名单场地与被暂停主办方不能申请。" />
    <el-form :model="form" label-width="130px" style="max-width: 820px">
      <el-form-item label="主办方" required>
        <el-select v-if="auth.user?.organizationId" :model-value="auth.user.organizationId" disabled style="width: 100%">
          <el-option v-for="o in orgs" :key="o.id" :value="o.id" :label="`${o.name}（信用 ${o.creditScore}，押金 ¥${o.depositBalance}）`" />
        </el-select>
        <el-select v-else v-model="form.organizationId" placeholder="选择主办方" style="width: 100%">
          <el-option v-for="o in orgs" :key="o.id" :value="o.id" :label="`${o.name}（信用 ${o.creditScore}）`" />
        </el-select>
      </el-form-item>
      <el-form-item label="影片名称" required>
        <el-input v-model="form.title" placeholder="如：我和我的家乡" />
      </el-form-item>
      <el-form-item label="放映日期时间" required>
        <el-date-picker v-model="form.screeningDate" type="datetime" placeholder="选择放映开始时间" value-format="YYYY-MM-DDTHH:mm:ssZZ" style="width: 100%" />
      </el-form-item>
      <el-form-item label="场地位置" required>
        <el-select v-model="form.venueId" placeholder="选择场地" style="width: 100%" @change="onVenue">
          <el-option v-for="v in venues" :key="v.id" :value="v.id"
            :label="`${v.name}${v.blacklisted ? '（已拉黑）' : `（容量 ${v.maxAudience} 人）`}`"
            :disabled="v.blacklisted" />
        </el-select>
        <div v-if="currentVenue" style="color: #909399; font-size: 12px; margin-top: 4px">
          地址：{{ currentVenue.address }}；供电：{{ currentVenue.powerCondition }}；
          历史噪声 {{ currentVenue.noiseEventCount }} 次 / 设备损坏 {{ currentVenue.damageEventCount }} 次
        </div>
      </el-form-item>
      <el-form-item label="预计观众人数" required>
        <el-input-number v-model="form.expectedAudience" :min="1" :max="currentVenue?.maxAudience || 1000" />
        <span v-if="currentVenue" style="margin-left: 10px; color: #909399; font-size: 12px">场地容量上限 {{ currentVenue.maxAudience }} 人</span>
      </el-form-item>
      <el-form-item label="影片版权凭证" required>
        <el-upload :action="uploadUrl" :headers="headers" :show-file-list="false" :on-success="onUpload" accept=".pdf,.jpg,.jpeg,.png">
          <el-button :loading="uploading">{{ form.copyrightProof ? '重新上传版权凭证' : '上传版权凭证（PDF/图片）' }}</el-button>
        </el-upload>
        <el-link v-if="form.copyrightProof" :href="form.copyrightProof" target="_blank" style="margin-left: 12px">查看已上传凭证</el-link>
      </el-form-item>
      <el-form-item label="供电条件" required>
        <el-input v-model="form.powerCondition" type="textarea" :rows="2" placeholder="如：固定配电箱 220V/40A，双回路；已备 30 米电缆盘" />
      </el-form-item>
      <el-form-item label="银幕尺寸" required>
        <el-select v-model="form.screenSize" style="width: 240px">
          <el-option value="300 寸 16:9" label="300 寸 16:9" />
          <el-option value="200 寸 16:9" label="200 寸 16:9" />
          <el-option value="150 寸 16:9" label="150 寸 16:9" />
        </el-select>
      </el-form-item>
      <el-form-item label="音响数量" required>
        <el-input-number v-model="form.speakerCount" :min="0" :max="20" />
        <span style="margin-left: 8px; color: #909399; font-size: 12px">只（仓库将按数量配齐音箱）</span>
      </el-form-item>
      <el-form-item label="安保人员" required>
        <el-input-number v-model="form.securityStaffCount" :min="0" :max="50" />
        <span style="margin-left: 8px; color: #909399; font-size: 12px">名</span>
      </el-form-item>
      <el-form-item label="雨天预案" required>
        <el-input v-model="form.rainPlan" type="textarea" :rows="3" placeholder="防雨措施、停止放映的降雨标准、观众疏散路线、设备转移方案" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="submitting" @click="submit">提交申请</el-button>
        <el-button @click="$router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api, apiError } from '../api';
import { useAuthStore } from '../store';

const auth = useAuthStore();
const router = useRouter();
const orgs = ref<any[]>([]);
const venues = ref<any[]>([]);
const uploading = ref(false);
const submitting = ref(false);
const uploadUrl = '/api/upload';
const headers = computed(() => ({ Authorization: `Bearer ${auth.token}` }));

const form = reactive({
  title: '', organizationId: '', venueId: '', screeningDate: '',
  expectedAudience: 100, copyrightProof: '',
  powerCondition: '', screenSize: '200 寸 16:9', speakerCount: 2,
  securityStaffCount: 4, rainPlan: '',
});

const currentVenue = computed(() => venues.value.find(v => v.id === form.venueId));

function onVenue(id: string) {
  const v = venues.value.find(x => x.id === id);
  if (v) form.powerCondition = v.powerCondition || '';
}
function onUpload(res: any) {
  form.copyrightProof = res.path;
  ElMessage.success('版权凭证上传成功');
}
async function submit() {
  if (!form.copyrightProof) return ElMessage.warning('请先上传影片版权凭证');
  submitting.value = true;
  try {
    const { data } = await api.post('/sessions', form);
    ElMessage.success('申请已提交，等待文化审核');
    router.replace(`/sessions/${data.id}`);
  } catch (e) {
    ElMessage.error(apiError(e));
  } finally {
    submitting.value = false;
  }
}
onMounted(async () => {
  const [o, v] = await Promise.all([api.get('/organizations'), api.get('/venues')]);
  orgs.value = o.data;
  venues.value = v.data;
  if (auth.user?.organizationId) form.organizationId = auth.user.organizationId;
});
</script>
