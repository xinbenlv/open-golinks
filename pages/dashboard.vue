<template>
  <section>
    <div class="input-group mb-3">
      <div class="btn-group mr-2" role="group" aria-label="First group">
        <button
          class="btn btn-secondary dash-duration"
          type="button"
          :data-value="-1"
          :class="{ active: duration === -1 }"
          @click="showView(-1)"
        >
          全部
        </button>
        <button
          class="btn btn-secondary dash-duration"
          type="button"
          :data-value="180"
          :class="{ active: duration === 180 }"
          @click="showView(180)"
        >
          180天
        </button>
        <button
          class="btn btn-secondary dash-duration"
          type="button"
          :data-value="90"
          :class="{ active: duration === 90 }"
          @click="showView(90)"
        >
          90天
        </button>
        <button
          class="btn btn-secondary dash-duration"
          type="button"
          :data-value="30"
          :class="{ active: duration === 30 }"
          @click="showView(30)"
        >
          30天
        </button>
        <button
          class="btn btn-secondary dash-duration"
          type="button"
          :data-value="14"
          :class="{ active: duration === 14 }"
          @click="showView(14)"
        >
          14天
        </button>
        <button
          class="btn btn-secondary dash-duration"
          type="button"
          :data-value="1"
          :class="{ active: duration === 1 }"
          @click="showView(1)"
        >
          1天
        </button>
      </div>
      <input
        class="form-control"
        id="regex-input"
        type="text"
        placeholder="RegEx"
        aria-label="Regular Expression for Search"
        aria-describedby="button-addon2"
        v-model="regex"
      />
      <div class="input-group-append">
        <button
          class="btn btn-secondary"
          id="btn-update"
          type="button"
          @click="fresh"
        >
          刷新 <i class="fas fa-sync-alt"></i>
        </button>
      </div>
    </div>
    <div id="pie-chart-container"></div>
    <div id="line-chart-container"></div>
    <div id="table-chart-container"></div>
  </section>
</template>

