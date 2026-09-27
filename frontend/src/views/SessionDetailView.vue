<template>
  <div v-loading="loading">
    <el-page-header @back="$router.push('/sessions')" :content="''" style="margin-bottom: 10px">
      <template #content>
        <span class="mono" style="font-weight: 700">{{ s.code }}</span>
        <b style="margin-left: 12px; font-size: 17px">《{{ s.title }}》</b>
        <el-tag :type="STATUS_TYPE[s.status]" style="margin-left: 12px">{{ STATUS_LABELS[s.status] }}</el-tag>
        <el-tag v-if="s.venue?.blacklisted" type="danger" size="small" style="margin-left: 8px">场地已拉黑</el-tag>
      </template>
      <template #extra>
        <el-button v-if="canCancel" size="small" @click="cancelSession">取消场次</el-button>
      </template>
    </el-page-header>

    <el-tabs v-model="tab">
      <!-- ============ 申请信息 ============ -->
      <el-tab-pane label="申请信息" name="info">
        <el-card class="page-card">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="主办方">{{ s.organization?.name }}（信用 {{ s.organization?.creditScore }} 分 / 押金 ¥{{ s.organization?.depositBalance }}）</el-descriptions-item>
            <el-descriptions-item label="场地">{{ s.venue?.name }} · {{ s.venue?.address }}</el-descriptions-item>
            <el-descriptions-item label="放映时间">{{ fmt(s.screeningDate) }}<span v-if="s.endTime"> 至 {{ fmt(s.endTime) }}</span></el-descriptions-item>
            <el-descriptions-item label="预计 / 实际观众">{{ s.expectedAudience }} 人<span v-if="s.actualAudience != null"> / {{ s.actualAudience }} 人</span></el-descriptions-item>
            <el-descriptions-item label="银幕尺寸">{{ s.screenSize }}</el-descriptions-item>
            <el-descriptions-item label="音响数量">{{ s.speakerCount }} 只</el-descriptions-item>
            <el-descriptions-item label="供电条件" :span="2">{{ s.powerCondition }}</el-descriptions-item>
            <el-descriptions-item label="安保人员">{{ s.securityStaffCount }} 名</el-descriptions-item>
            <el-descriptions-item label="现场负责人">{{ fieldLeaderName || '待指派' }}</el-descriptions-item>
            <el-descriptions-item label="雨天预案" :span="2">{{ s.rainPlan }}</el-descriptions-item>
            <el-descriptions-item label="版权凭证" :span="2">
              <el-link :href="s.copyrightProof" target="_blank" type="primary">查看上传凭证</el-link>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="s.status === 'REJECTED'" header="🔁 审核驳回 — 修改后重新提交">
          <el-alert type="error" :closable="false" :title="`驳回意见：${s.reviewComment || '无'}`" style="margin-bottom: 12px" />
          <el-form label-width="110px" style="max-width: 640px">
            <el-form-item label="影片名称"><el-input v-model="resubmit.title" /></el-form-item>
            <el-form-item label="预计观众"><el-input-number v-model="resubmit.expectedAudience" :min="1" /></el-form-item>
            <el-form-item label="雨天预案"><el-input v-model="resubmit.rainPlan" type="textarea" :rows="3" /></el-form-item>
            <el-button type="primary" @click="doResubmit">重新提交审核</el-button>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- ============ 文化审核 ============ -->
      <el-tab-pane :label="`文化审核${s.status === 'PENDING_REVIEW' ? ' ⏳' : ''}`" name="review">
        <el-card class="page-card" v-if="s.copyrightAuthNo || s.reviewedAt">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="影片授权确认编号">{{ s.copyrightAuthNo || '—' }}</el-descriptions-item>
            <el-descriptions-item label="公共活动备案号">{{ s.filingNo || '—' }}</el-descriptions-item>
            <el-descriptions-item label="审核时间">{{ s.reviewedAt ? fmt(s.reviewedAt) : '—' }}</el-descriptions-item>
            <el-descriptions-item label="审核意见" :span="2">{{ s.reviewComment || '—' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        <el-card v-if="s.status === 'PENDING_REVIEW' && canReview" header="审核：影片授权 + 公共活动备案">
          <el-alert v-if="riskVenue" type="warning" :closable="false" show-icon style="margin-bottom: 12px"
            :title="`高风险点位：该场地历史噪声 ${s.venue?.noiseEventCount} 次 / 设备损坏 ${s.venue?.damageEventCount} 次，批准后将影响主办方信用与点位评级`" />
          <el-form label-width="150px" style="max-width: 680px">
            <el-form-item label="影片授权确认编号"><el-input v-model="review.copyrightAuthNo" placeholder="如 BQ-2026-0927-12" /></el-form-item>
            <el-form-item label="公共活动备案号"><el-input v-model="review.filingNo" placeholder="如 文体备字(2026)第 088 号" /></el-form-item>
            <el-form-item label="指派现场负责人">
              <el-select v-model="review.fieldLeaderId" placeholder="选择现场负责人" style="width: 100%">
                <el-option v-for="u in leaders" :key="u.id" :value="u.id" :label="u.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="审核备注"><el-input v-model="review.comment" type="textarea" :rows="2" /></el-form-item>
            <el-form-item v-if="riskVenue" label="风险确认">
              <el-checkbox v-model="review.confirmRisk">已知悉该点位连续噪声/设备损坏风险，仍批准本场活动</el-checkbox>
            </el-form-item>
            <el-button type="success" @click="doReview(true)">审核通过</el-button>
            <el-button type="danger" @click="doReview(false)">驳回申请</el-button>
          </el-form>
        </el-card>
        <el-empty v-else-if="s.status !== 'PENDING_REVIEW'" description="该场次已完成审核" />
      </el-tab-pane>

      <!-- ============ 设备出库 / 归还 ============ -->
      <el-tab-pane :label="`设备出库/归还${kitOpenCount ? ' 🔔' : ''}`" name="kit">
        <el-card v-if="s.status === 'APPROVED' && is('WAREHOUSE')" class="page-card" header="仓库备料：按场次配齐成套设备（投影机/幕布/音箱/电缆/备用灯泡/防雨罩）">
          <el-alert type="info" :closable="false" style="margin-bottom: 10px"
            :title="`必备类别缺一不可；本场音响 ${s.speakerCount} 只、银幕 ${s.screenSize}，请按规格配齐。仅可选择空闲设备。`" />
          <el-table :data="idleEquip" size="small" max-height="320" @selection-change="(v: any) => picked = v" ref="pickTable">
            <el-table-column type="selection" width="42" />
            <el-table-column prop="qrCode" label="二维码" width="130" />
            <el-table-column prop="name" label="名称" />
            <el-table-column label="类别" width="100"><template #default="{ row }">{{ EQUIP_CATEGORY[row.category] }}</template></el-table-column>
            <el-table-column prop="model" label="规格型号" />
          </el-table>
          <el-button type="primary" style="margin-top: 10px" @click="doPrepare">确认成套备料（{{ picked.length }} 件）</el-button>
        </el-card>

        <el-card v-if="['KIT_READY', 'IN_PROGRESS', 'PENDING_RETURN'].includes(s.status) && (is('WAREHOUSE') || is('FIELD_LEADER'))" class="page-card"
          :header="s.qrVerified ? '✅ 成套扫码核对已完成' : '设备领取：逐件扫码核对成套状态'">
          <el-input v-model="scanCode" placeholder="扫描/输入设备二维码（如 EQ-PJ-001）" style="width: 320px" @keyup.enter="doScan" :disabled="s.status !== 'KIT_READY' && s.status !== 'IN_PROGRESS'">
            <template #prepend>QR</template>
          </el-input>
          <el-button type="primary" @click="doScan" :disabled="!['KIT_READY','IN_PROGRESS'].includes(s.status)">扫码核对</el-button>
          <el-tag v-if="s.status==='KIT_READY'" type="warning" style="margin-left: 10px">剩余 {{ kitOpenCount }} 件未扫码</el-tag>
        </el-card>

        <el-card class="page-card" header="本场成套设备清单">
          <el-table :data="s.kitItems" size="small">
            <el-table-column label="二维码" width="130"><template #default="{ row }"><span class="mono">{{ row.equipment.qrCode }}</span></template></el-table-column>
            <el-table-column prop="equipment.name" label="设备名称" />
            <el-table-column label="类别" width="90"><template #default="{ row }">{{ EQUIP_CATEGORY[row.equipment.category] }}</template></el-table-column>
            <el-table-column label="状态" width="130"><template #default="{ row }"><el-tag :type="KIT_STATE[row.state].type" size="small">{{ KIT_STATE[row.state].label }}</el-tag></template></el-table-column>
            <el-table-column label="领取时间" width="160"><template #default="{ row }">{{ row.scannedAt ? fmt(row.scannedAt) : '—' }}</template></el-table-column>
            <el-table-column label="归还备注 / 赔付" min-width="160">
              <template #default="{ row }">
                        <span v-if="row.note">{{ row.note }}</span>
                        <el-tag v-if="row.compensation" type="danger" size="small" style="margin-left: 6px">赔 ¥{{ row.compensation }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card v-if="s.status === 'PENDING_RETURN' && is('WAREHOUSE')" header="仓库验收入库：登记损坏/遗失并核算赔付（自动从押金抵扣）">
          <el-table :data="returnRows" size="small">
            <el-table-column label="设备"><template #default="{ row }">{{ row.name }} <span class="mono" style="color:#909399">{{ row.qrCode }}</span></template></el-table-column>
            <el-table-column label="归还状态" width="260">
              <template #default="{ row }">
                <el-radio-group v-model="row.state" size="small">
                  <el-radio-button value="RETURNED">完好</el-radio-button>
                  <el-radio-button value="DAMAGED">损坏</el-radio-button>
                  <el-radio-button value="LOST">遗失</el-radio-button>
                </el-radio-group>
              </template>
            </el-table-column>
            <el-table-column label="赔付金额（元）" width="170">
              <template #default="{ row }"><el-input-number v-model="row.compensation" :min="0" :disabled="row.state === 'RETURNED'" size="small" /></template>
            </el-table-column>
            <el-table-column label="备注"><template #default="{ row }"><el-input v-model="row.note" size="small" placeholder="损坏情况说明" /></template></el-table-column>
          </el-table>
          <el-button type="primary" style="margin-top: 10px" @click="doReturn">确认验收入库</el-button>
        </el-card>
      </el-tab-pane>

      <!-- ============ 当天巡检 ============ -->
      <el-tab-pane :label="`当天巡检${s.status==='IN_PROGRESS' && !s.inspectedAt ? ' 📋' : ''}`" name="inspection">
        <el-card v-if="s.inspectedAt" class="page-card">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="搭建照片"><el-link :href="s.setupPhoto" target="_blank" type="primary">查看搭建照片</el-link></el-descriptions-item>
            <el-descriptions-item label="试播截图"><el-link :href="s.testPlayScreenshot" target="_blank" type="primary">查看试播截图</el-link></el-descriptions-item>
            <el-descriptions-item label="噪声实测">
              <b :style="{ color: s.noiseOverLimit ? '#f56c6c' : '#67c23a' }">{{ s.noiseDb }} dB</b>
              <el-tag :type="s.noiseOverLimit ? 'danger' : 'success'" size="small" style="margin-left:8px">{{ s.noiseOverLimit ? '超过 55dB 夜间限值' : '达标' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="巡检时间">{{ fmt(s.inspectedAt) }}</el-descriptions-item>
            <el-descriptions-item label="观众区域隔离" :span="2">{{ s.isolationDesc }}</el-descriptions-item>
            <el-descriptions-item label="消防通道情况" :span="2">{{ s.fireLaneDesc }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ s.inspectionRemark || '—' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        <el-card v-if="s.status === 'IN_PROGRESS' && is('FIELD_LEADER')" class="page-card" header="放映当天现场巡检（搭建 / 试播 / 噪声 / 隔离 / 消防通道）">
          <el-form label-width="130px" style="max-width: 720px">
            <el-form-item label="搭建照片" required>
              <el-upload :action="uploadUrl" :headers="headers" :show-file-list="false" :on-success="(r:any) => insp.setupPhoto = r.path" accept="image/*">
                <el-button size="small">{{ insp.setupPhoto ? '重新上传' : '上传搭建照片' }}</el-button>
              </el-upload>
              <el-link v-if="insp.setupPhoto" :href="insp.setupPhoto" target="_blank" style="margin-left:10px">预览</el-link>
            </el-form-item>
            <el-form-item label="试播截图" required>
              <el-upload :action="uploadUrl" :headers="headers" :show-file-list="false" :on-success="(r:any) => insp.testPlayScreenshot = r.path" accept="image/*">
                <el-button size="small">{{ insp.testPlayScreenshot ? '重新上传' : '上传试播截图' }}</el-button>
              </el-upload>
              <el-link v-if="insp.testPlayScreenshot" :href="insp.testPlayScreenshot" target="_blank" style="margin-left:10px">预览</el-link>
            </el-form-item>
            <el-form-item label="噪声分贝" required>
              <el-input-number v-model="insp.noiseDb" :min="0" :max="120" :precision="1" /> dB
              <el-tag v-if="insp.noiseDb > 55" type="danger" size="small" style="margin-left:10px">超过夜间限值 55dB，将计入点位风险与主办方信用</el-tag>
            </el-form-item>
            <el-form-item label="观众区域隔离" required><el-input v-model="insp.isolationDesc" type="textarea" :rows="2" placeholder="如：铁马护栏围合，3 个出入口各 2 名志愿者" /></el-form-item>
            <el-form-item label="消防通道情况" required><el-input v-model="insp.fireLaneDesc" type="textarea" :rows="2" placeholder="如：南北两侧消防通道全程畅通，宽度 ≥4 米" /></el-form-item>
            <el-form-item label="备注"><el-input v-model="insp.remark" type="textarea" :rows="2" /></el-form-item>
            <el-button type="primary" @click="doInspection">提交巡检记录</el-button>
          </el-form>
        </el-card>
        <el-card v-if="s.status === 'IN_PROGRESS' && is('FIELD_LEADER')" header="结束放映">
          <el-input-number v-model="actualAudience" :min="0" :max="9999" style="margin-right:10px" />
          <el-button type="warning" @click="doFinish">填报实际观众并结束放映（进入归还环节）</el-button>
          <el-tag v-if="actualAudience > s.venue?.maxAudience" type="danger" size="small" style="margin-left:10px">已超场地容量 {{ s.venue?.maxAudience }} 人</el-tag>
        </el-card>
      </el-tab-pane>

      <!-- ============ 异常协同 ============ -->
      <el-tab-pane :label="`异常协同 (${(s.incidents||[]).length})`" name="incidents">
        <el-card class="page-card" header="上报突发情况（申请方/审核/仓库/现场/安保/财务围绕同一场放映协同）">
          <el-form inline>
            <el-form-item label="类型">
              <el-select v-model="newInc.type" style="width: 170px">
                <el-option v-for="(label, key) in INCIDENT_LABELS" :key="key" :value="key" :label="label" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="newInc.type === 'NOISE_COMPLAINT'" label="投诉人联系方式">
              <el-input v-model="newInc.residentContact" style="width: 180px" />
            </el-form-item>
            <el-form-item label="情况说明" style="width: 50%"><el-input v-model="newInc.description" placeholder="现场情况、已采取措施、需要谁支援" /></el-form-item>
            <el-button type="danger" @click="reportIncident">上报异常</el-button>
          </el-form>
        </el-card>

        <el-collapse v-model="openInc">
          <el-collapse-item v-for="inc in s.incidents" :key="inc.id" :name="inc.id">
            <template #title>
              <el-tag :type="INCIDENT_STATUS[inc.status].type" size="small" style="margin-right:8px">{{ INCIDENT_STATUS[inc.status].label }}</el-tag>
              <b>{{ INCIDENT_LABELS[inc.type] }}</b>
              <span style="color:#909399;margin:0 10px">{{ fmt(inc.createdAt) }}</span>
              <el-tag v-if="inc.decision" :type="inc.decision === 'APPROVED' ? 'success' : 'danger'" size="small">
                延时{{ inc.decision === 'APPROVED' ? '已批准' : '驳回' }}
              </el-tag>
            </template>
            <div class="thread">
              <div v-for="m in inc.messages" :key="m.id" class="msg">
                <el-tag size="small" style="margin-right:6px">{{ ROLE_LABELS[m.senderRole] }}</el-tag>
                <b>{{ m.senderName }}</b>
                <span style="color:#909399;margin-left:8px">{{ fmt(m.createdAt) }}</span>
                <div style="margin-top:4px">{{ m.content }}</div>
              </div>
            </div>
            <div v-if="inc.status !== 'CLOSED'" style="margin-top: 10px">
              <el-input v-model="msgDraft[inc.id]" type="textarea" :rows="2" placeholder="输入协同消息，所有相关方可见" />
              <el-button size="small" type="primary" style="margin-top:6px" @click="sendMsg(inc)">发送</el-button>
              <el-button v-if="inc.type === 'EXTENSION_REQUEST' && (is('CULTURE_REVIEWER') || is('STREET_ADMIN'))" size="small" type="success" @click="decide(inc, 'APPROVED')">同意延时</el-button>
              <el-button v-if="inc.type === 'EXTENSION_REQUEST' && (is('CULTURE_REVIEWER') || is('STREET_ADMIN'))" size="small" type="danger" @click="decide(inc, 'REJECTED')">驳回延时</el-button>
              <el-button v-if="canClose" size="small" type="info" @click="closeInc(inc)">填写处理结果并关闭</el-button>
            </div>
            <el-alert v-else type="success" :closable="false" style="margin-top:8px" :title="`处理结果：${inc.resolution}`" />
          </el-collapse-item>
        </el-collapse>
      </el-tab-pane>

      <!-- ============ 志愿者 ============ -->
      <el-tab-pane :label="`志愿者 (${(s.volunteers||[]).length})`" name="volunteers">
        <el-card class="page-card" header="志愿者签到/签退">
          <el-form inline>
            <el-form-item label="姓名"><el-input v-model="vol.name" style="width: 120px" /></el-form-item>
            <el-form-item label="电话"><el-input v-model="vol.phone" style="width: 140px" /></el-form-item>
            <el-form-item label="岗位"><el-input v-model="vol.task" placeholder="如：东门引导/秩序" style="width: 180px" /></el-form-item>
            <el-button type="primary" @click="addVolunteer">登记并签到</el-button>
          </el-form>
          <el-table :data="s.volunteers" size="small">
            <el-table-column prop="name" label="姓名" width="110" />
            <el-table-column prop="phone" label="电话" width="140" />
            <el-table-column prop="task" label="岗位" />
            <el-table-column label="签到时间" width="170"><template #default="{ row }">{{ row.checkInAt ? fmt(row.checkInAt) : '—' }}</template></el-table-column>
            <el-table-column label="签退时间" width="170"><template #default="{ row }">{{ row.checkOutAt ? fmt(row.checkOutAt) : '未签退' }}</template></el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }"><el-button size="small" :disabled="!!row.checkOutAt" @click="checkout(row)">签退</el-button></template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- ============ 归还结算 / 核销 ============ -->
      <el-tab-pane label="归还·赔付·核销" name="settle">
        <el-card class="page-card">
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="设备赔付合计"><b style="color:#f56c6c">¥{{ s.compensationTotal }}</b></el-descriptions-item>
            <el-descriptions-item label="补贴发放">¥{{ s.subsidyAmount }}</el-descriptions-item>
            <el-descriptions-item label="版权核销">
              <el-tag :type="s.copyrightWriteoff ? 'success' : 'info'" size="small">{{ s.copyrightWriteoff ? '已核销' : '未核销' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="归还时间">{{ s.returnedAt ? fmt(s.returnedAt) : '—' }}</el-descriptions-item>
            <el-descriptions-item label="核销时间">{{ s.settledAt ? fmt(s.settledAt) : '—' }}</el-descriptions-item>
            <el-descriptions-item label="核销备注">{{ s.settleRemark || '—' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        <el-card v-if="s.status === 'COMPLETED' && (is('FINANCE') || is('STREET_ADMIN'))" class="page-card" header="财务核销：补贴发放 + 版权核销（异常全部关闭后可核销，自动结算信用与点位风险）">
          <el-form inline>
            <el-form-item label="补贴金额（元）"><el-input-number v-model="settle.subsidyAmount" :min="0" :precision="2" /></el-form-item>
            <el-form-item label="版权凭证核销"><el-switch v-model="settle.copyrightWriteoff" /></el-form-item>
            <el-form-item label="备注"><el-input v-model="settle.remark" style="width: 240px" /></el-form-item>
            <el-button type="primary" @click="doSettle">确认核销并结算信用</el-button>
          </el-form>
        </el-card>
        <el-card header="本场财务流水">
          <el-table :data="s.financeRecords" size="small">
            <el-table-column label="类型" width="110"><template #default="{ row }">{{ FINANCE_TYPE[row.type] }}</template></el-table-column>
            <el-table-column label="金额" width="120"><template #default="{ row }">¥{{ row.amount }}</template></el-table-column>
            <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag size="small" :type="row.status === 'PAID' ? 'success' : row.status === 'PENDING' ? 'danger' : 'info'">{{ row.status === 'PAID' ? '已发放' : row.status === 'PENDING' ? '待补缴' : '已确认' }}</el-tag></template></el-table-column>
            <el-table-column prop="remark" label="说明" />
            <el-table-column label="时间" width="170"><template #default="{ row }">{{ fmt(row.createdAt) }}</template></el-table-column>
          </el-table>
          <el-empty v-if="!(s.financeRecords||[]).length" description="暂无财务流水" :image-size="60" />
        </el-card>
      </el-tab-pane>

      <!-- ============ 时间线 ============ -->
      <el-tab-pane label="本场时间线" name="timeline">
        <el-timeline>
          <el-timeline-item v-for="e in s.timeline" :key="e.id" :timestamp="fmt(e.createdAt)" placement="top">
            <b>{{ e.title }}</b>
            <div v-if="e.detail" style="color:#606266">{{ e.detail }}</div>
            <div style="color:#909399;font-size:12px">操作人：{{ e.actorName || '系统' }}</div>
          </el-timeline-item>
        </el-timeline>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api, apiError } from '../api';
import {
  STATUS_LABELS, STATUS_TYPE, INCIDENT_LABELS, INCIDENT_STATUS, EQUIP_CATEGORY,
  KIT_STATE, ROLE_LABELS, FINANCE_TYPE,
} from '../constants';
import { useAuthStore } from '../store';

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;
const loading = ref(true);
const tab = ref('info');
const s = reactive<any>({ kitItems: [], incidents: [], volunteers: [], financeRecords: [], timeline: [], venue: {}, organization: {} });
const leaders = ref<any[]>([]);
const idleEquip = ref<any[]>([]);
const picked = ref<any[]>([]);
const scanCode = ref('');
const openInc = ref<string[]>([]);
const uploadUrl = '/api/upload';
const headers = computed(() => ({ Authorization: `Bearer ${auth.token}` }));

const review = reactive({ copyrightAuthNo: '', filingNo: '', comment: '', fieldLeaderId: '', confirmRisk: false });
const resubmit = reactive({ title: '', expectedAudience: 0, rainPlan: '' });
const insp = reactive({ setupPhoto: '', testPlayScreenshot: '', noiseDb: 50, isolationDesc: '', fireLaneDesc: '', remark: '' });
const newInc = reactive<{ type: string; description: string; residentContact: string }>({ type: 'NOISE_COMPLAINT', description: '', residentContact: '' });
const msgDraft = reactive<Record<string, string>>({});
const vol = reactive({ name: '', phone: '', task: '' });
const settle = reactive({ subsidyAmount: 2000, copyrightWriteoff: true, remark: '' });
const actualAudience = ref(0);

const is = (role: string) => auth.user?.role === role;
const canReview = computed(() => is('CULTURE_REVIEWER') || is('STREET_ADMIN'));
const canClose = computed(() => ['CULTURE_REVIEWER', 'FIELD_LEADER', 'SECURITY', 'STREET_ADMIN'].includes(auth.user?.role || ''));
const canCancel = computed(() => ['PENDING_REVIEW', 'REJECTED', 'APPROVED'].includes(s.status) && (auth.isStaff || auth.user?.organizationId === s.organizationId));
const riskVenue = computed(() => (s.venue?.noiseEventCount || 0) >= 2 || (s.venue?.damageEventCount || 0) >= 2);
const fieldLeaderName = computed(() => leaders.value.find(u => u.id === s.fieldLeaderId)?.name);
const kitOpenCount = computed(() => (s.kitItems || []).filter((i: any) => i.state === 'PREPARED').length);
const returnRows = ref<any[]>([]);

function fmt(t: string) {
  return t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '';
}

async function load() {
  const { data } = await api.get(`/sessions/${id}`);
  Object.assign(s, data);
  Object.assign(resubmit, { title: s.title, expectedAudience: s.expectedAudience, rainPlan: s.rainPlan });
  review.fieldLeaderId = s.fieldLeaderId || '';
  actualAudience.value = s.expectedAudience;
  returnRows.value = (s.kitItems || []).map((i: any) => ({
    equipmentId: i.equipmentId, name: i.equipment.name, qrCode: i.equipment.qrCode,
    state: 'RETURNED', compensation: 0, note: '',
  }));
}

async function doReview(approved: boolean) {
  try {
    await api.post(`/sessions/${id}/review`, {
      approved, copyrightAuthNo: review.copyrightAuthNo, filingNo: review.filingNo,
      comment: review.comment, fieldLeaderId: review.fieldLeaderId,
    }, { params: { confirmRisk: review.confirmRisk } });
    ElMessage.success(approved ? '审核通过，等待仓库备料' : '已驳回');
    await load();
  } catch (e: any) {
    if (apiError(e).startsWith('RISK:')) {
      ElMessageBox.confirm('该点位为连续噪声/设备损坏高风险点位，是否仍要批准？', '高风险确认', { type: 'warning' })
        .then(async () => {
          review.confirmRisk = true;
          await api.post(`/sessions/${id}/review`, {
            approved: true, copyrightAuthNo: review.copyrightAuthNo, filingNo: review.filingNo,
            comment: review.comment, fieldLeaderId: review.fieldLeaderId,
          }, { params: { confirmRisk: true } });
          ElMessage.success('审核通过（已确认风险）');
          await load();
        }).catch(() => {});
    }
  }
}

async function doResubmit() {
  await api.post(`/sessions/${id}/resubmit`, { ...resubmit });
  ElMessage.success('已重新提交');
  await load();
}

async function doPrepare() {
  try {
    await api.post(`/sessions/${id}/prepare`, { equipmentIds: picked.value.map(e => e.id) });
    ElMessage.success('成套备料完成，等待现场扫码领取');
    await load();
  } catch (e) { ElMessage.error(apiError(e)); }
}

async function doScan() {
  if (!scanCode.value.trim()) return;
  try {
    await api.post(`/sessions/${id}/scan`, { qrCode: scanCode.value.trim() });
    ElMessage.success(`扫码核对成功：${scanCode.value}`);
    scanCode.value = '';
    await load();
  } catch (e) { ElMessage.error(apiError(e)); }
}

async function doInspection() {
  if (!insp.setupPhoto || !insp.testPlayScreenshot || !insp.isolationDesc || !insp.fireLaneDesc) {
    return ElMessage.warning('请完整上传两张图片并填写隔离/消防通道情况');
  }
  await api.post(`/sessions/${id}/inspection`, { ...insp });
  ElMessage.success('巡检记录已提交');
  await load();
}

async function doFinish() {
  await api.post(`/sessions/${id}/finish`, { actualAudience: actualAudience.value });
  ElMessage.success('放映结束，进入设备归还环节');
  await load();
}

async function doReturn() {
  await api.post(`/sessions/${id}/return`, {
    items: returnRows.value.map(r => ({
      equipmentId: r.equipmentId, state: r.state,
      compensation: r.state === 'RETURNED' ? 0 : (r.compensation || undefined),
      note: r.note || undefined,
    })),
  });
  ElMessage.success('验收入库完成，赔付已从押金抵扣');
  await load();
}

async function reportIncident() {
  if (!newInc.description) return ElMessage.warning('请填写情况说明');
  await api.post(`/sessions/${id}/incidents`, { ...newInc });
  newInc.description = '';
  newInc.residentContact = '';
  ElMessage.success('异常已上报，相关角色可在协同线程中处理');
  await load();
}

async function sendMsg(inc: any) {
  const content = msgDraft[inc.id];
  if (!content?.trim()) return;
  await api.post(`/incidents/${inc.id}/messages`, { content });
  msgDraft[inc.id] = '';
  await load();
}

async function closeInc(inc: any) {
  const { value } = await ElMessageBox.prompt('请填写处理结果', '关闭异常事件', { inputType: 'textarea' });
  await api.post(`/incidents/${inc.id}/close`, { resolution: value });
  ElMessage.success('事件已关闭');
  await load();
}

async function decide(inc: any, decision: 'APPROVED' | 'REJECTED') {
  let newEndTime: string | undefined;
  if (decision === 'APPROVED') {
    const { value } = await ElMessageBox.prompt('批准延时至（留空则不改时间）', '延时审批', {
      inputValue: new Date(Date.now() + 3600_000).toISOString().slice(0, 16),
    }).catch(() => ({ value: '' }));
    newEndTime = value ? new Date(value).toISOString() : undefined;
  }
  await api.post(`/incidents/${inc.id}/decision`, { decision, newEndTime });
  ElMessage.success(`延时申请${decision === 'APPROVED' ? '已批准' : '已驳回'}`);
  await load();
}

async function addVolunteer() {
  if (!vol.name || !vol.phone) return ElMessage.warning('请填写姓名和电话');
  await api.post(`/sessions/${id}/volunteers`, { ...vol });
  vol.name = ''; vol.phone = ''; vol.task = '';
  ElMessage.success('志愿者已签到');
  await load();
}
async function checkout(row: any) {
  await api.post(`/sessions/${id}/volunteers/${row.id}/checkout`, {});
  await load();
}

async function doSettle() {
  try {
    await api.post(`/sessions/${id}/settle`, { ...settle });
    ElMessage.success('核销完成：补贴已发放、信用与点位风险已结算');
    await load();
  } catch (e) { ElMessage.error(apiError(e)); }
}

async function cancelSession() {
  await ElMessageBox.confirm('确认取消本场放映？已预留设备将释放', '取消确认', { type: 'warning' });
  await api.post(`/sessions/${id}/cancel`);
  ElMessage.success('场次已取消');
  await load();
}

onMounted(async () => {
  const [u, eq] = await Promise.all([api.get('/users'), api.get('/equipment', { params: { status: 'IDLE' } })]);
  leaders.value = u.data.filter((x: any) => x.role === 'FIELD_LEADER');
  idleEquip.value = eq.data;
  await load();
  loading.value = false;
});
</script>
