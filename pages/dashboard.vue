<template>
  <section>
    <div class="input-group mb-3">
      <select v-model="selectedRange" class="form-control mr-2" @change="onRangeChange">
        <option value="7">Last 7 Days</option>
        <option value="30">Last 30 Days</option>
        <option value="90">Last 90 Days</option>
        <option value="180">Last 180 Days</option>
      </select>
      <select v-model="resultLimit" class="form-control mr-2" @change="onLimitChange">
        <option value="10">显示10条</option>
        <option value="25">显示25条</option>
        <option value="50">显示50条</option>
        <option value="100">显示100条</option>
      </select>
      <input v-model="pathRegex" class="form-control" type="text" placeholder="RegEx of Path (e.g. ^/2025f-yy)" />
      <div class="input-group-append">
        <button class="btn btn-primary" @click="fetchData">确认</button>
      </div>
    </div>
    <div v-if="loading" class="text-center my-5">
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      <span> Loading...</span>
    </div>
    <div v-else>
      <div class="row mb-4">
        <div class="col-md-8">
          <h5>Group by Path</h5>
          <table class="table table-bordered table-sm">
            <thead>
              <tr>
                <th>Path</th>
                <th>Event Count</th>
                <th>Active Users</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in tableRows" :key="row.path">
                <td>{{ row.path }}</td>
                <td>{{ row.eventCount }}</td>
                <td>{{ row.activeUsers }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="col-md-4">
          <h5>Percentage by Path</h5>
          <client-only>
            <v-chart :options="pieOptions" :autoresize="true" style="height: 300px; width: 100%" />
          </client-only>
        </div>
      </div>
      <div>
        <h5>Time Visualization by Day</h5>
        <client-only>
          <v-chart :options="lineOptions" :autoresize="true" style="height: 400px; width: 100%" />
        </client-only>
      </div>
    </div>
  </section>
</template>

<script>
import Vue from 'vue'
import VChart from 'vue-echarts'
import 'echarts/lib/chart/pie'
import 'echarts/lib/chart/line'
import 'echarts/lib/component/tooltip'
import 'echarts/lib/component/legend'
import 'echarts/lib/component/grid'
import { BFormDaterangepicker } from 'bootstrap-vue'

Vue.component('v-chart', VChart)
Vue.component('b-form-daterangepicker', BFormDaterangepicker)

function getToday() {
  const now = new Date();
  const pad = n => n < 10 ? '0' + n : n;
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getNDaysAgo(n) {
  const now = new Date();
  now.setDate(now.getDate() - n);
  const pad = x => x < 10 ? '0' + x : x;
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default {
  name: 'DashboardPage',
  data() {
    const today = getToday();
    return {
      pathRegex: '',
      pathDoesNotMatchRegex: '(^/$|^/(healthz|test-uptimerobot|robots\\.txt|edit(\\/.*)?|ical|.*.php|\\..*|login|logout|edit|.*\\.html|.*\\.xml|images|.*php7|.*(/.*)+|.*\\.php\\d+|wordpress|wp|callback)$)',
      tableRows: [],
      pieOptions: {},
      lineOptions: {},
      resultLimit: 10, // 默认最大 10 条
      loading: false,
      selectedRange: '7',
      today
    }
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    onRangeChange() {
      this.fetchData();
    },
    onLimitChange() {
      this.fetchData();
    },
    async fetchData() {
      const days = parseInt(this.selectedRange, 10);
      const endDate = this.today;
      const startDate = getNDaysAgo(days);
      const dateRanges = [{ startDate, endDate }];
      // 构建 dimensionFilter
      let dimensionFilter = undefined;
      if (this.pathRegex) {
        dimensionFilter = {
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              value: this.pathRegex,
              matchType: 'PARTIAL_REGEXP',
              caseSensitive: false
            }
          }
        }
      } else if (this.pathDoesNotMatchRegex) {
        dimensionFilter = {
          notExpression: {
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                value: this.pathDoesNotMatchRegex,
                matchType: 'FULL_REGEXP'
              }
            }
          }
        }
      }
      // 1. 获取分组数据
      const groupByPathRes = await this.$axios.post('/api/v2/ga4/reports', {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'eventCount' },
          { name: 'activeUsers' }
        ],
        dimensionFilter,
        limit: this.resultLimit
      })
      console.log('[dashboard] groupByPathRes', groupByPathRes)
      const rows = groupByPathRes.data.rows || []
      this.tableRows = rows.map(r => ({
        path: r.dimensionValues[0].value,
        eventCount: r.metricValues[0].value,
        activeUsers: r.metricValues[1].value
      }))
      console.log('[dashboard] tableRows', this.tableRows)
      this.updatePieChart()

      // 2. 获取时间序列数据
      const timeSeriesRes = await this.$axios.post('/api/v2/ga4/reports', {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'eventCount' },
          { name: 'activeUsers' }
        ],
        dimensionFilter,
        limit: this.resultLimit
      })
      console.log('[dashboard] timeSeriesRes', timeSeriesRes)
      const timeRows = timeSeriesRes.data.rows || []
      this.updateLineChart(timeRows)
    },
    updatePieChart() {
      this.pieOptions = {
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} ({d}%)',
          textStyle: { color: '#fff' }
        },
        legend: {
          orient: 'horizontal',
          bottom: 0,
          textStyle: { color: '#fff' }
        },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center',
            color: '#fff'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '20',
              fontWeight: 'bold',
              color: '#fff'
            }
          },
          labelLine: {
            show: false
          },
          data: this.tableRows.map(row => ({
            value: Number(row.eventCount),
            name: row.path
          }))
        }]
      }
    },
    updateLineChart(timeRows) {
      const dates = timeRows.map(r => r.dimensionValues[0].value)
      const eventCounts = timeRows.map(r => Number(r.metricValues[0].value))
      const activeUsers = timeRows.map(r => Number(r.metricValues[1].value))
      this.lineOptions = {
        tooltip: {
          trigger: 'axis',
          textStyle: { color: '#fff' }
        },
        legend: {
          data: ['Event Count', 'Active Users'],
          textStyle: { color: '#fff' }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: dates,
          axisLabel: { color: '#fff' },
          axisLine: { lineStyle: { color: '#fff' } }
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#fff' },
          axisLine: { lineStyle: { color: '#fff' } }
        },
        series: [
          {
            name: 'Event Count',
            type: 'line',
            data: eventCounts,
            smooth: true,
            lineStyle: { color: '#fff' },
            itemStyle: { color: '#fff' }
          },
          {
            name: 'Active Users',
            type: 'line',
            data: activeUsers,
            smooth: true,
            lineStyle: { color: '#fff' },
            itemStyle: { color: '#fff' }
          }
        ]
      }
    }
  }
}
</script>

<style scoped>
.table {
  font-size: 0.95rem;
  color: #fff;
}
th, td {
  color: #fff;
}
h5, label, .form-control, .btn, .input-group-append, .input-group {
  color: #fff !important;
}
.form-control {
  background-color: #222;
  border-color: #444;
}
.btn-primary {
  background-color: #444;
  border-color: #666;
  color: #fff !important;
}
body, section {
  color: #fff;
}
@media (max-width: 768px) {
  .v-chart {
    height: 250px !important;
  }
}
</style>