<script lang="ts">
import { Component, Vue } from "nuxt-property-decorator";
import { format, subDays } from "date-fns";
import axios from "axios";
import { GoogleCharts } from "google-charts";
interface ReportParams {
  dateRanges?: Array<{
    startDate: string;
    endDate: string;
  }>;
  dimensions?: Array<{
    name: string;
  }>;
  metrics?: Array<{
    name: string;
  }>;
  orderBys?: Array<{
    metric?: {
      metricName: string;
    };
    dimension?: {
      orderType: string;
      dimensionName: string;
    };
    desc: boolean;
  }>;
  limit?: number;
  dimensionFilter?: {
    filter: {
      fieldName: string;
      stringFilter: {
        matchType: string;
        value: string;
        caseSensitive: boolean;
      };
    };
    expression: string;
  };
}
@Component
export default class DashboardPage extends Vue {
  duration: number = -1;
  regex: string = "";
  viewId: string = "";
  async mounted() {
    this.viewId = (await axios.get(`api/v2/getviewId`)).data;
    this.renderCharts();
  }
  showView(duration: number) {
    this.duration = duration;
    this.renderCharts();
  }
  renderCharts() {
    // 渲染图表
    GoogleCharts.load(() => {
      this.drawChartPie();
    });
    GoogleCharts.load(() => {
      this.drawChartLine();
    });
    GoogleCharts.load(() => {
      this.drawChartTable();
    });
  }
  /**
   * pieChart 饼状图
   * 访问量前 5 的链接
   */
  async drawChartPie() {
    const reportParmas: ReportParams = {
      dateRanges: [this.getRange(this.duration)],
      dimensions: [
        {
          name: "pagePathPlusQueryString",
        },
      ],
      metrics: [
        {
          name: "screenPageViews",
        },
      ],
      orderBys: [
        {
          metric: {
            metricName: "screenPageViews",
          },
          desc: true,
        },
      ],
      limit: 5,
    };
    if (this.regex) {
      reportParmas.dimensionFilter = {
        filter: {
          fieldName: "pagePath",
          stringFilter: {
            matchType: "FULL_REGEXP",
            value: `/${this.regex}.*`,
            caseSensitive: true,
          },
        },
        expression: this.regex,
      };
    }
    const response = (
      await axios.post(
        `api/v2/analyticesDataClientReport/${this.viewId}`,
        reportParmas
      )
    ).data;
    const rows = response.rows.map((row: any) => {
      return [
        row.dimensionValues[0].value,
        parseInt(row.metricValues[0].value),
      ];
    });
    const data = GoogleCharts.api.visualization.arrayToDataTable([
      ["links", "pageviews"],
      ...rows,
    ]);
    const options = {
      title: "Top 5 links",
      is3D: false,
    };
    const chart = new GoogleCharts.api.visualization.PieChart(
      document.getElementById("pie-chart-container")
    );
    chart.draw(data, options);
  }
  /**
   * lineChart 折线图
   * 访问量随时间变化
   * pv uv 趋势
   */
  async drawChartLine() {
    let dimensionName = "isoYearIsoWeek";

    if (this.duration === -1) {
      dimensionName = "isoYearIsoWeek";
    } else if (this.duration <= 1) {
      dimensionName = "dateHour";
    } else if (this.duration <= 14) {
      dimensionName = "date";
    } else if (this.duration <= 180) {
      dimensionName = "date";
    } else {
      dimensionName = "isoYearIsoWeek";
    }

    const reportParam: ReportParams = {
      dateRanges: [this.getRange(this.duration)],
      dimensions: [{ name: dimensionName }],
      metrics: [
        { name: "activeUsers" },
        { name: "screenPageViews" },
        { name: "sessions" },
      ],
      orderBys: [
        {
          dimension: {
            orderType: "NUMERIC",
            dimensionName: dimensionName,
          },
          desc: false,
        },
      ],
    };
    const response = (
      await axios.post(
        `api/v2/analyticesDataClientReport/${this.viewId}`,
        reportParam
      )
    ).data;
    const rows = response.rows.map((row: any) => {
      return [
        row.dimensionValues[0].value,
        parseInt(row.metricValues[0].value),
        parseInt(row.metricValues[1].value),
        parseInt(row.metricValues[2].value),
      ];
    });
    const data = GoogleCharts.api.visualization.arrayToDataTable([
      ["isoYearIsoWeek", "activeUsers", "screenPageViews", "sessions"],
      ...rows,
    ]);
    const options = {
      title: "Active Users, Screen Page Views, and Sessions",
      curveType: "function",
      legend: { position: "top" },
    };
    const chart = new GoogleCharts.api.visualization.LineChart(
      document.getElementById("line-chart-container")
    );
    chart.draw(data, options);
  }
  /**
   * tableChart 表格
   */
  async drawChartTable() {
    const reportParam: ReportParams = {
      dateRanges: [this.getRange(this.duration)],
      dimensions: [
        {
          name: "pagePathPlusQueryString",
        },
      ],
      metrics: [
        { name: "sessions" },
        {
          name: "screenPageViews",
        },
        {
          name: "activeUsers",
        },
      ],
      orderBys: [
        {
          metric: {
            metricName: "sessions",
          },
          desc: true,
        },
      ],
      limit: 30,
    };
    const response = (
      await axios.post(
        `api/v2/analyticesDataClientReport/${this.viewId}`,
        reportParam
      )
    ).data;
    const rows = response.rows.map((row: any) => {
      return [
        row.dimensionValues[0].value,
        parseInt(row.metricValues[0].value),
        parseInt(row.metricValues[1].value),
        parseInt(row.metricValues[2].value),
      ];
    });
    const data = GoogleCharts.api.visualization.arrayToDataTable([
      ["links", "sessions", "screenPageViews", "activeUsers"],
      ...rows,
    ]);
    const options = {
      title: "",
      width: "100%",
      height: "100%",
    };
    const chart = new GoogleCharts.api.visualization.Table(
      document.getElementById("table-chart-container")
    );
    chart.draw(data, options);
  }
  getRange(days: number) {
    const endDate = new Date();
    let startDate = new Date(2018, 8, 1, 0, 0, 0);
    switch (days) {
      case 180:
        startDate = subDays(endDate, 180);
        break;
      case 90:
        startDate = subDays(endDate, 90);
        break;
      case 30:
        startDate = subDays(endDate, 30);
        break;
      case 14:
        startDate = subDays(endDate, 14);
        break;
      default:
        break;
    }
    return {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    };
  }
  async fresh() {
    this.renderCharts();
  }
  // async runReport(propertyId: string, duration: number, regex: string) {
  //   const response = (
  //     await axios.post(`api/v2/analyticesDataClientReport/${propertyId}`, {
  //       duration,
  //       regex,
  //     })
  //   ).data;
  //   console.log("Report result:", response);

  //   // 使用google-charts 展示饼状图
  //   GoogleCharts.load(() => {
  //     const rows = response.rows;
  //     // runReport 返回值 转成chart 数据
  //     const chartData = rows.map((row: any) => {
  //       return [
  //         row.dimensionValues[0].value,
  //         parseInt(row.metricValues[0].value),
  //       ];
  //     });
  //     const dataTable = GoogleCharts.api.visualization.arrayToDataTable([
  //       ["Chart thing", "Chart amount"],
  //       ...chartData,
  //     ]);
  //     const pie_1_chart = new GoogleCharts.api.visualization.PieChart(
  //       document.getElementById("pie-chart-container")
  //     );
  //     pie_1_chart.draw(dataTable);
  //   });
  // }
}
</script>

<style></style>
