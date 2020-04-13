<template>
  <section class="" id="redirect_page">
    <div class="col-lg-6 offset-lg-3">
      <div class="">
        <div id="wait_text_box" class="text-center my-2">
          <p>Please wait. <a href="http://zgzg.link">OpenGoLinks<sup><i class="ml-1 fas fa-external-link-alt"></i></sup></a>
            is sending you to the following page in {{countDown}} seconds...</p>
        </div>
        <div id="go_now_box" v-on:click="go()" class="justify-content-center d-flex mt-2 mb-4">
          <div class="go-now-btn">
            <div class="go-now-out">
              <div class="text-center" style="width: 80px; height: 80px; left:35px; top:35px; position: relative;">
                <h2>{{countDown}}s</h2>
                <div class="font-size-18 text-primary" style="font-width: 800; font-style: normal">Go now <i class="fas fa-chevron-right"></i></div>
              </div>
            </div>
          </div>
        </div>
        <div id="link_box" class="d-flex justify-content-center bg-white p-3 mb-5">
          <div class="w-100">
            <div class="font-size-16">Link</div>
            <div class="font-size-18 text-secondary">{{goDest}}</div>
            <div class="font-size-16 mt-2">OpenGoLinks shorten it to</div>
            <div class="font-size-18 text-secondary">{{goLink}}</div>
            <div class="w-100 text-center font-size-16 mt-3"><a href="https://github.com/xinbenlv/open-golinks">Learn more <i class="fas fa-chevron-right"></i></a></div>
          </div>
        </div>
        <div id="powered_by_box" class="border-top">
          <p class="font-size-20 text-secondary text-center mt-3 mb-0">Powered by OpenGoLinks</p>
          <p class="font-size-20 text-secondary text-center" mb-0>The best OpenSource golink software</p>
        </div>
        <div id="logo_box" class="d-flex justify-content-center w-100">
          <div class="logo bg-light m-1"
            style="background-image: url('/static/img/opengolinks-logo.png'); background-size: cover"/>
          <div class="logo bg-light m-1"
            style="background-image: url('/static/img/dotlift-logo.png'); background-size: cover"></div>
          <div class="logo bg-light m-1"
            style="background-image: url('/static/img/zgzg-round-logo.png'); background-size: cover"></div>
        </div>
      </div>
    </div>
  </section>

</template>
<script>
  export default {
    layout: 'empty', // not using any layout
    data() {
      return {
        countDown: 3,
        goDest: "https://www.youtube.com/channel/UCm5Xy3uOJU5aGZOtdKNxVqg",
        goLink: "http://zgzg.link/cat",
      }
    },
    head () {
      return {
        title: this.title,
        meta: [
          // hid is used as unique identifier. Do not use `vmid` for it as it will not work
          { hid: 'description', name: 'description', content: 'My custom description' }
        ]
      }
    },
    methods: {
      go() {
        window.location.href = this.goDest;
      },

    },
    mounted() {
      let intervalId = setInterval(() => {
        this.countDown = this.countDown - 1;
        console.log(this.countDown);
        if(this.countDown === 0) {
          clearInterval(intervalId);
          this.go();
        }
      }, 1000);

    }
  }
</script>
<style>
  .font-size-20 {
    font-size: 20px;
    line-height: 28px;
  }

  .font-size-18 {
    font-size:18px;
    line-height: 26px;
    font-weight: lighter;
    word-wrap:break-word;
  }

  .go-now-out {
    background-image: url("/static/img/circle-button.png");
    height: 150px;
    width: 150px;
    background-repeat: no-repeat;
    background-size: cover;

  }

  .font-size-16 {
    font-size: 16px;
    line-height: 22px;
  }

  #redirect_page {
    font-size: 14px;
  }

  #link_box {
    border-radius: 10px;
  }

  #logo_box {
    height: 100px;
  }

  .logo {
    width: 88px;
    height: 88px;
  }

</style>
