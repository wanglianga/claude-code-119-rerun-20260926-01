<template>
  <div>
    <h2 style="margin:0 0 16px; font-size:18px">提交露天电影放映申请</h2>

    <div class="card" v-if="org">
      <div class="flex gap8 small">
        <span>主办方：<b>{{ org.name }}</b></span>
        <span :class="org.creditScore < 60 ? 'text-danger' : 'text-ok'">信用分 {{ org.creditScore }}</span>
        <span class="muted">（低于 60 分不可申请）</span>
        <span>押金账户余额：<b>{{ org.depositBalance }}</b> 元</span>
      </div>
    </div>

    <form class="card" @submit.prevent="submit">
      <h3>放映与场地信息</h3>
      <div class="form-row">
        <div>
          <label>放映场地 *</label>
          <select v-model="form.venueId" required>
            <option value="" disabled>请选择场地</option>
            <option v-for="v in venues" :key="v.id" :value="v.id" :disabled="v.blacklisted">
              {{ v.name }}（容量 {{ v.capacity }}）{{ v.blacklisted ? ' — 黑名单禁选' : '' }}
            </option>
          </select>
        </div>
        <div>
          <label>预计观众人数 *</label>
          <input v-model.number="form.expectedAudience" type="number" min="1" required />
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>放映开始时间 *</label>
          <input v-model="form.screeningDate" type="datetime-local" required />
        </div>
        <div>
          <label>预计结束时间 *</label>
          <input v-model="form.endTime" type="datetime-local" required />
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>影片名称 *</label>
          <input v-model="form.filmTitle" required placeholder="如：我和我的家乡" />
        </div>
        <div>
          <label>公共活动备案号</label>
          <input v-model="form.eventRecordNo" placeholder="如：HDBA-2026-0925（可审核前补录）" />
        </div>
      </div>
      <div class="form-row single">
        <div>
          <label>影片版权凭证 *（授权书编号 / 文件 / 说明）</label>
          <textarea v-model="form.copyrightProof" rows="2" required placeholder="如：授权书编号 BWQ-2026-0921（市影视版权服务中心出具）"></textarea>
        </div>
      </div>

      <h3>设备与保障条件</h3>
      <div class="form-row">
        <div>
          <label>供电条件 *</label>
          <input v-model="form.powerCondition" required placeholder="如：配电房 220V/30A 专用接口，距离 40 米" />
        </div>
        <div>
          <label>银幕尺寸（英寸）*</label>
          <input v-model="form.screenSize" type="number" step="0.01" required />
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>音响数量 *</label>
          <input v-model.number="form.speakerCount" type="number" min="1" required />
        </div>
        <div>
          <label>安保人员数量 *</label>
          <input v-model.number="form.securityStaffCount" type="number" min="1" required />
        </div>
      </div>
      <div class="form-row single">
        <div>
          <label>雨天预案 *</label>
          <textarea v-model="form.rainPlan" rows="3" required placeholder="防雨措施、停映条件、观众疏散与改期安排"></textarea>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>冻结设备押金（元）</label>
          <input v-model="form.deposit" type="number" step="0.01" />
        </div>
      </div>

      <div class="flex gap8">
        <button class="btn" type="submit">提交申请并冻结押金</button>
        <RouterLink to="/" class="btn gray">取消</RouterLink>
      </div>
    </form>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http, toast } from '../api';

const router = useRouter();
const venues = ref([]);
const org = ref(null);
const form = reactive({
  venueId: '',
  screeningDate: '',
  endTime: '',
  filmTitle: '',
  copyrightProof: '',
  eventRecordNo: '',
  expectedAudience: 200,
  powerCondition: '',
  screenSize: 200,
  speakerCount: 2,
  securityStaffCount: 4,
  rainPlan: '',
  deposit: 2000,
});

onMounted(async () => {
  venues.value = await http.get('/venues');
  const me = await http.get('/auth/profile');
  const orgs = await http.get('/orgs');
  org.value = orgs.find((o) => o.id === me.orgId);
});

async function submit() {
  try {
    const body = {
      ...form,
      expectedAudience: Number(form.expectedAudience),
      speakerCount: Number(form.speakerCount),
      securityStaffCount: Number(form.securityStaffCount),
      screenSize: String(form.screenSize),
      deposit: String(form.deposit),
      screeningDate: new Date(form.screeningDate).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
    };
    const s = await http.post('/screenings', body);
    toast('申请已提交，押金已冻结');
    router.push(`/screenings/${s.id}`);
  } catch {
    /* 拦截器已提示 */
  }
}
</script>
