<template>
  <section>
    <div class="input-group mb-3">
      <div class="btn-group mr-2" role="group" aria-label="First group">
        <button class="btn btn-secondary dash-duration" type="button" data-value="-1">全部</button>
        <button class="btn btn-secondary dash-duration" type="button" data-value="180">180天</button>
        <button class="btn btn-secondary dash-duration" type="button" data-value="90">90天</button>
        <button class="btn btn-secondary dash-duration" type="button" data-value="30">30天</button>
        <button class="btn btn-secondary active dash-duration" type="button" data-value="14">14天</button>
        <button class="btn btn-secondary dash-duration" type="button" data-value="1">1天</button>
      </div>
      <input class="form-control" id="regex-input" type="text" placeholder="RegEx" aria-label="Regular Expression for Search" aria-describedby="button-addon2" />
      <div class="input-group-append">
        <button class="btn btn-secondary" id="btn-update" type="button">刷新 <i class="fas fa-sync-alt"></i></button>
      </div>
    </div>
    <div id="pie-chart-container"></div>
    <div id="line-chart-container"></div>
    <div id="table-chart-container"></div>
  </section>
</template>

<script lang="ts">
if (process.browser) {
  (function (w, d, s, g, js, fs) {
          g = w['gapi'] || (w['gapi'] = {});
          g.analytics = {
              q: [], ready: function (f) {
                  this.q.push(f);
              }
          };
          js = d.createElement(s);
          fs = d.getElementsByTagName(s)[0];
          js.src = 'https://apis.google.com/js/platform.js';
          fs.parentNode.insertBefore(js, fs);
          js.onload = function () {
              g.load('analytics');
          };
      }(window, document, 'script'));
}

import { Component, Vue } from 'nuxt-property-decorator'
import { format, subDays } from 'date-fns'
import $ from 'jquery'
import axios from 'axios'

@Component
export default class DashboardPage extends Vue {
  /*   declare gapi: any; // try to access window member: https://stackoverflow.com/questions/54166847/how-to-access-the-window-object-in-vue-js
   */
  mounted() {
    window['gapi'].analytics.ready(async function() {
      var tableChart, pieChart, lineChart
      var charts

      var lockedUrl = $(`#regex-input`).val()
      if (lockedUrl) {
        $(`#regex-input`)
          .val(lockedUrl)
          .prop('disabled', true)
      }
      function refreshQuery() {
        let dateRangeBtn = $('.active.dash-duration')
        let lastNDay = parseInt(dateRangeBtn.attr('data-value'))
        var endDate = new Date() // today
        var startDate
        if (lastNDay === -1) {
          console.log(`Setting startDate`, `2018-08-01`)
          startDate = new Date(2018, 8, 1, 0, 0, 0)
        } else {
          console.log(`Setting startDate`, `today - lastNdate`)
          startDate = subDays(endDate, lastNDay)
        }
        var dateRange = {
          'start-date': format(startDate, `yyyy-MM-dd`),
          'end-date': format(endDate, `yyyy-MM-dd`)
        }

        let dimensions = 'ga:dateHour'
        if (lastNDay === -1) {
          dimensions = 'ga:isoYearIsoWeek'
        } else if (lastNDay <= 1) {
          dimensions = 'ga:dateHour'
        } else if (lastNDay <= 7) {
          dimensions = 'ga:date'
        } else if (lastNDay <= 180) {
          dimensions = 'ga:date'
        } else {
          dimensions = 'ga:isoYearIsoWeek'
        }

        lineChart.set({ query: { dimensions: dimensions } })
        charts.forEach(function(chart) {
          chart.set({ query: dateRange })
        })

        var reg = $(`#regex-input`).val()

        if (lockedUrl) {
          charts.forEach(function(chart) {
            chart.set({
              query: { filters: `ga:pagePathLevel1=~^/${lockedUrl}$` }
            })
          })
        } else if (reg) {
          charts.forEach(function(chart) {
            chart.set({ query: { filters: `ga:pagePathLevel1=~${reg}` } })
          })
        } else {
          charts.forEach(function(chart) {
            chart.set({ query: { filters: 'ga:pagePathLevel1!=/' } })
          })
        }
        charts.forEach(function(chart) {
          chart.execute()
        })
      }

      $(`.dash-duration`).click(function() {
        $(`.active`).removeClass(`active`)
        $(this).addClass(`active`)
        refreshQuery()
      })
      $(`#btn-update`).click(function() {
        refreshQuery()
      })

      const viewId = (await axios.get(`api/v2/getviewId`)).data

      window['gapi'].analytics.auth.authorize({
        container: 'embed-api-auth-container',
        serverAuth: {
          access_token: (await axios.get(`api/v2/gettoken`)).data
        }
      })

      /**
       * Create a new DataChart instance with the given query parameters
       * and Google chart options. It will be rendered inside an element
       * with the id "chart-container".
       */
      pieChart = new window['gapi'].analytics.googleCharts.DataChart({
        query: {
          ids: viewId,
          metrics: 'ga:pageviews',
          dimensions: 'ga:pagePathLevel1',
          sort: '-ga:pageviews',
          filters: 'ga:pagePathLevel1!=/',
          'max-results': 7
        },
        chart: {
          container: 'pie-chart-container',
          type: 'PIE',
          options: {
            width: '100%',
            pieHole: 4 / 9
          }
        }
      })

      /**
       * Create a table chart showing top browsers for users to interact with.
       * Clicking on a row in the table will update a second timeline chart with
       * data from the selected browser.
       */
      tableChart = new window['gapi'].analytics.googleCharts.DataChart({
        query: {
          ids: viewId, // <-- Replace with the ids value for your view.
          dimensions: 'ga:pagePathLevel1',
          metrics: 'ga:sessions,ga:pageviews,ga:users',
          sort: '-ga:sessions',
          filters: `ga:pagePathLevel1!=/`,
          'max-results': '30'
        },
        chart: {
          type: 'TABLE',
          container: 'table-chart-container',
          options: {
            width: '100%'
          }
        }
      })

      lineChart = new window['gapi'].analytics.googleCharts.DataChart({
        query: {
          ids: viewId, // <-- Replace with the ids value for your view.
          metrics: 'ga:sessions,ga:pageviews,ga:users',
          dimensions: 'ga:isoYearIsoWeek',
          filters: `ga:pagePathLevel1!=/`
        },
        chart: {
          type: 'LINE',
          container: 'line-chart-container',
          options: {
            width: '100%'
          }
        }
      })

      charts = [tableChart, pieChart, lineChart]
      refreshQuery()
    })
  }
}
</script>

<style></style>
