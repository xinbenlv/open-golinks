<template>
  <section class="bg-dark" >
    <div class="input-group mb-3">
      <div class="btn-group btn-group-toggle mr-2" data-toggle="buttons" role="group" aria-label="First group">
        <label class="btn btn-secondary" @click="updateQuery(-1)">
          <input type="radio" autocomplete="off"> 全部
        </label>
        <label class="btn btn-secondary" @click="updateQuery(180)">
          <input type="radio" autocomplete="off" > 180天
        </label>
        <label class="btn btn-secondary " @click="updateQuery(90)">
          <input type="radio" autocomplete="off"> 90天
        </label>
        <label class="btn btn-secondary"  @click="updateQuery(30)">
          <input type="radio" autocomplete="off"> 30天
        </label>
        <label class="btn btn-secondary active" @click="updateQuery(14)">
          <input type="radio" autocomplete="off" checked > 14天
        </label>
        <label class="btn btn-secondary" @click="updateQuery(1)">
          <input type="radio" autocomplete="off" > 1天
        </label>
      </div>
      <input class="form-control" v-model="regExpression" type="text" placeholder="RegEx" />
      <button class="btn btn-secondary" id="btn-update" @click="refreshQuery()">
          刷新 <i class="fas fa-sync-alt"></i>
      </button>
    </div>
    <GChart type="PieChart" :data="pieData" :options="pieOptions"></GChart>
    <GChart type="AreaChart" :data="lineData" :options="lineOptions"></GChart>
    <GChart type="Table" :data="tableData" :options="tableOptions" ></GChart>
  </section>
</template>

<script>
import { format, subDays } from "date-fns";
import { GChart } from "vue-google-charts";
import { da } from "date-fns/locale";

export default {
  components: {
    GChart
  },
  data() {
    return {
      days: 14,
      regExpression: "",
      pieOptions: {
        pieHole: 0.4,
        height: 300
      },
      lineOptions: {
        legend: { position: "top" },
        colors: ["#007bff", "#17a2b8", "#7570b3"],
        lineWidth: 3,
        pointSize: 5
      },
      tableOptions: {
        width: 1500
      }
    };
  },
  async asyncData({ $axios }) {
    //   var endDate = new Date(); // today
    //   var startDate = subDays(endDate, 14);
    //   const dateRange = {
    //     "startDate": format(startDate, `yyyy-MM-dd`),
    //     "endDate": format(endDate, `yyyy-MM-dd`)
    //   };
    let dateRange = {
      startDate: "2020-06-22",
      endDate: "2020-07-06"
    };
    const pielinks = await $axios.$get(
      `api/v2/link?limit=7&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&dimensions=ga:pagePath`
    );
    const linelinks = await $axios.$get(
      `api/v2/link?limit=10&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&dimensions=ga:date`
    );
    const tablelinks = await $axios.$get(
      `api/v2/link?limit=30&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&dimensions=ga:pagePath`
    );
    return { pielinks, linelinks, tablelinks };
  },
  computed: {
    dateRange() {
      let lastNDay = this.days;
      var endDate = new Date(); // today
      var startDate;
      if (parseInt(lastNDay) === -1) {
        console.log(`Setting startDate`, `2018-08-01`);
        startDate = new Date(2018, 8, 1, 0, 0, 0);
      } else {
        console.log(`Setting startDate`, `today - lastNdate`);
        startDate = subDays(endDate, lastNDay);
      }
      return {
        startDate: format(startDate, `yyyy-MM-dd`),
        endDate: format(endDate, `yyyy-MM-dd`)
      };
    },
    dimensions() {
      if (this.days === -1) {
        return "ga:isoYearIsoWeek";
      } else if (this.days <= 1) {
        return "ga:dateHour";
      } else if (this.days <= 7) {
        return "ga:date";
      } else if (this.days <= 180) {
        return "ga:date";
      } else {
        return "ga:isoYearIsoWeek";
      }
      return "ga:dateHour";
    },
    pieData() {
      var chartData = [];
      this.pielinks.forEach(l => {
        try {
          chartData.push([l.goLink, parseInt(l.pageData.pageViews)]);
        } catch {}
      });
      chartData.sort(function(a, b) {
        return b[1] - a[1];
      });
      chartData = [["Page path level 1", "PageViews"]].concat(chartData);
      return chartData;
    },
    lineData() {
      var chartData = [];
      // let chartData = [["Date", "Sessions", "PageViews", "Users"]];
      if (Object.keys(this.linelinks).length == 0) {
        var d = new Date();
        let n = 0;
        let months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec"
        ];
        while (n < this.days) {
          let date =
            months[new Date(d.setDate(d.getDate() - n)).getMonth()] +
            " " +
            new Date(d.setDate(d.getDate() - n++)).getDate();
          chartData.push([date, 0, 0, 0]);
        }
      } else {
        Object.keys(this.linelinks).forEach(k => {
          try {
            chartData.push([
              new Date(
                [
                  [k.slice(0, 4), "/", k.slice(4)].join("").slice(0, 7),
                  "/",
                  [k.slice(0, 4), "/", k.slice(4)].join("").slice(7)
                ].join("")
              ),
              parseInt(this.linelinks[k].pageSessions),
              parseInt(this.linelinks[k].pageViews),
              parseInt(this.linelinks[k].pageUsers)
            ]);
          } catch {}
        });
      }
      chartData = [["Date", "Sessions", "PageViews", "Users"]].concat(
        chartData
      );
      return chartData;
    },
    tableData() {
      var chartData = [];
      this.tablelinks.forEach(l => {
        try {
          chartData.push([
            l.goLink,
            parseInt(l.pageData.pageSessions),
            parseInt(l.pageData.pageViews),
            parseInt(l.pageData.pageUsers)
          ]);
        } catch {}
      });
      chartData.sort(function(a, b) {
        return b[1] - a[1];
      });
      chartData = [
        ["Page path level 1", "Sessions", "PageViews", "Users"]
      ].concat(chartData);
      return chartData;
    }
  },
  methods: {
    updateQuery: async function(days) {
      this.days = days;
      if (this.regExpression != "") {
        this.pielinks = await this.$axios.$get(
          `api/v2/link/${this.regExpression}?startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}&dimensions=ga:pagePath`
        );
        this.linelinks = await this.$axios.$get(
          `api/v2/link/${this.regExpression}?startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}&dimensions=${this.dimensions}`
        );
        this.tablelinks = await this.$axios.$get(
          `api/v2/link/${this.regExpression}?startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}&dimensions=ga:pagePath`
        );
      } else {
        this.pielinks = await this.$axios.$get(
          `api/v2/link?limit=7&startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}&dimensions=ga:pagePath`
        );
        this.linelinks = await this.$axios.$get(
          `api/v2/link?limit=10&startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}&dimensions=${this.dimensions}`
        );
        this.tablelinks = await this.$axios.$get(
          `api/v2/link?limit=30&startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}&dimensions=ga:pagePath`
        );
      }
    },
    refreshQuery: async function() {
      this.pielinks = await this.$axios.$get(
        `api/v2/link/${this.regExpression}?startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}&dimensions=ga:pagePath`
      );
      this.linelinks = await this.$axios.$get(
        `api/v2/link/${this.regExpression}?startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}&dimensions=${this.dimensions}`
      );
      this.tablelinks = await this.$axios.$get(
        `api/v2/link/${this.regExpression}?startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}&dimensions=ga:pagePath`
      );
    }
  },
  mounted() {}
};
</script>

<style>
</style>