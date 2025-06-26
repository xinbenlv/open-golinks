<template>
  <section>
    <div class="input-group mb-3">
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

Vue.component('v-chart', VChart)

function getLastMonthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  const pad = n => n < 10 ? '0' + n : n;
  const startDate = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`;
  const endDate = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
  return [{ startDate, endDate }];
}

export default {
  name: 'DashboardPage',
  data() {
    return {
      pathRegex: '',
      pathDoesNotMatchRegex: '^/(healthz|test-uptimerobot|robots\\.txt|edit(\\/.*)?|ical|.*\.php|\\..*|login|logout|edit|.*\\.html|.*\.xml|images|.*php7|.*(/.*)+|.*\.php\d+)$',
      //pathDoesNotMatchRegex: '^/$',
      
      tableRows: [],
      pieOptions: {},
      lineOptions: {},
      resultLimit: 50, // 默认最大 50 条
      loading: false
    }
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    async fetchData() {
      console.log('[dashboard] fetchData called, pathRegex =', this.pathRegex, 'pathDoesNotMatchRegex =', this.pathDoesNotMatchRegex)
      this.loading = true;
      try {
        const dateRanges = getLastMonthRange();
        // 构建 dimensionFilter
        let dimensionFilter = undefined;
        if (this.pathRegex) {
          dimensionFilter = {
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                value: this.pathRegex,
                matchType: 'FULL_REGEXP'
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
      } catch (error) {
        console.error('[dashboard] fetchData error:', error)
      } finally {
        this.loading = false;
      }
    },
    updatePieChart() {
      this.pieOptions = {
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} ({d}%)'
        },
        legend: {
          orient: 'vertical',
          left: 'left'
        },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '20',
              fontWeight: 'bold'
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
          trigger: 'axis'
        },
        legend: {
          data: ['Event Count', 'Active Users']
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
          data: dates
        },
        yAxis: {
          type: 'value'
        },
        series: [
          {
            name: 'Event Count',
            type: 'line',
            data: eventCounts,
            smooth: true
          },
          {
            name: 'Active Users',
            type: 'line',
            data: activeUsers,
            smooth: true
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
